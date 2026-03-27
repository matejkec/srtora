import type {
  PipelineConfig,
  ProgressEvent,
  SubtitleDocument,
  SessionMemory,
  TranslationResult,
  TranslatedItem,
  ReviewResult,
  OutputStrategyType,
  ModelCapabilities,
  CorrectionEntry,
} from '@srtora/types'
import {
  PipelineException,
  SessionMemorySchema,
} from '@srtora/types'
import {
  parse,
  buildChunks,
  mergeChunkResults,
  assemble,
  assembleBilingual,
  validateOutput,
  calculateAdaptiveChunkSize,
  estimateAvgCueTokens,
} from '@srtora/core'
import type { TranslationChunk } from '@srtora/core'
import type { LLMAdapter, ChatRequest, ChatResponse } from '@srtora/adapters'
import {
  createAdapter,
  withRetry,
  parseJsonSafe,
  buildTranslateGemmaPrompt,
  resolveCapabilities,
  prepareRequest,
  isStructuredOutputError,
} from '@srtora/adapters'
import {
  buildAnalysisPrompt,
  buildTranslationPrompt,
  buildReviewPrompt,
  flagTranslations,
  DefaultStrategy,
  GemmaStrategy,
  translationOutputSchema,
  analysisOutputSchema,
  reviewOutputSchema,
  estimatePromptOverhead,
} from '@srtora/prompts'
import type { PromptStrategy } from '@srtora/prompts'
import { ProgressTracker } from './progress-tracker.js'
import { QUALITY_MODES } from './quality-modes.js'
import { mergeMemoryIntoSession, getRelevantCorrections } from './memory-injector.js'

/**
 * Returns true if the model name refers to a TranslateGemma model.
 * Covers all realistic naming variants by stripping separators before matching.
 */
export function isTranslateGemmaModel(modelName: string): boolean {
  const normalized = modelName.toLowerCase().replace(/[-_/]/g, '')
  return normalized.includes('translate') && normalized.includes('gemma')
}

export interface PipelineCallbacks {
  onProgress: (event: ProgressEvent) => void
}

export class PipelineOrchestrator {
  private config: PipelineConfig
  private adapter: LLMAdapter
  private strategy: PromptStrategy
  private signal?: AbortSignal

  /** Effective output strategy (resolved from capabilities or config override) */
  private outputStrategy: OutputStrategyType = 'prompted'
  /** Resolved model capabilities */
  private modelCaps: ModelCapabilities | null = null
  /** Effective chunk size (may be computed adaptively) */
  private effectiveChunkSize: number
  /** Number of review passes */
  private reviewPasses: number
  /** Effective lookbehind */
  private effectiveLookbehind: number
  /** Effective lookahead */
  private effectiveLookahead: number
  /** Effective max retries */
  private effectiveMaxRetries: number
  /** Quality mode context usage target */
  private contextUsageTarget: number

  /** Cumulative parse failure count — triggers chunk size reduction after threshold */
  private parseFailureCount = 0
  /** Parse failure threshold before reducing chunk size */
  private static readonly PARSE_FAILURE_THRESHOLD = 3
  /** Chunk size reduction factor after hitting parse failure threshold */
  private static readonly CHUNK_SIZE_REDUCTION = 0.7

  /** Reasonable max tokens to prevent truncation on servers with low defaults (e.g. MLX 256) */
  private static readonly MAX_COMPLETION_TOKENS = 4096

  constructor(
    config: PipelineConfig,
    options?: { signal?: AbortSignal; strategy?: PromptStrategy },
  ) {
    this.config = config
    this.signal = options?.signal

    // Resolve quality mode
    const mode = config.qualityMode ? QUALITY_MODES[config.qualityMode] : undefined

    // Apply quality mode defaults, with explicit config overrides
    const enableAnalysis = config.enableAnalysis ?? mode?.enableAnalysis ?? true
    const enableReview = config.enableReview ?? mode?.enableReview ?? true
    this.reviewPasses = config.reviewPasses ?? mode?.reviewPasses ?? 1
    this.effectiveChunkSize = config.chunkSize ?? mode?.fixedChunkSize ?? 15
    this.effectiveLookbehind = config.lookbehind ?? mode?.lookbehind ?? 3
    this.effectiveLookahead = config.lookahead ?? mode?.lookahead ?? 3
    this.effectiveMaxRetries = config.maxRetries ?? mode?.maxRetries ?? 2
    this.contextUsageTarget = mode?.contextUsageTarget ?? 0.6

    // TranslateGemma is a specialized model — disable analysis/review
    if (this.isTranslateGemma()) {
      this.config = { ...this.config, enableAnalysis: false, enableReview: false }
      this.reviewPasses = 0
    } else {
      this.config = { ...this.config, enableAnalysis, enableReview }
    }

    // Auto-detect prompt strategy based on model family
    if (options?.strategy) {
      this.strategy = options.strategy
    } else {
      const modelLower = config.translationModel.toLowerCase()
      this.strategy = modelLower.includes('gemma')
        ? new GemmaStrategy()
        : new DefaultStrategy()
    }

    // Create adapter
    this.adapter = createAdapter(config.provider)

    // Resolve model capabilities and output strategy
    const resolved = resolveCapabilities(
      config.translationModel,
      config.provider.type,
    )
    this.modelCaps = resolved.capabilities
    this.outputStrategy = config.outputStrategy ?? resolved.outputStrategy

    // Override prompt strategy based on capabilities
    if (this.modelCaps && !this.modelCaps.supportsSystemRole && !options?.strategy) {
      this.strategy = new GemmaStrategy()
    }
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

    // TranslateGemma requires a real ISO 639-1 source language code — it cannot auto-detect
    if (this.isTranslateGemma() && this.config.sourceLanguage === 'auto') {
      throw new PipelineException({
        code: 'VALIDATION_ERROR',
        message: 'TranslateGemma requires an explicit source language — Auto-detect is not supported.',
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

    // === Merge translation memory ===
    const languagePair = `${this.config.sourceLanguage}->${this.config.targetLanguage}`
    let corrections: CorrectionEntry[] = []
    let initialSessionMemory: SessionMemory | undefined

    if (this.config.translationMemory) {
      initialSessionMemory = mergeMemoryIntoSession(
        this.config.translationMemory,
        undefined,
        languagePair,
      )
      corrections = getRelevantCorrections(this.config.translationMemory, languagePair)
    }

    // === Adaptive chunk sizing ===
    const qualityMode = this.config.qualityMode ? QUALITY_MODES[this.config.qualityMode] : undefined
    if (qualityMode?.chunkSizingStrategy === 'adaptive' || (!this.config.chunkSize && this.modelCaps)) {
      const avgCueTokens = estimateAvgCueTokens(document, this.config.sourceLanguage)
      const promptOverhead = estimatePromptOverhead({
        speakerCount: initialSessionMemory?.speakers.length ?? 0,
        termCount: initialSessionMemory?.terms.length ?? 0,
        correctionCount: corrections.length,
        hasTonePreference: !!this.config.tonePreference,
      })
      this.effectiveChunkSize = calculateAdaptiveChunkSize({
        contextWindow: this.modelCaps?.contextWindow ?? null,
        avgCueTokens,
        lookbehind: this.effectiveLookbehind,
        lookahead: this.effectiveLookahead,
        contextUsageTarget: this.contextUsageTarget,
        outputStrategy: this.outputStrategy,
        systemPromptOverhead: promptOverhead,
        maxOutputTokens: this.modelCaps?.maxOutputTokens ?? null,
        totalCues: document.cues.length,
      })
    }

    // === Phase 1: Analyze (optional) ===
    let sessionMemory: SessionMemory | undefined = initialSessionMemory

    if (this.config.enableAnalysis) {
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
        const response = await this.chatWithFallback(
          {
            model,
            messages,
            jsonSchema: analysisOutputSchema,
            maxTokens: PipelineOrchestrator.MAX_COMPLETION_TOKENS,
            signal: this.signal,
          },
          tracker,
        )

        const parsed = parseJsonSafe(response.content)
        if (parsed) {
          const validated = SessionMemorySchema.safeParse(parsed.data)
          if (validated.success) {
            // Merge analysis results with translation memory
            if (this.config.translationMemory && initialSessionMemory) {
              sessionMemory = mergeMemoryIntoSession(
                this.config.translationMemory,
                validated.data,
                languagePair,
              )
            } else {
              sessionMemory = validated.data
            }
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

    const chunks = buildChunks(document, {
      chunkSize: this.effectiveChunkSize,
      lookbehind: this.effectiveLookbehind,
      lookahead: this.effectiveLookahead,
    })

    const chunkResults: { chunkId: string; items: TranslatedItem[]; warnings: string[]; repairCount: number }[] = []
    const allTranslations = new Map<number, string>()

    const useTranslateGemma = this.isTranslateGemma()

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
        // Standard path: batch translation with output strategy
        const { system, user } = buildTranslationPrompt({
          targetCues: chunk.targetCues,
          contextBefore: chunk.contextBefore,
          contextAfter: chunk.contextAfter,
          previousTranslations: allTranslations,
          sessionMemory,
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage: this.config.targetLanguage,
          tonePreference: this.config.tonePreference,
          corrections: corrections.length > 0 ? corrections : undefined,
        })

        const messages = this.strategy.formatMessages(system, user)

        const response = await this.translateChunkProgressive(
          chunk,
          messages,
          sessionMemory,
          tracker,
        )

        items = response.items
        repairCount = response.repaired ? 1 : 0
        totalRetries += response.retryCount
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

    // === Phase 3: Review (optional, multi-pass) ===
    if (this.config.enableReview && this.reviewPasses > 0) {
      tracker.emit('reviewing', { message: 'Reviewing translations...' })
      const reviewStart = Date.now()

      for (let pass = 0; pass < this.reviewPasses; pass++) {
        this.checkCancelled()

        const flags = flagTranslations({
          cues: document.cues,
          translations: allTranslations,
          sessionMemory,
        })

        if (flags.length === 0) {
          tracker.emit('reviewing', {
            phaseProgress: 0.9,
            message: pass === 0
              ? 'No issues found during review'
              : `Review pass ${pass + 1}: no further issues found`,
          })
          break
        }

        tracker.emit('reviewing', {
          phaseProgress: (pass + 0.3) / this.reviewPasses,
          message: `Review pass ${pass + 1}/${this.reviewPasses}: found ${flags.length} issues...`,
        })

        const { system, user } = buildReviewPrompt({
          flags,
          allCues: document.cues,
          translations: allTranslations,
          sessionMemory,
          sourceLanguage: this.config.sourceLanguage,
          targetLanguage: this.config.targetLanguage,
        })

        const messages = this.strategy.formatMessages(system, user)
        const model = this.config.reviewModel || this.config.translationModel

        try {
          const response = await withRetry(
            () => this.chatWithFallback(
              {
                model,
                messages,
                jsonSchema: reviewOutputSchema,
                maxTokens: PipelineOrchestrator.MAX_COMPLETION_TOKENS,
                signal: this.signal,
              },
              tracker,
            ),
            { maxRetries: this.effectiveMaxRetries, signal: this.signal },
          )

          const parsed = parseJsonSafe<ReviewResult>(response.content)
          if (parsed?.data?.corrections && parsed.data.corrections.length > 0) {
            for (const correction of parsed.data.corrections) {
              allTranslations.set(correction.id, correction.text)
            }
            tracker.emit('reviewing', {
              phaseProgress: (pass + 0.9) / this.reviewPasses,
              message: `Pass ${pass + 1}: applied ${parsed.data.corrections.length} corrections`,
            })
          } else {
            // No corrections returned — stop early
            break
          }
        } catch (error) {
          // Review is optional — log warning and continue
          if (error instanceof PipelineException && error.error.code === 'CANCELLED') throw error
          tracker.addWarnings(1)
          break
        }
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

    // Extract memory updates if translation memory is active
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
   * Send a chat request with automatic fallback from structured to prompted mode.
   *
   * If the model returns a 400 error indicating JSON mode isn't supported,
   * automatically retry with prompted mode (JSON instructions in the prompt text).
   */
  private async chatWithFallback(
    request: ChatRequest,
    tracker: ProgressTracker,
  ): Promise<ChatResponse> {
    const prepared = prepareRequest(request, this.outputStrategy)

    try {
      return await this.adapter.chat(prepared)
    } catch (error) {
      // If structured output fails, downgrade to prompted mode and retry
      if (this.outputStrategy === 'structured' && isStructuredOutputError(error)) {
        this.outputStrategy = 'prompted'
        tracker.addWarnings(1)

        const fallback = prepareRequest(request, 'prompted')
        return await this.adapter.chat(fallback)
      }
      throw error
    }
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
    if (items.length === 0) return null

    return { items, repaired: parsed.repaired || response.finishReason === 'length' }
  }

  /**
   * Progressive retry strategy for translation chunks.
   *
   * Tier 1: Standard request
   * Tier 2: Same request with temperature 0.3 (introduce variation)
   * Tier 3: Simplified prompt (strip corrections, halve context) with temperature 0.5
   * Tier 4: Split chunk in half, translate each independently
   * Final fallback: Use source text (never crash)
   */
  private async translateChunkProgressive(
    chunk: TranslationChunk,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    sessionMemory: SessionMemory | undefined,
    tracker: ProgressTracker,
  ): Promise<{ items: TranslatedItem[]; repaired: boolean; retryCount: number }> {
    let retryCount = 0

    // Tier 1: Standard request
    {
      this.checkCancelled()
      const resp = await this.chatWithFallback(
        {
          model: this.config.translationModel,
          messages,
          jsonSchema: translationOutputSchema,
          maxTokens: PipelineOrchestrator.MAX_COMPLETION_TOKENS,
          signal: this.signal,
        },
        tracker,
      )
      const parsed = this.parseTranslationResponse(resp, chunk)
      if (parsed) return { ...parsed, retryCount }
    }

    // Parse failed — track it
    this.trackParseFailure(tracker)
    retryCount++

    // Tier 2: Same request with temperature 0.3
    {
      this.checkCancelled()
      try {
        const resp = await this.chatWithFallback(
          {
            model: this.config.translationModel,
            messages,
            jsonSchema: translationOutputSchema,
            maxTokens: PipelineOrchestrator.MAX_COMPLETION_TOKENS,
            temperature: 0.3,
            signal: this.signal,
          },
          tracker,
        )
        const parsed = this.parseTranslationResponse(resp, chunk)
        if (parsed) return { ...parsed, retryCount }
      } catch {
        // Continue to next tier
      }
    }

    this.trackParseFailure(tracker)
    retryCount++

    // Tier 3: Simplified prompt — strip corrections, halve context, temperature 0.5
    if (this.effectiveMaxRetries >= 2) {
      this.checkCancelled()
      try {
        const reducedMessages = this.buildReducedMessages(chunk, sessionMemory)
        const resp = await this.chatWithFallback(
          {
            model: this.config.translationModel,
            messages: reducedMessages,
            jsonSchema: translationOutputSchema,
            maxTokens: PipelineOrchestrator.MAX_COMPLETION_TOKENS,
            temperature: 0.5,
            signal: this.signal,
          },
          tracker,
        )
        const parsed = this.parseTranslationResponse(resp, chunk)
        if (parsed) return { ...parsed, retryCount }
      } catch {
        // Continue to next tier
      }

      this.trackParseFailure(tracker)
      retryCount++
    }

    // Tier 4: Split chunk in half and translate each half independently
    if (chunk.targetCues.length > 1) {
      this.checkCancelled()
      try {
        const items = await this.splitAndRetryChunk(chunk, sessionMemory, tracker)
        return { items, repaired: true, retryCount }
      } catch {
        // Fall through to source text fallback
      }
    }

    // Final fallback: use source text (never crash)
    tracker.addWarnings(1)
    const items = chunk.targetCues.map((cue) => ({
      id: cue.sequence,
      text: cue.rawText,
    }))
    return { items, repaired: false, retryCount }
  }

  /**
   * Build a simplified prompt for retry tier 3:
   * - Strip corrections
   * - Halve context cues
   */
  private buildReducedMessages(
    chunk: TranslationChunk,
    sessionMemory: SessionMemory | undefined,
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const halvedBefore = chunk.contextBefore.slice(
      Math.floor(chunk.contextBefore.length / 2),
    )
    const halvedAfter = chunk.contextAfter.slice(
      0,
      Math.ceil(chunk.contextAfter.length / 2),
    )

    const { system, user } = buildTranslationPrompt({
      targetCues: chunk.targetCues,
      contextBefore: halvedBefore,
      contextAfter: halvedAfter,
      sessionMemory,
      sourceLanguage: this.config.sourceLanguage,
      targetLanguage: this.config.targetLanguage,
      tonePreference: this.config.tonePreference,
      // No corrections — stripped for simplicity
    })

    return this.strategy.formatMessages(system, user)
  }

  /**
   * Split a chunk in half and translate each half with a single attempt.
   * If a half fails to parse, use source text for those cues.
   */
  private async splitAndRetryChunk(
    chunk: TranslationChunk,
    sessionMemory: SessionMemory | undefined,
    tracker: ProgressTracker,
  ): Promise<TranslatedItem[]> {
    const mid = Math.ceil(chunk.targetCues.length / 2)
    const halves = [
      chunk.targetCues.slice(0, mid),
      chunk.targetCues.slice(mid),
    ]

    const allItems: TranslatedItem[] = []

    for (const halfCues of halves) {
      if (halfCues.length === 0) continue
      this.checkCancelled()

      const { system, user } = buildTranslationPrompt({
        targetCues: halfCues,
        contextBefore: chunk.contextBefore,
        contextAfter: chunk.contextAfter,
        sessionMemory,
        sourceLanguage: this.config.sourceLanguage,
        targetLanguage: this.config.targetLanguage,
        tonePreference: this.config.tonePreference,
      })

      const messages = this.strategy.formatMessages(system, user)

      try {
        const resp = await this.chatWithFallback(
          {
            model: this.config.translationModel,
            messages,
            jsonSchema: translationOutputSchema,
            maxTokens: PipelineOrchestrator.MAX_COMPLETION_TOKENS,
            signal: this.signal,
          },
          tracker,
        )
        const parsed = this.parseTranslationResponse(resp, chunk)
        if (parsed) {
          allItems.push(...parsed.items)
          continue
        }
      } catch {
        // Fall through to source text
      }

      // Half failed — use source text for these cues
      tracker.addWarnings(1)
      for (const cue of halfCues) {
        allItems.push({ id: cue.sequence, text: cue.rawText })
      }
    }

    return allItems
  }

  /**
   * Track a parse failure and auto-reduce chunk size after hitting threshold.
   */
  private trackParseFailure(tracker: ProgressTracker) {
    this.parseFailureCount++
    if (
      this.parseFailureCount >= PipelineOrchestrator.PARSE_FAILURE_THRESHOLD &&
      this.parseFailureCount % PipelineOrchestrator.PARSE_FAILURE_THRESHOLD === 0
    ) {
      const newSize = Math.max(4, Math.floor(this.effectiveChunkSize * PipelineOrchestrator.CHUNK_SIZE_REDUCTION))
      if (newSize < this.effectiveChunkSize) {
        this.effectiveChunkSize = newSize
        tracker.addWarnings(1)
      }
    }
  }

  private isTranslateGemma(): boolean {
    return isTranslateGemmaModel(this.config.translationModel)
  }

  /**
   * Translate a chunk using TranslateGemma's pre-formatted prompt + /v1/completions.
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
            PipelineOrchestrator.MAX_COMPLETION_TOKENS,
            ['<end_of_turn>'],
            this.signal,
          ),
        { maxRetries: this.effectiveMaxRetries, signal: this.signal },
      )

      // Strip any special tokens that leaked through
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
