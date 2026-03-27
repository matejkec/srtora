'use client'

import { useEffect, useRef } from 'react'
import { useTranslationStore } from '@/stores/translation-store'
import { PipelineOrchestrator } from '@srtora/pipeline'
import type { PipelineConfig, ProgressEvent } from '@srtora/types'

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
