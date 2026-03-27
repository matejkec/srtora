import type { SubtitleFormat } from '@srtora/types'

/**
 * Detects the subtitle file format based on content and filename.
 *
 * VTT files must start with "WEBVTT" (after optional BOM).
 * SRT files are the default fallback.
 */
export function detectFormat(content: string, filename: string): SubtitleFormat {
  // Strip BOM for detection
  const stripped = content.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '')
  const trimmed = stripped.trimStart()

  if (trimmed.startsWith('WEBVTT')) {
    return 'vtt'
  }

  // Check file extension as secondary signal
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'vtt') {
    return 'vtt'
  }

  return 'srt'
}
