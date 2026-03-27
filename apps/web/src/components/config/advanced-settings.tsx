'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export function AdvancedSettings() {
  const {
    preset,
    enableAnalysis,
    enableReview,
    bilingualOutput,
    chunkSize,
    lookbehind,
    lookahead,
    tonePreference,
    analysisModel,
    reviewModel,
    availableModels,
    setEnableAnalysis,
    setEnableReview,
    setBilingualOutput,
    setChunkSize,
    setLookbehind,
    setLookahead,
    setTonePreference,
    setAnalysisModel,
    setReviewModel,
    connectionStatus,
  } = useTranslationStore()
  const [isOpen, setIsOpen] = useState(false)

  if (preset !== 'advanced' || connectionStatus !== 'connected') return null

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg"
      >
        Advanced Settings
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Analysis toggle */}
          <label className="flex items-center justify-between">
            <span className="text-sm">Analysis phase</span>
            <input
              type="checkbox"
              checked={enableAnalysis}
              onChange={(e) => setEnableAnalysis(e.target.checked)}
              className="rounded"
            />
          </label>

          {/* Review toggle */}
          <label className="flex items-center justify-between">
            <span className="text-sm">Review phase</span>
            <input
              type="checkbox"
              checked={enableReview}
              onChange={(e) => setEnableReview(e.target.checked)}
              className="rounded"
            />
          </label>

          {/* Bilingual output */}
          <label className="flex items-center justify-between">
            <span className="text-sm">Bilingual output</span>
            <input
              type="checkbox"
              checked={bilingualOutput}
              onChange={(e) => setBilingualOutput(e.target.checked)}
              className="rounded"
            />
          </label>

          {/* Analysis model */}
          {enableAnalysis && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Analysis model (empty = same as translation)
              </label>
              <select
                value={analysisModel}
                onChange={(e) => setAnalysisModel(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Same as translation model</option>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Review model */}
          {enableReview && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Review model (empty = same as translation)
              </label>
              <select
                value={reviewModel}
                onChange={(e) => setReviewModel(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Same as translation model</option>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Chunk size */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Chunk size: {chunkSize} cues
            </label>
            <input
              type="range"
              min={4}
              max={30}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Context */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Lookbehind: {lookbehind}
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={lookbehind}
                onChange={(e) => setLookbehind(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Lookahead: {lookahead}
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={lookahead}
                onChange={(e) => setLookahead(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Tone preference (optional)
            </label>
            <input
              type="text"
              value={tonePreference}
              onChange={(e) => setTonePreference(e.target.value)}
              placeholder="e.g., informal, formal, neutral"
              className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  )
}
