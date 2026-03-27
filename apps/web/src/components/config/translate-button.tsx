'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { Play, Square, RotateCcw } from 'lucide-react'

export function TranslateButton() {
  const { file, selectedModel, phase, connectionStatus, requestTranslation, requestCancel, resetSession } =
    useTranslationStore()

  const isIdle = phase === 'idle'
  const isRunning = !['idle', 'complete', 'error', 'cancelled'].includes(phase)
  const isComplete = phase === 'complete'
  const isFailed = phase === 'error' || phase === 'cancelled'

  const canTranslate = file && selectedModel && connectionStatus === 'connected' && isIdle
  const canCancel = isRunning
  const canReset = isComplete || isFailed

  if (!file) return null

  return (
    <div className="space-y-2">
      {isIdle && (
        <button
          onClick={requestTranslation}
          disabled={!canTranslate}
          className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Play className="h-4 w-4" />
          Translate
        </button>
      )}

      {canCancel && (
        <button
          onClick={requestCancel}
          className="w-full rounded-lg bg-destructive py-3 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2"
        >
          <Square className="h-4 w-4" />
          Cancel
        </button>
      )}

      {canReset && (
        <button
          onClick={resetSession}
          className="w-full rounded-lg bg-secondary py-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          New Translation
        </button>
      )}

      {!selectedModel && connectionStatus === 'connected' && (
        <p className="text-xs text-muted-foreground text-center">Select a model to translate</p>
      )}
      {connectionStatus !== 'connected' && connectionStatus !== 'untested' && (
        <p className="text-xs text-muted-foreground text-center">Connect to a provider first</p>
      )}
    </div>
  )
}
