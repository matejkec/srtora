import type { SubtitleDocument } from '@srtora/types'
import { detectFormat } from './detect-format.js'
import { parseSrt } from './srt-parser.js'
import { parseVtt } from './vtt-parser.js'

/**
 * Unified parse entry point. Detects format and delegates to the appropriate parser.
 */
export function parse(content: string, filename: string): SubtitleDocument {
  const format = detectFormat(content, filename)

  switch (format) {
    case 'srt':
      return parseSrt(content, filename)
    case 'vtt':
      return parseVtt(content, filename)
  }
}
