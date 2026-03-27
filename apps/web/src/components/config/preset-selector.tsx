'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { PRESETS, type PresetId } from '@/lib/presets'
import { Zap, Scale, Sparkles, Settings } from 'lucide-react'

const PRESET_ICONS: Record<PresetId, React.ReactNode> = {
  simple: <Zap className="h-4 w-4" />,
  balanced: <Scale className="h-4 w-4" />,
  quality: <Sparkles className="h-4 w-4" />,
  advanced: <Settings className="h-4 w-4" />,
}

export function PresetSelector() {
  const { preset, setPreset, file } = useTranslationStore()

  if (!file) return null

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-2 block">Preset</label>
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
            >
              {PRESET_ICONS[id]}
              <span className="text-xs font-medium">{config.label}</span>
            </button>
          ),
        )}
      </div>
    </div>
  )
}
