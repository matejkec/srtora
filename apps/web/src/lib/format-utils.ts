export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function generateOutputFilename(sourceFilename: string, targetLang: string): string {
  const lastDot = sourceFilename.lastIndexOf('.')
  if (lastDot === -1) return `${sourceFilename}.${targetLang}`
  const base = sourceFilename.substring(0, lastDot)
  const ext = sourceFilename.substring(lastDot)
  return `${base}.${targetLang}${ext}`
}
