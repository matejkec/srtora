/**
 * JSON schema for review structured output enforcement.
 * Matches the ReviewResult shape from @srtora/types.
 */
export const reviewOutputSchema = {
  type: 'object' as const,
  properties: {
    corrections: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'number' as const },
          text: { type: 'string' as const },
        },
        required: ['id', 'text'],
      },
    },
    warnings: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
  },
  required: ['corrections'],
}
