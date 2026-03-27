import { z } from 'zod'

export const GenderSchema = z.enum(['male', 'female', 'non-binary', 'unknown'])
export type Gender = z.infer<typeof GenderSchema>

export const SpeakerMemorySchema = z.object({
  id: z.string(),
  label: z.string(),
  aliases: z.array(z.string()).default([]),
  gender: GenderSchema.default('unknown'),
  genderConfidence: z.number().min(0).max(1).default(0),
  register: z.string().optional(),
  notes: z.string().optional(),
})
export type SpeakerMemory = z.infer<typeof SpeakerMemorySchema>

export const TermEntrySchema = z.object({
  source: z.string(),
  target: z.string(),
  note: z.string().optional(),
})
export type TermEntry = z.infer<typeof TermEntrySchema>

export const SessionMemorySchema = z.object({
  speakers: z.array(SpeakerMemorySchema).default([]),
  terms: z.array(TermEntrySchema).default([]),
  warnings: z.array(z.string()).default([]),
  toneProfile: z.string().optional(),
  genreHint: z.string().optional(),
})
export type SessionMemory = z.infer<typeof SessionMemorySchema>
