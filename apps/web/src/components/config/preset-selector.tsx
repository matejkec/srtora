'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { PRESETS, type PresetId } from '@/lib/presets'
import { Zap, Scale, Sparkles, Crown } from 'lucide-react'

const PRESET_ICONS: Record<PresetId, React.ReactNode> = {
  fast: <Zap className="h-4 w-4" />,
  balanced: <Scale className="h-4 w-4" />,
  'high-quality': <Sparkles className="h-4 w-4" />,
  maximum: <Crown className="h-4 w-4" />,
}

export function PresetSelector() {
  const { preset, setPreset, file } = useTranslationStore()

  if (!file) return null

  const selectedConfig = PRESETS[preset]

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-2 block">Quality Mode</label>
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(PRESETS) as [PresetId, (typeof PRESETS)[PresetId]][]).map(
          ([id, config]) => (
            <button
              key={id}
              onClick={() => setPreset(id)}
              className={`
                flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors
                ${
                  preset === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-muted-foreground'
                }
              `}
              title={config.description}
            >
              {PRESET_ICONS[id]}
              <span className="text-xs font-medium">{config.label}</span>
            </button>
          ),
        )}
      </div>
      {selectedConfig && (
        <p className="text-xs text-muted-foreground mt-2">{selectedConfig.description}</p>
      )}
    </div>
  )
}
