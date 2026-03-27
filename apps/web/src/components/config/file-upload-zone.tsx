'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslationStore } from '@/stores/translation-store'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'

export function FileUploadZone() {
  const { file, setFile, clearFile, phase } = useTranslationStore()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isRunning = phase !== 'idle' && phase !== 'complete' && phase !== 'error' && phase !== 'cancelled'

  const handleFile = useCallback(
    async (f: File) => {
      setUploadError(null)
      const ext = f.name.toLowerCase().split('.').pop()
      if (ext !== 'srt' && ext !== 'vtt') {
        setUploadError('Invalid file type. Please upload an .srt or .vtt file.')
        return
      }

      const content = await f.text()

      // Quick validation
      const format = content.trimStart().startsWith('WEBVTT') ? 'vtt' : 'srt'

      // Count cues (rough estimate)
      let cueCount = 0
      if (format === 'srt') {
        const matches = content.match(/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/g)
        cueCount = matches?.length ?? 0
      } else {
        const matches = content.match(/(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}\s*-->\s*/g)
        cueCount = matches?.length ?? 0
      }

      setFile({
        filename: f.name,
        content,
        format: format as 'srt' | 'vtt',
        cueCount,
        fileSize: f.size,
      })
    },
    [setFile],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile],
  )

  if (file) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{file.filename}</p>
              <p className="text-xs text-muted-foreground">
                {file.format.toUpperCase()} &middot; {file.cueCount} cues &middot;{' '}
                {(file.fileSize / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={clearFile}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`
          rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : uploadError ? 'border-destructive/50' : 'border-border hover:border-muted-foreground'}
        `}
      >
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Drop subtitle file here</p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports .srt and .vtt files
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".srt,.vtt"
          onChange={onChange}
          className="hidden"
        />
      </div>
      {uploadError && (
        <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {uploadError}
        </div>
      )}
    </>
  )
}
