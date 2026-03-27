import { z } from 'zod'
import { SubtitleDocumentSchema } from './subtitle.js'
import { SessionMemorySchema } from './analysis.js'

export const TranslatedItemSchema = z.object({
  /** Must match the cue sequence number from the source document */
  id: z.number().int().positive(),
  /** Translated text, preserving line breaks and formatting tags */
  text: z.string(),
})
export type TranslatedItem = z.infer<typeof TranslatedItemSchema>

export const ChunkTranslationResultSchema = z.object({
  chunkId: z.string(),
  items: z.array(TranslatedItemSchema),
  warnings: z.array(z.string()).default([]),
  repairCount: z.number().int().nonnegative().default(0),
})
export type ChunkTranslationResult = z.infer<typeof ChunkTranslationResultSchema>

export const TranslationResultSchema = z.object({
  /** The translated document with target text */
  document: SubtitleDocumentSchema,
  /** Session memory extracted during analysis */
  sessionMemory: SessionMemorySchema.optional(),
  /** Individual chunk results for diagnostics */
  chunks: z.array(ChunkTranslationResultSchema),
  /** All accumulated warnings */
  warnings: z.array(z.string()),
  /** The final assembled output string (SRT or VTT content) */
  outputContent: z.string(),
  /** Bilingual output string if requested */
  bilingualContent: z.string().optional(),
  /** Pipeline statistics */
  stats: z.object({
    totalChunks: z.number(),
    totalRetries: z.number(),
    totalDurationMs: z.number(),
    phaseDurations: z.record(z.string(), z.number()),
  }),
})
export type TranslationResult = z.infer<typeof TranslationResultSchema>
