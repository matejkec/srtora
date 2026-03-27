'use client'

import { useEffect, useRef } from 'react'
import { useTranslationStore } from '@/stores/translation-store'
import { createTranslationMemoryStore } from '@/lib/translation-memory-store'
import { PipelineOrchestrator } from '@srtora/pipeline'
import type { PipelineConfig, ProgressEvent } from '@srtora/types'

const memoryStore = createTranslationMemoryStore()

/**
 * Hook that subscribes to store triggers and runs the pipeline.
 * Runs on the main thread since the pipeline is I/O-bound (LLM HTTP calls),
 * not CPU-bound, so it won't block the UI.
 */
export function usePipelineRunner() {
  const abortRef = useRef<AbortController | null>(null)
  const translationTrigger = useTranslationStore((s) => s.translationTrigger)
  const cancelTrigger = useTranslationStore((s) => s.cancelTrigger)

  // Handle translation start
  useEffect(() => {
    if (translationTrigger === 0) return

    const runPipeline = async () => {
      const state = useTranslationStore.getState()
      const { file, provider, selectedModel, apiKey } = state

      if (!file || !provider || !selectedModel) return

      // Inject API key into provider config if present
      const providerConfig = apiKey
        ? { ...provider, apiKey }
        : provider

      // Load translation memory if enabled
      const languagePair = `${state.sourceLanguage}->${state.targetLanguage}`
      let translationMemory = undefined
      if (state.translationMemoryEnabled) {
        try {
          translationMemory = await memoryStore.getMemory(languagePair)
        } catch {
          // Memory load failure is non-fatal
        }
      }

      const config: PipelineConfig = {
        sourceLanguage: state.sourceLanguage,
        targetLanguage: state.targetLanguage,
        provider: providerConfig,
        translationModel: selectedModel,
        analysisModel: state.analysisModel || undefined,
        reviewModel: state.reviewModel || undefined,
        enableAnalysis: state.enableAnalysis,
        enableReview: state.enableReview,
        bilingualOutput: state.bilingualOutput,
        lookbehind: state.lookbehind,
        lookahead: state.lookahead,
        tonePreference: state.tonePreference || undefined,
        // Quality mode drives chunk sizing, review passes, retries, etc.
        qualityMode: state.preset,
        // Only pass explicit chunkSize if in maximum mode (user control)
        ...(state.preset === 'maximum' ? { chunkSize: state.chunkSize } : {}),
        // Translation memory
        ...(translationMemory ? { translationMemory } : {}),
      }

      const abortController = new AbortController()
      abortRef.current = abortController

      useTranslationStore.getState().startTranslation()

      const orchestrator = new PipelineOrchestrator(config, {
        signal: abortController.signal,
      })

      try {
        const result = await orchestrator.run(file.content, file.filename, {
          onProgress: (event: ProgressEvent) => {
            useTranslationStore.getState().updateProgress(event)
          },
        })

        if (!abortController.signal.aborted) {
          useTranslationStore.getState().completeTranslation(result)

          // Persist memory updates from session results
          if (state.translationMemoryEnabled && result.sessionMemory) {
            try {
              const now = new Date().toISOString()
              const { speakers, terms } = result.sessionMemory

              if (terms.length > 0) {
                await memoryStore.addTerms(
                  terms.map((t) => ({
                    ...t,
                    confidence: 1,
                    createdAt: now,
                    updatedAt: now,
                    languagePair,
                  })),
                )
              }
              if (speakers.length > 0) {
                await memoryStore.addSpeakers(
                  speakers.map((s) => ({
                    ...s,
                    sourceFiles: [file.filename],
                    createdAt: now,
                    updatedAt: now,
                  })),
                )
              }
            } catch {
              // Memory persist failure is non-fatal
            }
          }
        }
      } catch (error: unknown) {
        if (abortController.signal.aborted) {
          useTranslationStore.getState().cancelTranslation()
        } else {
          const pipelineError =
            error && typeof error === 'object' && 'error' in error
              ? (error as { error: import('@srtora/types').PipelineError }).error
              : {
                  code: 'PIPELINE_ERROR' as const,
                  message: error instanceof Error ? error.message : 'Unknown error',
                  recoverable: false,
                }
          useTranslationStore.getState().failTranslation(pipelineError)
        }
      } finally {
        abortRef.current = null
      }
    }

    runPipeline()
  }, [translationTrigger])

  // Handle cancel
  useEffect(() => {
    if (cancelTrigger === 0) return
    if (abortRef.current) {
      abortRef.current.abort()
    }
  }, [cancelTrigger])
}

/** Expose the memory store for use by the memory panel */
export { memoryStore }
