import type { SubtitleCue, SubtitleDocument, VttMetadata } from '@srtora/types'
import { normalizeContent } from './normalize.js'
import { extractTags } from './tags.js'

const VTT_TIMING_LINE =
  /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})(.*)?$/

function parseVttTimestamp(h: string | undefined, m: string, s: string, ms: string): number {
  const hours = h ? parseInt(h, 10) : 0
  return hours * 3600000 + parseInt(m, 10) * 60000 + parseInt(s, 10) * 1000 + parseInt(ms, 10)
}

/**
 * Parses a WebVTT file into a SubtitleDocument.
 */
export function parseVtt(content: string, filename: string): SubtitleDocument {
  const normalized = normalizeContent(content)
  const lines = normalized.split('\n')

  // Validate WEBVTT header
  if (!lines[0] || !lines[0].startsWith('WEBVTT')) {
    throw new Error('Invalid WebVTT file: missing WEBVTT header')
  }

  const headerText = lines[0].length > 6
    ? lines[0].substring(6).trimStart()
    : ''

  const cues: SubtitleCue[] = []
  const metadata: VttMetadata = {
    headerText,
    styleBlocks: [],
    regionBlocks: [],
    noteBlocks: [],
    cueSettings: {},
    cueIdentifiers: {},
  }

  let i = 1 // Skip WEBVTT line
  let sequenceCounter = 0
  let headerSectionDone = false

  // Skip blank lines after header
  while (i < lines.length && lines[i]!.trim() === '') {
    i++
  }

  while (i < lines.length) {
    const line = lines[i]!

    // Skip blank lines
    if (line.trim() === '') {
      i++
      continue
    }

    // NOTE block
    if (line.startsWith('NOTE')) {
      const noteContent: string[] = []
      // Single line note: "NOTE text"
      if (line.length > 4 && (line[4] === ' ' || line[4] === '\t')) {
        noteContent.push(line.substring(5))
      }
      i++
      // Collect until blank line
      while (i < lines.length && lines[i]!.trim() !== '') {
        noteContent.push(lines[i]!)
        i++
      }
      metadata.noteBlocks.push({
        position: headerSectionDone ? sequenceCounter : 'header',
        content: noteContent.join('\n'),
      })
      continue
    }

    // STYLE block (must be before any cue)
    if (line === 'STYLE' && !headerSectionDone) {
      i++
      const styleLines: string[] = []
      while (i < lines.length && lines[i]!.trim() !== '') {
        styleLines.push(lines[i]!)
        i++
      }
      metadata.styleBlocks.push(styleLines.join('\n'))
      continue
    }

    // REGION block (must be before any cue)
    if (line === 'REGION' && !headerSectionDone) {
      i++
      const regionLines: string[] = []
      while (i < lines.length && lines[i]!.trim() !== '') {
        regionLines.push(lines[i]!)
        i++
      }
      metadata.regionBlocks.push(regionLines.join('\n'))
      continue
    }

    // Try to parse as cue
    headerSectionDone = true

    // Check if current line is a timing line
    let timingMatch = line.match(VTT_TIMING_LINE)
    let cueIdentifier: string | undefined

    if (!timingMatch) {
      // Current line might be a cue identifier
      // A cue identifier is any line that doesn't contain "-->"
      if (!line.includes('-->')) {
        cueIdentifier = line.trim()
        i++
        if (i >= lines.length) break
        timingMatch = lines[i]!.match(VTT_TIMING_LINE)
      }
    }

    if (timingMatch) {
      sequenceCounter++
      const startMs = parseVttTimestamp(timingMatch[1], timingMatch[2]!, timingMatch[3]!, timingMatch[4]!)
      const endMs = parseVttTimestamp(timingMatch[5], timingMatch[6]!, timingMatch[7]!, timingMatch[8]!)
      const settings = timingMatch[9]?.trim() || ''

      if (settings) {
        metadata.cueSettings[String(sequenceCounter)] = settings
      }
      if (cueIdentifier) {
        metadata.cueIdentifiers[String(sequenceCounter)] = cueIdentifier
      }

      i++

      // Collect text lines until blank line or EOF
      const textLines: string[] = []
      while (i < lines.length && lines[i]!.trim() !== '') {
        textLines.push(lines[i]!)
        i++
      }

      const rawText = textLines.join('\n')
      const { plainText, tags } = extractTags(rawText, 'vtt')

      cues.push({
        sequence: sequenceCounter,
        startMs,
        endMs,
        rawText,
        textLines: [...textLines],
        plainText,
        inlineTags: tags,
      })
    } else {
      // Unrecognized line, skip
      i++
    }
  }

  return {
    format: 'vtt',
    sourceFilename: filename,
    cues,
    vttMetadata: metadata,
    cueCount: cues.length,
  }
}
