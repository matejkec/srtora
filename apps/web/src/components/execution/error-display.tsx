'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { AlertCircle } from 'lucide-react'

export function ErrorDisplay() {
  const { error, phase } = useTranslationStore()

  if (phase === 'cancelled') {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">Translation was cancelled.</p>
      </div>
    )
  }

  if (!error) return null

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <h3 className="text-lg font-semibold">Translation Failed</h3>
      </div>

      <p className="text-sm mb-2">{error.message}</p>

      {error.details && (
        <p className="text-sm text-muted-foreground mb-3">{error.details}</p>
      )}

      {error.suggestion && (
        <div className="bg-accent/50 rounded-md p-3 mb-3">
          <p className="text-sm">
            <span className="font-medium">Suggestion: </span>
            {error.suggestion}
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Error code: {error.code}
        {error.phase && <> &middot; Phase: {error.phase}</>}
        {error.chunkId && <> &middot; Chunk: {error.chunkId}</>}
      </div>
    </div>
  )
}
