'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { Users, BookOpen, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export function ContextPanel() {
  const { sessionMemory } = useTranslationStore()
  const [isOpen, setIsOpen] = useState(true)

  if (!sessionMemory) return null

  const hasSpeakers = sessionMemory.speakers.length > 0
  const hasTerms = sessionMemory.terms.length > 0
  const hasWarnings = sessionMemory.warnings.length > 0

  if (!hasSpeakers && !hasTerms && !hasWarnings) return null

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-sm font-medium hover:bg-accent/50 transition-colors"
      >
        Translation Context
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Speakers */}
          {hasSpeakers && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Speakers</span>
              </div>
              <div className="space-y-1">
                {sessionMemory.speakers.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{s.label}</span>
                    {s.gender !== 'unknown' && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {s.gender} ({(s.genderConfidence * 100).toFixed(0)}%)
                      </span>
                    )}
                    {s.register && (
                      <span className="text-xs text-muted-foreground">{s.register}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms */}
          {hasTerms && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Terminology</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {sessionMemory.terms.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t.source}</span>
                    <span className="text-muted-foreground/50">&rarr;</span>
                    <span className="font-medium">{t.target}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-xs font-medium text-muted-foreground uppercase">Warnings</span>
              </div>
              <ul className="space-y-1">
                {sessionMemory.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
