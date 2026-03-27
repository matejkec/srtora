import { z } from 'zod'

export const SubtitleFormatSchema = z.enum(['srt', 'vtt'])
export type SubtitleFormat = z.infer<typeof SubtitleFormatSchema>

export const SubtitleCueSchema = z.object({
  /** 1-based sequence number from original file */
  sequence: z.number().int().positive(),
  /** Start time in milliseconds */
  startMs: z.number().int().nonnegative(),
  /** End time in milliseconds */
  endMs: z.number().int().nonnegative(),
  /** Original raw text exactly as in file (with tags, line breaks as \n) */
  rawText: z.string(),
  /** Text split by line breaks within the cue */
  textLines: z.array(z.string()),
  /** Plain text with all formatting tags stripped (sent to LLM) */
  plainText: z.string(),
  /** Inline formatting tags found in this cue */
  inlineTags: z.array(z.string()),
})
export type SubtitleCue = z.infer<typeof SubtitleCueSchema>

export const VttMetadataSchema = z.object({
  /** Header text after "WEBVTT" (may be empty) */
  headerText: z.string().default(''),
  /** Raw STYLE blocks to preserve */
  styleBlocks: z.array(z.string()).default([]),
  /** Raw REGION definitions to preserve */
  regionBlocks: z.array(z.string()).default([]),
  /** NOTE blocks to preserve with position info */
  noteBlocks: z
    .array(
      z.object({
        position: z.union([z.literal('header'), z.number()]),
        content: z.string(),
      }),
    )
    .default([]),
  /** Cue settings (positioning) keyed by cue sequence number */
  cueSettings: z.record(z.string(), z.string()).default({}),
  /** Cue identifiers keyed by cue sequence number */
  cueIdentifiers: z.record(z.string(), z.string()).default({}),
})
export type VttMetadata = z.infer<typeof VttMetadataSchema>

export const SubtitleDocumentSchema = z.object({
  format: SubtitleFormatSchema,
  /** Original filename for output naming */
  sourceFilename: z.string(),
  cues: z.array(SubtitleCueSchema),
  /** VTT-specific metadata. Null for SRT files. */
  vttMetadata: VttMetadataSchema.nullable().default(null),
  /** Total cue count, stored separately for fast validation */
  cueCount: z.number().int().nonnegative(),
})
export type SubtitleDocument = z.infer<typeof SubtitleDocumentSchema>
