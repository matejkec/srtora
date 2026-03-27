'use client'

import { useState } from 'react'
import { useTranslationStore } from '@/stores/translation-store'
import { formatDuration } from '@/lib/format-utils'
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'

export function ResultSummary() {
  const { result, warnings } = useTranslationStore()
  const [previewOpen, setPreviewOpen] = useState(false)

  if (!result) return null

  // Build preview: first 5 translated cues with source
  const previewCues = result.document.cues.slice(0, 5).map((cue) => ({
    sequence: cue.sequence,
    source: cue.rawText,
    target: result.chunks
      .flatMap((c) => c.items)
      .find((item) => item.id === cue.sequence)?.text ?? '—',
  }))

  return (
    <div className="rounded-lg border border-success/30 bg-success/5 p-6">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <h3 className="text-lg font-semibold">Translation Complete</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground block">Duration</span>
          <span className="font-medium">{formatDuration(result.stats.totalDurationMs)}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Chunks</span>
          <span className="font-medium">{result.stats.totalChunks}</span>
        </div>
        <div>
          <span className="text-muted-foreground block">Retries</span>
          <span className="font-medium">{result.stats.totalRetries}</span>
        </div>
      </div>

      {/* Translation preview */}
      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={() => setPreviewOpen(!previewOpen)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {previewOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Preview ({result.document.cueCount} cues)
        </button>

        {previewOpen && (
          <div className="mt-3 space-y-2">
            {previewCues.map((cue) => (
              <div key={cue.sequence} className="rounded-md bg-card/50 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground/50 text-xs font-mono shrink-0 pt-0.5">
                    #{cue.sequence}
                  </span>
                  <div className="space-y-1 min-w-0">
                    <p className="text-muted-foreground whitespace-pre-wrap">{cue.source}</p>
                    <p className="whitespace-pre-wrap">{cue.target}</p>
                  </div>
                </div>
              </div>
            ))}
            {result.document.cueCount > 5 && (
              <p className="text-xs text-muted-foreground/50 text-center">
                Showing first 5 of {result.document.cueCount} cues
              </p>
            )}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium">
              {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {warnings.length > 5 && (
              <li className="text-muted-foreground/50">
                ...and {warnings.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
