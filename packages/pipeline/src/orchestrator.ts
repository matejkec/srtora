import type {
  PipelineConfig,
  ProgressEvent,
  SubtitleDocument,
  SessionMemory,
  TranslationResult,
  TranslatedItem,
  ReviewResult,
} from '@srtora/types'
import {
  PipelineException,
  SessionMemorySchema,
} from '@srtora/types'
import {
  parse,
  buildChunks,
  buildChunksTokenBudget,
  mergeChunkResults,
  assemble,
  assembleBilingual,
  validateOutput,
  calculateAdaptiveChunkBudget,
  estimateAvgCueTokens,
} from '@srtora/core'
import type { TranslationChunk } from '@srtora/core'
import type { LLMAdapter, ChatResponse } from '@srtora/adapters'
import { createAdapter, withRetry, parseJsonSafe, buildTranslateGemmaPrompt } from '@srtora/adapters'
import {
  buildAnalysisPrompt,
  buildTranslationPrompt,
  buildReviewPrompt,
  flagTranslations,
  createPromptStrategy,
  translationOutputSchema,
  analysisOutputSchema,
  reviewOutputSchema,
} from '@srtora/prompts'
import type { PromptStrategy } from '@srtora/prompts'
import { ProgressTracker } from './progress-tracker.js'
import { resolveExecutionParams } from './profile-resolver.js'
import type { ResolvedExecutionParams } from './profile-resolver.js'

export interface PipelineCallbacks {
  onProgress: (event: ProgressEvent) => void
}

export class PipelineOrchestrator {
  private config: PipelineConfig
  private params: ResolvedExecutionParams
  private adapter: LLMAdapter
  private analysisAdapter: LLMAdapter
  private reviewAdapter: LLMAdapter
  private strategy: PromptStrategy
  private signal?: AbortSignal

  constructor(
    config: PipelineConfig,
    options?: { signal?: AbortSignal; strategy?: PromptStrategy },
  ) {
    this.config = config
    this.signal = options?.signal

    // Resolve all execution parameters from model registry + quality mode + config
    this.params = resolveExecutionParams(
      config.translationModel,
      config.provider.type,
      config,
      config.ollamaFamily,
    )

    // Translation-only models (e.g., TranslateGemma) — force-disable analysis/review
    if (this.params.translationOnly) {
      this.config = { ...this.config, enableAnalysis: false, enableReview: false }
    }

    // Use resolved prompt strategy, or explicit override
    if (options?.strategy) {
      this.strategy = options.strategy
    } else {
      this.strategy = createPromptStrategy(this.params.promptStyleId)
    }

    // Create adapters — analysis/review may use different models but same provider
    this.adapter = createAdapter(config.provider)
    this.analysisAdapter = this.adapter
    this.reviewAdapter = this.adapter
  }

  async run(
    fileContent: string,
    filename: string,
    callbacks: PipelineCallbacks,
  ): Promise<TranslationResult> {
    const tracker = new ProgressTracker(callbacks.onProgress)
    const phaseDurations: Record<string, number> = {}
    let totalRetries = 0

    this.checkCancelled()

    // Translation-only models require explicit source language
    if (this.params.translationOnly && this.config.sourceLanguage === 'auto') {
      throw new PipelineException({
        code: 'VALIDATION_ERROR',
        message: 'This translation model requires an explicit source language — Auto-detect is not supported.',
        recoverable: false,
        suggestion: 'Select a specific source language (e.g. English) in the language selector.',
      })
    }

    // === Phase 0: Parse ===
    tracker.emit('parsing', { message: 'Parsing subtitle file...' })
    const parseStart = Date.now()

    let document: SubtitleDocument
    try {
      document = parse(fileContent, filename)
    } catch (error) {
      throw new PipelineException({
        code: 'PARSE_ERROR',
        message: `Failed to parse subtitle file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        phase: 'parsing',
        recoverable: false,
      })
    }

    phaseDurations.parsing = Date.now() - parseStart
    tracker.emit('parsing', { phaseProgress: 1, message: `Parsed ${document.cueCount} cues` })

    this.checkCancelled()

    // === Phase 1: Analyze (optional) ===
    let sessionMemory: SessionMemory | undefined

    if (this.params.enableAnalysis) {
      tracker.emit('analyzing', { message: 'Analyzing content...' })
      const analyzeStart = Date.now()

      const sampleSize = Math.min(50, document.cues.length)
      const step = Math.max(1, Math.floor(document.cues.length / sampleSize))
      const sampleCues = document.cues.filter((_, i) => i % step === 0).slice(0, sampleSize)

      const { system, user } = buildAnalysisPrompt({
        sampleCues,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        tonePreference: this.config.tonePreference,
      })

      const messages = this.strategy.formatMessages(system, user)
      const model = this.config.analysisModel || this.config.translationModel

      try {
        const response = await withRetry(
          () =>
            this.analysisAdapter.chat({
              model,
              messages,
              jsonSchema: analysisOutputSchema,
              maxTokens: this.params.maxCompletionTokens,
              signal: this.signal,
            }),
          { maxRetries: this.params.maxRetries, signal: this.signal },
        )

        const parsed = parseJsonSafe(response.content)
        if (parsed) {
          const validated = SessionMemorySchema.safeParse(parsed.data)
          if (validated.success) {
            sessionMemory = validated.data
          } else {
            tracker.addWarnings(1)
          }
        } else {
          tracker.addWarnings(1)
        }
      } catch (error) {
        // Analysis is optional — log warning and continue
        if (error instanceof PipelineException && error.error.code === 'CANCELLED') throw error
        tracker.addWarnings(1)
      }

      phaseDurations.analyzing = Date.now() - analyzeStart
      tracker.emit('analyzing', {
        phaseProgress: 1,
        message: sessionMemory
          ? `Found ${sessionMemory.speakers.length} speakers, ${sessionMemory.terms.length} terms`
          : 'Analysis complete (no memory extracted)',
      })
    }

    this.checkCancelled()

    // === Phase 2: Translate ===
    tracker.emit('translating', { message: 'Translating...' })
    const translateStart = Date.now()

    // Build chunks using token-budget-first strategy
    const chunks = this.buildTranslationChunks(document)

    const chunkResults: { chunkId: string; items: TranslatedItem[]; warnings: string[]; repairCount: number }[] = []
    const allTranslations = new Map<number, string>()

    const useTranslateGemma = this.params.translationOnly && this.params.promptStyleId === 'raw-completion'

    for (let i = 0; i < chunks.length; i++) {
      this.checkCancelled()

      const chunk = chunks[i]!
      tracker.emit('translating', {
        chunkIndex: i,
        totalChunks: chunks.length,
        phaseProgress: i / chunks.length,
        message: `Translating chunk ${i + 1}/${chunks.length}...`,
      })

      const chunkStart = Date.now()

      let items: TranslatedItem[] = []
      let repairCount = 0
      const warnings: string[] = []

      if (useTranslateGemma) {
        // TranslateGemma: per-cue translation with specialized content format
        items = await this.translateChunkWithTranslateGemma(chunk)
      } else {
        // Standard path: batch translation with JSON schema
        const effectiveMemory = this.filterSessionMemory(sessionMemory)
        const { system, user } = buildTranslationPrompt({
          targetCues: chunk.targetCues,
          contextBefore: chunk.contextBefore,
          contextAfter: chunk.contextAfter,
          previousTranslations: allTranslations,
          sessionMemory: effectiveMemory,
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage: this.config.targetLanguage,
          tonePreference: this.config.tonePreference,
        })

        const messages = this.strategy.formatMessages(system, user)

        const response = await withRetry(
          async () => {
            const resp = await this.adapter.chat({
              model: this.config.translationModel,
              messages,
              jsonSchema: translationOutputSchema,
              maxTokens: this.params.maxCompletionTokens,
              signal: this.signal,
            })

            const parsed = this.parseTranslationResponse(resp, chunk)
            if (!parsed) {
              throw new PipelineException({
                code: 'STRUCTURED_OUTPUT_FAIL',
                message: `Failed to parse translation response for ${chunk.chunkId}`,
                phase: 'translating',
                chunkId: chunk.chunkId,
                recoverable: true,
              })
            }
            return parsed
          },
          { maxRetries: this.params.maxRetries, signal: this.signal },
        )

        items = response.items
        repairCount = response.repaired ? 1 : 0
        if (repairCount) totalRetries++
      }

      // Validate: check all target cues got translations
      const missingCues = chunk.targetCues.filter(
        (cue) => !items.some((item) => item.id === cue.sequence),
      )
      if (missingCues.length > 0) {
        // Use source text as fallback for missing translations
        for (const cue of missingCues) {
          items.push({ id: cue.sequence, text: cue.rawText })
          warnings.push(`Chunk ${chunk.chunkId}: missing translation for cue ${cue.sequence}, using source text`)
        }
      }

      // Store translations
      for (const item of items) {
        allTranslations.set(item.id, item.text)
      }

      chunkResults.push({ chunkId: chunk.chunkId, items, warnings, repairCount })
      tracker.addWarnings(warnings.length)
      tracker.recordChunkTime(Date.now() - chunkStart)
    }

    phaseDurations.translating = Date.now() - translateStart
    tracker.emit('translating', {
      phaseProgress: 1,
      chunkIndex: chunks.length,
      totalChunks: chunks.length,
      message: `Translated ${chunks.length} chunks`,
    })

    this.checkCancelled()

    // === Phase 3: Review (optional) ===
    if (this.params.enableReview && this.params.reviewDepth !== 'none') {
      tracker.emit('reviewing', { message: 'Reviewing translations...' })
      const reviewStart = Date.now()

      const reviewMemory = this.filterSessionMemory(sessionMemory)

      const flags = flagTranslations({
        cues: document.cues,
        translations: allTranslations,
        sessionMemory: reviewMemory,
      })

      if (flags.length > 0) {
        tracker.emit('reviewing', {
          phaseProgress: 0.3,
          message: `Found ${flags.length} issues, requesting corrections...`,
        })

        const { system, user } = buildReviewPrompt({
          flags,
          allCues: document.cues,
          translations: allTranslations,
          sessionMemory: reviewMemory,
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage: this.config.targetLanguage,
        })

        const messages = this.strategy.formatMessages(system, user)
        const model = this.config.reviewModel || this.config.translationModel

        try {
          const response = await withRetry(
            () =>
              this.reviewAdapter.chat({
                model,
                messages,
                jsonSchema: reviewOutputSchema,
                maxTokens: this.params.maxCompletionTokens,
                signal: this.signal,
              }),
            { maxRetries: this.params.maxRetries, signal: this.signal },
          )

          const parsed = parseJsonSafe<ReviewResult>(response.content)
          if (parsed?.data?.corrections) {
            for (const correction of parsed.data.corrections) {
              allTranslations.set(correction.id, correction.text)
            }
            tracker.emit('reviewing', {
              phaseProgress: 0.9,
              message: `Applied ${parsed.data.corrections.length} corrections`,
            })
          }
        } catch (error) {
          // Review is optional — log warning and continue
          if (error instanceof PipelineException && error.error.code === 'CANCELLED') throw error
          tracker.addWarnings(1)
        }
      } else {
        tracker.emit('reviewing', {
          phaseProgress: 0.9,
          message: 'No issues found during review',
        })
      }

      phaseDurations.reviewing = Date.now() - reviewStart
    }

    this.checkCancelled()

    // === Phase 4: Assemble ===
    tracker.emit('assembling', { message: 'Assembling output...' })
    const assembleStart = Date.now()

    // Merge chunk results
    const { translations: finalTranslations, warnings: mergeWarnings } = mergeChunkResults(
      chunks,
      chunkResults,
      document,
    )
    tracker.addWarnings(mergeWarnings.length)

    // Build output
    const outputContent = assemble(document, finalTranslations)

    // Bilingual output
    let bilingualContent: string | undefined
    if (this.config.bilingualOutput) {
      bilingualContent = assembleBilingual(document, finalTranslations)
    }

    // Validate output
    const validation = validateOutput(document, finalTranslations)
    if (!validation.valid) {
      tracker.addWarnings(validation.issues.length)
    }

    phaseDurations.assembling = Date.now() - assembleStart

    // Collect all warnings
    const allWarnings = [
      ...mergeWarnings,
      ...chunkResults.flatMap((r) => r.warnings),
      ...validation.issues,
    ]

    const result: TranslationResult = {
      document,
      sessionMemory,
      chunks: chunkResults,
      warnings: allWarnings,
      outputContent,
      bilingualContent,
      stats: {
        totalChunks: chunks.length,
        totalRetries,
        totalDurationMs: tracker.getElapsedMs(),
        phaseDurations,
      },
    }

    tracker.emit('complete', { phaseProgress: 1, message: 'Translation complete!' })

    return result
  }

  /**
   * Build translation chunks using token-budget-first strategy.
   *
   * If idealChunkTarget is set on the profile, falls back to fixed cue-count chunking.
   * Otherwise, calculates a token budget and builds variable-size chunks where
   * short cues produce larger chunks and long cues produce smaller chunks.
   */
  private buildTranslationChunks(document: SubtitleDocument): TranslationChunk[] {
    // If the profile specifies an ideal chunk target, use fixed cue-count chunking
    if (this.params.idealChunkTarget != null) {
      return buildChunks(document, {
        chunkSize: this.params.idealChunkTarget,
        lookbehind: this.params.lookbehind,
        lookahead: this.params.lookahead,
      })
    }

    // Token-budget-first: calculate budget, then build variable-size chunks
    const avgCueTokens = estimateAvgCueTokens(document, this.config.sourceLanguage)
    const outputStrategy = this.params.structuredOutputMethod === 'none' ? 'raw' as const : 'structured' as const

    const budget = calculateAdaptiveChunkBudget({
      contextWindow: this.params.contextWindow,
      avgCueTokens,
      lookbehind: this.params.lookbehind,
      lookahead: this.params.lookahead,
      contextUsageTarget: this.params.effectiveContextUsageTarget,
      outputStrategy,
      maxOutputTokens: this.params.maxCompletionTokens,
      totalCues: document.cues.length,
      safeInputBudget: this.params.safeInputBudget,
      hardChunkCeiling: this.params.hardChunkCeiling,
      outputStabilityThreshold: this.params.outputStabilityThreshold,
    })

    return buildChunksTokenBudget(document, {
      targetTokenBudget: budget.targetTokenBudget,
      maxCueCount: budget.maxCueCount,
      sourceLanguage: this.config.sourceLanguage,
      lookbehind: this.params.lookbehind,
      lookahead: this.params.lookahead,
    })
  }

  private parseTranslationResponse(
    response: ChatResponse,
    _chunk: TranslationChunk,
  ): { items: TranslatedItem[]; repaired: boolean } | null {
    const parsed = parseJsonSafe<
      | TranslatedItem[]
      | { translations: TranslatedItem[] }
    >(response.content)

    if (!parsed) return null

    let items: TranslatedItem[]
    if (Array.isArray(parsed.data)) {
      items = parsed.data
    } else if (parsed.data && 'translations' in parsed.data && Array.isArray(parsed.data.translations)) {
      items = parsed.data.translations
    } else {
      return null
    }

    // Validate items have required fields
    items = items.filter(
      (item) => typeof item.id === 'number' && typeof item.text === 'string',
    )

    // If the response was truncated but we recovered some items, use them
    // rather than retrying and getting the same truncation
    if (items.length === 0) return null

    return { items, repaired: parsed.repaired || response.finishReason === 'length' }
  }

  /**
   * Translate a chunk using TranslateGemma's pre-formatted prompt + /v1/completions.
   *
   * The MLX-LM server strips content arrays to plain strings before the Jinja
   * template runs, so /v1/chat/completions cannot work with TranslateGemma.
   * Instead we replicate the Jinja template in TypeScript and call /v1/completions.
   * Sends one request per cue since TranslateGemma accepts exactly one text item.
   */
  private async translateChunkWithTranslateGemma(
    chunk: TranslationChunk,
  ): Promise<TranslatedItem[]> {
    const items: TranslatedItem[] = []

    for (const cue of chunk.targetCues) {
      this.checkCancelled()

      const prompt = buildTranslateGemmaPrompt(
        this.config.sourceLanguage,
        this.config.targetLanguage,
        cue.plainText,
      )

      const translatedText = await withRetry(
        () =>
          this.adapter.complete(
            this.config.translationModel,
            prompt,
            this.params.maxCompletionTokens,
            ['<end_of_turn>'],
            this.signal,
          ),
        { maxRetries: this.params.maxRetries, signal: this.signal },
      )

      // Strip any special tokens that leaked through (e.g. <end_of_turn> repeated on bad stop)
      const translated = translatedText
        .replace(/<end_of_turn>[\s\S]*/g, '')
        .replace(/<start_of_turn>[\s\S]*/g, '')
        .trim()

      // Re-apply any inline formatting tags from the source cue
      let finalText = translated
      if (cue.inlineTags.length > 0 && cue.rawText !== cue.plainText) {
        const beforePlain = cue.rawText.indexOf(cue.plainText)
        if (beforePlain > 0) {
          const prefix = cue.rawText.substring(0, beforePlain)
          const suffix = cue.rawText.substring(beforePlain + cue.plainText.length)
          finalText = prefix + translated + suffix
        }
      }

      items.push({ id: cue.sequence, text: finalText })
    }

    return items
  }

  /**
   * Filter session memory based on the model's memoryInjection strategy.
   * 'full' = pass through, 'terms-only' = strip speakers, 'none' = undefined.
   */
  private filterSessionMemory(memory: SessionMemory | undefined): SessionMemory | undefined {
    if (!memory) return undefined
    switch (this.params.memoryInjection) {
      case 'none': return undefined
      case 'terms-only': return { speakers: [], terms: memory.terms, warnings: [] }
      case 'full': return memory
    }
  }

  private checkCancelled() {
    if (this.signal?.aborted) {
      throw new PipelineException({
        code: 'CANCELLED',
        message: 'Pipeline cancelled',
        recoverable: false,
      })
    }
  }
}
