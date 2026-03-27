'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { memoryStore } from '@/hooks/use-pipeline-runner'
import { useEffect, useState } from 'react'
import { Brain, Trash2 } from 'lucide-react'

interface MemoryStats {
  termCount: number
  speakerCount: number
  correctionCount: number
}

export function MemoryPanel() {
  const {
    translationMemoryEnabled,
    setTranslationMemoryEnabled,
    connectionStatus,
  } = useTranslationStore()

  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!translationMemoryEnabled) {
      setStats(null)
      return
    }
    memoryStore.getStats().then(setStats).catch(() => setStats(null))
  }, [translationMemoryEnabled])

  // Refresh stats after a translation completes
  const phase = useTranslationStore((s) => s.phase)
  useEffect(() => {
    if (phase === 'complete' && translationMemoryEnabled) {
      memoryStore.getStats().then(setStats).catch(() => {})
    }
  }, [phase, translationMemoryEnabled])

  if (connectionStatus !== 'connected') return null

  const totalItems = stats ? stats.termCount + stats.speakerCount + stats.correctionCount : 0

  const handleClear = async () => {
    setClearing(true)
    try {
      await memoryStore.clearMemory()
      setStats({ termCount: 0, speakerCount: 0, correctionCount: 0 })
    } catch {
      // Ignore
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <label className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Brain className="h-4 w-4" />
          Translation Memory
        </span>
        <input
          type="checkbox"
          checked={translationMemoryEnabled}
          onChange={(e) => setTranslationMemoryEnabled(e.target.checked)}
          className="rounded"
        />
      </label>

      {translationMemoryEnabled && stats && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {stats.termCount} terms · {stats.speakerCount} speakers · {stats.correctionCount} corrections
          </span>
          {totalItems > 0 && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
