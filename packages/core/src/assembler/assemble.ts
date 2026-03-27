import type { SubtitleDocument } from '@srtora/types'
import { assembleSrt } from './srt-assembler.js'
import { assembleVtt } from './vtt-assembler.js'

/**
 * Unified assemble entry point. Delegates to format-specific assembler.
 */
export function assemble(
  document: SubtitleDocument,
  translations?: Map<number, string>,
): string {
  switch (document.format) {
    case 'srt':
      return assembleSrt(document, translations)
    case 'vtt':
      return assembleVtt(document, translations)
  }
}
