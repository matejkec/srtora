/**
 * Normalizes raw subtitle file content before parsing.
 * - Removes BOM (UTF-8, UTF-16 LE/BE)
 * - Normalizes line endings to \n
 * - Trims trailing whitespace on each line
 * - Ensures file ends with a newline
 */
export function normalizeContent(raw: string): string {
  // Remove BOM characters
  let content = raw.replace(/^\uFEFF/, '').replace(/^\uFFFE/, '')

  // Normalize all line ending styles to \n
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Trim trailing whitespace on each line
  content = content
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')

  // Ensure file ends with a newline
  if (!content.endsWith('\n')) {
    content += '\n'
  }

  return content
}
