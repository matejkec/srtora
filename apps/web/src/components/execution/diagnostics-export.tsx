'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { FileJson } from 'lucide-react'

export function DiagnosticsExport() {
  const { result, error, phase } = useTranslationStore()

  const isVisible = phase === 'complete' || phase === 'error'
  if (!isVisible) return null

  const exportDiagnostics = () => {
    const state = useTranslationStore.getState()

    const diagnostics = {
      exportedAt: new Date().toISOString(),
      phase: state.phase,
      provider: state.provider
        ? {
            type: state.provider.type,
            executionMode: state.provider.executionMode,
            baseUrl: state.provider.baseUrl,
            // Never include API key
          }
        : null,
      config: {
        sourceLanguage: state.sourceLanguage,
        targetLanguage: state.targetLanguage,
        preset: state.preset,
        selectedModel: state.selectedModel,
        enableAnalysis: state.enableAnalysis,
        enableReview: state.enableReview,
        bilingualOutput: state.bilingualOutput,
        chunkSize: state.chunkSize,
        lookbehind: state.lookbehind,
        lookahead: state.lookahead,
      },
      result: result
        ? {
            stats: result.stats,
            cueCount: result.document.cueCount,
            warningCount: result.warnings.length,
            warnings: result.warnings.slice(0, 20),
          }
        : null,
      error: error
        ? {
            code: error.code,
            message: error.message,
            phase: error.phase,
            chunkId: error.chunkId,
            recoverable: error.recoverable,
            suggestion: error.suggestion,
          }
        : null,
    }

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `srtora-diagnostics-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={exportDiagnostics}
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <FileJson className="h-3.5 w-3.5" />
      Export diagnostics
    </button>
  )
}
