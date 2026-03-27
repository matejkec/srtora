'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { formatDuration } from '@/lib/format-utils'
import { Loader2 } from 'lucide-react'

const PHASE_LABELS: Record<string, string> = {
  parsing: 'Parsing subtitle file...',
  analyzing: 'Analyzing content...',
  translating: 'Translating...',
  reviewing: 'Reviewing translations...',
  assembling: 'Assembling output...',
}

const PHASES_ORDER = ['parsing', 'analyzing', 'translating', 'reviewing', 'assembling']

export function ProgressCard() {
  const { phase, progress } = useTranslationStore()

  const percent = progress?.percent ?? 0
  const elapsed = progress?.elapsedMs ?? 0
  const eta = progress?.etaMs
  const chunkIndex = progress?.chunkIndex
  const totalChunks = progress?.totalChunks
  const warningCount = progress?.warningCount ?? 0

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Phase stepper */}
      <div className="flex items-center gap-1 mb-6">
        {PHASES_ORDER.map((p, i) => {
          const currentIndex = PHASES_ORDER.indexOf(phase)
          const isDone = i < currentIndex
          const isCurrent = p === phase
          return (
            <div key={p} className="flex items-center flex-1">
              <div
                className={`
                  h-2 flex-1 rounded-full transition-colors
                  ${isDone ? 'bg-success' : isCurrent ? 'bg-primary' : 'bg-border'}
                `}
              />
              {i < PHASES_ORDER.length - 1 && <div className="w-1" />}
            </div>
          )
        })}
      </div>

      {/* Phase label */}
      <div className="flex items-center gap-2 mb-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">{PHASE_LABELS[phase] ?? phase}</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-border overflow-hidden mb-3">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{percent.toFixed(0)}%</span>
        <div className="flex items-center gap-4">
          {chunkIndex !== undefined && totalChunks && (
            <span>
              Chunk {chunkIndex + 1}/{totalChunks}
            </span>
          )}
          <span>Elapsed: {formatDuration(elapsed)}</span>
          {eta !== undefined && eta > 0 && <span>ETA: {formatDuration(eta)}</span>}
          {warningCount > 0 && (
            <span className="text-warning">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
