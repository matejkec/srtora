import type { SubtitleDocument } from '@srtora/types'
import { assembleSrt } from './srt-assembler.js'
import { assembleVtt } from './vtt-assembler.js'

/**
 * Creates bilingual output with source + translated text in each cue.
 * Source text appears first, then a blank line, then translated text.
 */
export function assembleBilingual(
  document: SubtitleDocument,
  translations: Map<number, string>,
  options?: { separator?: string },
): string {
  const separator = options?.separator ?? '\n'

  const bilingualTranslations = new Map<number, string>()
  for (const cue of document.cues) {
    const translated = translations.get(cue.sequence)
    if (translated) {
      bilingualTranslations.set(cue.sequence, `${cue.rawText}${separator}${translated}`)
    } else {
      bilingualTranslations.set(cue.sequence, cue.rawText)
    }
  }

  switch (document.format) {
    case 'srt':
      return assembleSrt(document, bilingualTranslations)
    case 'vtt':
      return assembleVtt(document, bilingualTranslations)
  }
}
