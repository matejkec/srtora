import type { QualityModeId, QualityModeConfig } from '@srtora/types'
import { QUALITY_MODES } from '@srtora/pipeline'

// Re-export quality mode types for the UI layer
export type PresetId = QualityModeId

export type { QualityModeConfig as PresetConfig }

/**
 * Quality mode presets, re-exported from the pipeline package.
 * Maps: fast, balanced, high-quality, maximum
 */
export const PRESETS: Record<PresetId, QualityModeConfig> = QUALITY_MODES

/**
 * Backward-compatible migration from legacy preset IDs to quality mode IDs.
 * Old presets: simple → fast, balanced → balanced, quality → high-quality, advanced → maximum
 */
export function migratePresetId(legacyId: string): PresetId {
  const migration: Record<string, PresetId> = {
    simple: 'fast',
    balanced: 'balanced',
    quality: 'high-quality',
    advanced: 'maximum',
  }
  return migration[legacyId] ?? (legacyId as PresetId)
}
