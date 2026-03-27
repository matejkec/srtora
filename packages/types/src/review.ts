import { z } from 'zod'

export const ReviewFlagSchema = z.object({
  cueSequence: z.number().int().positive(),
  reason: z.enum([
    'term_inconsistency',
    'length_issue',
    'gender_agreement',
    'proper_noun_inconsistency',
    'missing_tag',
    'empty_translation',
  ]),
  details: z.string(),
  sourceText: z.string(),
  currentTranslation: z.string(),
})
export type ReviewFlag = z.infer<typeof ReviewFlagSchema>

export const ReviewCorrectionSchema = z.object({
  id: z.number().int().positive(),
  text: z.string(),
})
export type ReviewCorrection = z.infer<typeof ReviewCorrectionSchema>

export const ReviewResultSchema = z.object({
  corrections: z.array(ReviewCorrectionSchema),
  warnings: z.array(z.string()).default([]),
})
export type ReviewResult = z.infer<typeof ReviewResultSchema>
