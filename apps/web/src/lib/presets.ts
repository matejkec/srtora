import type { QualityModeId } from '@srtora/types'

/** UI preset IDs map directly to quality mode IDs */
export type PresetId = QualityModeId

export interface PresetConfig {
  id: PresetId
  label: string
  description: string
  enableAnalysis: boolean
  enableReview: boolean
  lookbehind: number
  lookahead: number
}

export const PRESETS: Record<PresetId, PresetConfig> = {
  fast: {
    id: 'fast',
    label: 'Fast',
    description: 'Quick translation without analysis or review',
    enableAnalysis: false,
    enableReview: false,
    lookbehind: 2,
    lookahead: 1,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Analysis + translation with light review',
    enableAnalysis: true,
    enableReview: true,
    lookbehind: 3,
    lookahead: 3,
  },
  'high-quality': {
    id: 'high-quality',
    label: 'High Quality',
    description: 'Smaller chunks with multi-pass review for precision',
    enableAnalysis: true,
    enableReview: true,
    lookbehind: 5,
    lookahead: 5,
  },
  maximum: {
    id: 'maximum',
    label: 'Maximum',
    description: 'Full pipeline with terminology enforcement and consistency validation',
    enableAnalysis: true,
    enableReview: true,
    lookbehind: 7,
    lookahead: 5,
  },
}
