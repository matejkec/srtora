'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { generateOutputFilename } from '@/lib/format-utils'
import { Download, FileText } from 'lucide-react'

export function DownloadActions() {
  const { result, file, targetLanguage, bilingualOutput } = useTranslationStore()

  if (!result || !file) return null

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const outputFilename = generateOutputFilename(file.filename, targetLanguage)

  return (
    <div className="flex gap-3">
      <button
        onClick={() => downloadFile(result.outputContent, outputFilename)}
        className="flex-1 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        <Download className="h-4 w-4" />
        Download Translation
      </button>

      {bilingualOutput && result.bilingualContent && (
        <button
          onClick={() =>
            downloadFile(
              result.bilingualContent!,
              generateOutputFilename(file.filename, `${targetLanguage}.bilingual`),
            )
          }
          className="rounded-lg bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Bilingual
        </button>
      )}
    </div>
  )
}
