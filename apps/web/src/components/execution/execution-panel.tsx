'use client'

import { useTranslationStore } from '@/stores/translation-store'
import { usePipelineRunner } from '@/hooks/use-pipeline-runner'
import { ProgressCard } from './progress-card'
import { ContextPanel } from './context-panel'
import { ResultSummary } from './result-summary'
import { DownloadActions } from './download-actions'
import { ErrorDisplay } from './error-display'
import { DiagnosticsExport } from './diagnostics-export'
import { Languages, FileText } from 'lucide-react'

export function ExecutionPanel() {
  usePipelineRunner()
  const { phase, file } = useTranslationStore()

  const isIdle = phase === 'idle'
  const isRunning = !['idle', 'complete', 'error', 'cancelled'].includes(phase)
  const isComplete = phase === 'complete'
  const isError = phase === 'error' || phase === 'cancelled'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {isIdle && !file && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Languages className="h-16 w-16 text-muted-foreground/30 mb-6" />
          <h2 className="text-xl font-semibold mb-2">Ready to translate</h2>
          <p className="text-muted-foreground max-w-md">
            Upload a subtitle file (.srt or .vtt), connect to your local AI provider,
            and start translating with high-quality, context-aware results.
          </p>
        </div>
      )}

      {isIdle && file && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <FileText className="h-16 w-16 text-primary/30 mb-6" />
          <h2 className="text-xl font-semibold mb-2">File loaded</h2>
          <p className="text-muted-foreground max-w-md">
            Configure your translation settings and click Translate to begin.
          </p>
        </div>
      )}

      {isRunning && (
        <div className="space-y-4">
          <ProgressCard />
          <ContextPanel />
        </div>
      )}

      {isComplete && (
        <div className="space-y-4">
          <ResultSummary />
          <ContextPanel />
          <DownloadActions />
          <DiagnosticsExport />
        </div>
      )}

      {isError && (
        <div className="space-y-4">
          <ErrorDisplay />
          <DiagnosticsExport />
        </div>
      )}
    </div>
  )
}
