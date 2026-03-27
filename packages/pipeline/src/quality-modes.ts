import type { QualityModeId, QualityModeConfig } from '@srtora/types'

/**
 * Quality mode definitions.
 *
 * Each mode represents a different trade-off between speed and translation quality.
 * All modes use adaptive chunk sizing by default to optimize for the model's context window.
 */
export const QUALITY_MODES: Record<QualityModeId, QualityModeConfig> = {
  fast: {
    id: 'fast',
    label: 'Fast',
    description: 'Quick translation without analysis or review',
    enableAnalysis: false,
    enableReview: false,
    reviewPasses: 0,
    chunkSizingStrategy: 'adaptive',
    contextUsageTarget: 0.8,
    lookbehind: 2,
    lookahead: 1,
    maxRetries: 1,
    enforceTerminology: false,
    validateSpeakerConsistency: false,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Analysis + translation with light review',
    enableAnalysis: true,
    enableReview: true,
    reviewPasses: 1,
    chunkSizingStrategy: 'adaptive',
    contextUsageTarget: 0.6,
    lookbehind: 3,
    lookahead: 3,
    maxRetries: 2,
    enforceTerminology: false,
    validateSpeakerConsistency: false,
  },
  'high-quality': {
    id: 'high-quality',
    label: 'High Quality',
    description: 'Smaller chunks with multi-pass review for precision',
    enableAnalysis: true,
    enableReview: true,
    reviewPasses: 2,
    chunkSizingStrategy: 'adaptive',
    contextUsageTarget: 0.5,
    lookbehind: 5,
    lookahead: 5,
    maxRetries: 3,
    enforceTerminology: true,
    validateSpeakerConsistency: true,
  },
  maximum: {
    id: 'maximum',
    label: 'Maximum',
    description: 'Full pipeline with terminology enforcement and consistency validation',
    enableAnalysis: true,
    enableReview: true,
    reviewPasses: 3,
    chunkSizingStrategy: 'adaptive',
    contextUsageTarget: 0.4,
    lookbehind: 7,
    lookahead: 5,
    maxRetries: 3,
    enforceTerminology: true,
    validateSpeakerConsistency: true,
  },
}

/**
 * Get a quality mode config by ID.
 */
export function getQualityMode(id: QualityModeId): QualityModeConfig {
  return QUALITY_MODES[id]
}

/**
 * List all quality modes in order from fastest to highest quality.
 */
export function listQualityModes(): QualityModeConfig[] {
  return [
    QUALITY_MODES.fast,
    QUALITY_MODES.balanced,
    QUALITY_MODES['high-quality'],
    QUALITY_MODES.maximum,
  ]
}
