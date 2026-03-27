import type { SubtitleDocument } from '@srtora/types'

function formatSrtTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = ms % 1000

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    ',' +
    String(millis).padStart(3, '0')
  )
}

/**
 * Assembles a SubtitleDocument back into SRT format.
 * If translations map is provided, uses translated text; otherwise uses original rawText.
 */
export function assembleSrt(
  document: SubtitleDocument,
  translations?: Map<number, string>,
): string {
  const parts: string[] = []

  for (const cue of document.cues) {
    const text = translations?.get(cue.sequence) ?? cue.rawText
    parts.push(
      `${cue.sequence}\n` +
        `${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n` +
        `${text}\n`,
    )
  }

  return parts.join('\n')
}
