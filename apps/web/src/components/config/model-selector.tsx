'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { listSupportedModels } from '@srtora/adapters'
import type { ModelRegistryEntry } from '@srtora/types'
import type { AnnotatedModel } from '@srtora/adapters'
import { useMemo } from 'react'

/** Category display order and labels for cloud models */
const CLOUD_CATEGORY_ORDER = ['premium', 'balanced', 'budget'] as const
const CLOUD_CATEGORY_LABELS: Record<string, string> = {
  premium: 'Premium',
  balanced: 'Balanced',
  budget: 'Budget',
}

/** Category display order and labels for local (Ollama) models */
const LOCAL_CATEGORY_ORDER = ['local-translation', 'local-analysis'] as const
const LOCAL_CATEGORY_LABELS: Record<string, string> = {
  'local-translation': 'Translation Models',
  'local-analysis': 'Analysis Models',
}

function CloudModelSelector({
  providerType,
  selectedModel,
  onSelect,
}: {
  providerType: 'openai' | 'google' | 'anthropic'
  selectedModel: string
  onSelect: (id: string) => void
}) {
  const grouped = useMemo(() => {
    const models = listSupportedModels(providerType)
    const groups = new Map<string, ModelRegistryEntry[]>()
    for (const model of models) {
      const cat = model.category ?? 'other'
      const list = groups.get(cat) ?? []
      list.push(model)
      groups.set(cat, list)
    }
    return groups
  }, [providerType])

  return (
    <select
      value={selectedModel}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Select a model...</option>
      {CLOUD_CATEGORY_ORDER.map((cat) => {
        const models = grouped.get(cat)
        if (!models?.length) return null
        return (
          <optgroup key={cat} label={CLOUD_CATEGORY_LABELS[cat]}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName} — {m.description}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

function LocalModelSelector({
  annotatedModels,
  selectedModel,
  onSelect,
}: {
  annotatedModels: AnnotatedModel[]
  selectedModel: string
  onSelect: (id: string) => void
}) {
  const { supported, experimental } = useMemo(() => {
    const sup: AnnotatedModel[] = []
    const exp: AnnotatedModel[] = []
    for (const m of annotatedModels) {
      if (m.tier === 'supported') sup.push(m)
      else exp.push(m)
    }
    return { supported: sup, experimental: exp }
  }, [annotatedModels])

  const groupedSupported = useMemo(() => {
    const groups = new Map<string, AnnotatedModel[]>()
    for (const m of supported) {
      const cat = m.registryEntry?.category ?? 'other'
      const list = groups.get(cat) ?? []
      list.push(m)
      groups.set(cat, list)
    }
    return groups
  }, [supported])

  return (
    <select
      value={selectedModel}
      onChange={(e) => onSelect(e.target.value)}
      className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="">Select a model...</option>
      {LOCAL_CATEGORY_ORDER.map((cat) => {
        const models = groupedSupported.get(cat)
        if (!models?.length) return null
        return (
          <optgroup key={cat} label={LOCAL_CATEGORY_LABELS[cat]}>
            {models.map((m) => (
              <option key={m.modelInfo.id} value={m.modelInfo.id}>
                {m.displayName}
                {m.registryEntry?.description ? ` — ${m.registryEntry.description}` : ''}
                {m.modelInfo.parameterSize ? ` (${m.modelInfo.parameterSize})` : ''}
              </option>
            ))}
          </optgroup>
        )
      })}
      {experimental.length > 0 && (
        <optgroup label="Other detected models">
          {experimental.map((m) => (
            <option key={m.modelInfo.id} value={m.modelInfo.id}>
              {m.displayName}
              {m.modelInfo.parameterSize ? ` (${m.modelInfo.parameterSize})` : ''}
              {' — experimental'}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}

export function ModelSelector() {
  const {
    provider,
    availableModels,
    annotatedModels,
    selectedModel,
    setSelectedModel,
    connectionStatus,
  } = useTranslationStore()

  if (connectionStatus !== 'connected' || availableModels.length === 0 || !provider) return null

  const isCloud =
    provider.type === 'openai' || provider.type === 'google' || provider.type === 'anthropic'

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model</label>
      {isCloud ? (
        <CloudModelSelector
          providerType={provider.type as 'openai' | 'google' | 'anthropic'}
          selectedModel={selectedModel}
          onSelect={setSelectedModel}
        />
      ) : (
        <LocalModelSelector
          annotatedModels={annotatedModels}
          selectedModel={selectedModel}
          onSelect={setSelectedModel}
        />
      )}
    </div>
  )
}
