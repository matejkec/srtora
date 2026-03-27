import { z } from 'zod'
import { SpeakerMemorySchema, TermEntrySchema } from './analysis.js'

export const StoredTermSchema = TermEntrySchema.extend({
  /** Number of times this term mapping has been confirmed/used */
  confidence: z.number().int().nonnegative().default(1),
  /** When this term was first added */
  createdAt: z.string().datetime(),
  /** When this term was last used/confirmed */
  updatedAt: z.string().datetime(),
  /** Language pair identifier, e.g. "en->hr" */
  languagePair: z.string(),
})
export type StoredTerm = z.infer<typeof StoredTermSchema>

export const StoredSpeakerSchema = SpeakerMemorySchema.extend({
  /** Source files this speaker was detected in */
  sourceFiles: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type StoredSpeaker = z.infer<typeof StoredSpeakerSchema>

export const CorrectionEntrySchema = z.object({
  /** The cue's source text */
  sourceText: z.string(),
  /** The original bad translation */
  originalTranslation: z.string(),
  /** The corrected translation */
  correctedTranslation: z.string(),
  /** Reason for correction if available */
  reason: z.string().optional(),
  /** Language pair identifier, e.g. "en->hr" */
  languagePair: z.string(),
  createdAt: z.string().datetime(),
})
export type CorrectionEntry = z.infer<typeof CorrectionEntrySchema>

export const TranslationMemorySchema = z.object({
  version: z.number().int().default(1),
  terms: z.array(StoredTermSchema).default([]),
  speakers: z.array(StoredSpeakerSchema).default([]),
  corrections: z.array(CorrectionEntrySchema).default([]),
})
export type TranslationMemory = z.infer<typeof TranslationMemorySchema>
