import type { SubtitleCue, SubtitleDocument } from '@srtora/types'
import { normalizeContent } from './normalize.js'
import { extractTags } from './tags.js'

/**
 * Timestamp regex for SRT: HH:MM:SS,mmm --> HH:MM:SS,mmm
 * Also accepts period as separator (common in malformed files).
 */
const TIMESTAMP_REGEX =
  /^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/

type ParserState = 'EXPECT_SEQUENCE' | 'EXPECT_TIMESTAMP' | 'COLLECT_TEXT'

function parseTimestamp(h: string, m: string, s: string, ms: string): number {
  return parseInt(h, 10) * 3600000 + parseInt(m, 10) * 60000 + parseInt(s, 10) * 1000 + parseInt(ms, 10)
}

/**
 * Parses an SRT file into a SubtitleDocument.
 * Uses a state machine: EXPECT_SEQUENCE -> EXPECT_TIMESTAMP -> COLLECT_TEXT -> (blank) -> repeat
 */
export function parseSrt(content: string, filename: string): SubtitleDocument {
  const normalized = normalizeContent(content)
  const lines = normalized.split('\n')

  const cues: SubtitleCue[] = []
  let state: ParserState = 'EXPECT_SEQUENCE'
  let currentSequence = 0
  let currentStartMs = 0
  let currentEndMs = 0
  let currentTextLines: string[] = []
  let sequenceCounter = 0
  let hasTimestamp = false

  function finalizeCue() {
    if (currentSequence > 0 && hasTimestamp) {
      const rawText = currentTextLines.join('\n')
      const { plainText, tags } = extractTags(rawText, 'srt')

      cues.push({
        sequence: currentSequence,
        startMs: currentStartMs,
        endMs: currentEndMs,
        rawText,
        textLines: [...currentTextLines],
        plainText,
        inlineTags: tags,
      })
    }
    currentSequence = 0
    currentStartMs = 0
    currentEndMs = 0
    currentTextLines = []
    hasTimestamp = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    switch (state) {
      case 'EXPECT_SEQUENCE': {
        // Skip blank lines
        if (line.trim() === '') continue

        // Check if this line is a sequence number
        const seqNum = parseInt(line.trim(), 10)
        if (!isNaN(seqNum) && seqNum > 0) {
          currentSequence = seqNum
          sequenceCounter++
          state = 'EXPECT_TIMESTAMP'
        } else {
          // Maybe this line is actually a timestamp (sequence number missing)
          const tsMatch = line.match(TIMESTAMP_REGEX)
          if (tsMatch) {
            sequenceCounter++
            currentSequence = sequenceCounter
            currentStartMs = parseTimestamp(tsMatch[1]!, tsMatch[2]!, tsMatch[3]!, tsMatch[4]!)
            currentEndMs = parseTimestamp(tsMatch[5]!, tsMatch[6]!, tsMatch[7]!, tsMatch[8]!)
            hasTimestamp = true
            state = 'COLLECT_TEXT'
          }
          // Otherwise skip the line (malformed, try to recover)
        }
        break
      }

      case 'EXPECT_TIMESTAMP': {
        const tsMatch = line.match(TIMESTAMP_REGEX)
        if (tsMatch) {
          currentStartMs = parseTimestamp(tsMatch[1]!, tsMatch[2]!, tsMatch[3]!, tsMatch[4]!)
          currentEndMs = parseTimestamp(tsMatch[5]!, tsMatch[6]!, tsMatch[7]!, tsMatch[8]!)
          hasTimestamp = true
          state = 'COLLECT_TEXT'
        } else if (line.trim() === '') {
          // Blank line where timestamp expected — reset, treat as garbage
          state = 'EXPECT_SEQUENCE'
        }
        // If non-blank non-timestamp, skip and stay in this state
        break
      }

      case 'COLLECT_TEXT': {
        if (line === '') {
          // Blank line: end of cue
          finalizeCue()
          state = 'EXPECT_SEQUENCE'
        } else {
          currentTextLines.push(line)
        }
        break
      }
    }
  }

  // Finalize last cue if file doesn't end with blank line
  finalizeCue()

  return {
    format: 'srt',
    sourceFilename: filename,
    cues,
    vttMetadata: null,
    cueCount: cues.length,
  }
}
