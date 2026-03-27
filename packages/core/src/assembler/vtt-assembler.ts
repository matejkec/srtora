import type { SubtitleDocument } from '@srtora/types'

function formatVttTimestamp(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = ms % 1000

  if (hours > 0) {
    return (
      String(hours).padStart(2, '0') +
      ':' +
      String(minutes).padStart(2, '0') +
      ':' +
      String(seconds).padStart(2, '0') +
      '.' +
      String(millis).padStart(3, '0')
    )
  }

  return (
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    '.' +
    String(millis).padStart(3, '0')
  )
}

/**
 * Assembles a SubtitleDocument back into WebVTT format.
 * Preserves STYLE blocks, REGION blocks, NOTE blocks, cue settings, and cue identifiers.
 */
export function assembleVtt(
  document: SubtitleDocument,
  translations?: Map<number, string>,
): string {
  const parts: string[] = []
  const meta = document.vttMetadata

  // Header
  let header = 'WEBVTT'
  if (meta?.headerText) {
    header += ' ' + meta.headerText
  }
  parts.push(header)
  parts.push('')

  // STYLE blocks
  if (meta?.styleBlocks) {
    for (const style of meta.styleBlocks) {
      parts.push('STYLE')
      parts.push(style)
      parts.push('')
    }
  }

  // REGION blocks
  if (meta?.regionBlocks) {
    for (const region of meta.regionBlocks) {
      parts.push('REGION')
      parts.push(region)
      parts.push('')
    }
  }

  // Header notes
  if (meta?.noteBlocks) {
    for (const note of meta.noteBlocks) {
      if (note.position === 'header') {
        parts.push('NOTE')
        parts.push(note.content)
        parts.push('')
      }
    }
  }

  // Cues
  for (const cue of document.cues) {
    // Check for inline notes that appear after this cue's predecessor
    if (meta?.noteBlocks) {
      for (const note of meta.noteBlocks) {
        if (typeof note.position === 'number' && note.position === cue.sequence - 1) {
          parts.push('NOTE')
          parts.push(note.content)
          parts.push('')
        }
      }
    }

    // Cue identifier
    const identifier = meta?.cueIdentifiers?.[String(cue.sequence)]
    if (identifier) {
      parts.push(identifier)
    }

    // Timing line with optional settings
    const settings = meta?.cueSettings?.[String(cue.sequence)]
    const startTs = formatVttTimestamp(cue.startMs)
    const endTs = formatVttTimestamp(cue.endMs)
    let timingLine = `${startTs} --> ${endTs}`
    if (settings) {
      timingLine += ' ' + settings
    }
    parts.push(timingLine)

    // Text
    const text = translations?.get(cue.sequence) ?? cue.rawText
    parts.push(text)
    parts.push('')
  }

  // Trailing notes (after last cue)
  if (meta?.noteBlocks) {
    for (const note of meta.noteBlocks) {
      if (typeof note.position === 'number' && note.position >= document.cueCount) {
        parts.push('NOTE')
        parts.push(note.content)
        parts.push('')
      }
    }
  }

  return parts.join('\n')
}
