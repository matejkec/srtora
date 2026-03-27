/**
 * JSON schema for analysis structured output enforcement.
 * Matches the SessionMemory shape from @srtora/types.
 */
export const analysisOutputSchema = {
  type: 'object' as const,
  properties: {
    speakers: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const },
          label: { type: 'string' as const },
          gender: {
            type: 'string' as const,
            enum: ['male', 'female', 'non-binary', 'unknown'],
          },
          genderConfidence: { type: 'number' as const },
          register: { type: 'string' as const },
          notes: { type: 'string' as const },
        },
        required: ['id', 'label', 'gender', 'genderConfidence'],
      },
    },
    terms: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          source: { type: 'string' as const },
          target: { type: 'string' as const },
          note: { type: 'string' as const },
        },
        required: ['source', 'target'],
      },
    },
    warnings: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    toneProfile: { type: 'string' as const },
    genreHint: { type: 'string' as const },
  },
  required: ['speakers', 'terms', 'warnings'],
}
