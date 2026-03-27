import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@srtora/types': resolve(__dirname, '../types/src'),
    },
  },
  test: {
    include: ['src/__tests__/**/*.test.ts'],
  },
})
