'use client'

import { useTranslationStore } from '@/stores/translation-store'

export function ModelSelector() {
  const { availableModels, selectedModel, setSelectedModel, connectionStatus } =
    useTranslationStore()

  if (connectionStatus !== 'connected' || availableModels.length === 0) return null

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model</label>
      <select
        value={selectedModel}
        onChange={(e) => setSelectedModel(e.target.value)}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Select a model...</option>
        {availableModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.name}
            {model.parameterSize ? ` (${model.parameterSize})` : ''}
            {model.quantization ? ` [${model.quantization}]` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
