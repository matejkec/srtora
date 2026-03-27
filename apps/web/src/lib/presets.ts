export type PresetId = 'simple' | 'balanced' | 'quality' | 'advanced'

export interface PresetConfig {
  id: PresetId
  label: string
  description: string
  enableAnalysis: boolean
  enableReview: boolean
  chunkSize: number
  lookbehind: number
  lookahead: number
}

export const PRESETS: Record<PresetId, PresetConfig> = {
  simple: {
    id: 'simple',
    label: 'Simple',
    description: 'One model, fast translation',
    enableAnalysis: false,
    enableReview: false,
    chunkSize: 20,
    lookbehind: 2,
    lookahead: 2,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Analysis + translation with review',
    enableAnalysis: true,
    enableReview: true,
    chunkSize: 15,
    lookbehind: 3,
    lookahead: 3,
  },
  quality: {
    id: 'quality',
    label: 'Quality',
    description: 'Full pipeline with larger context',
    enableAnalysis: true,
    enableReview: true,
    chunkSize: 12,
    lookbehind: 5,
    lookahead: 5,
  },
  advanced: {
    id: 'advanced',
    label: 'Advanced',
    description: 'Full control over all settings',
    enableAnalysis: true,
    enableReview: true,
    chunkSize: 15,
    lookbehind: 3,
    lookahead: 3,
  },
}
