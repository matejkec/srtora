'use client'

import { useRef, useCallback, useEffect } from 'react'
import { useTranslationStore } from '@/stores/translation-store'
import type { PipelineConfig } from '@srtora/types'
import type { WorkerInMessage, WorkerOutMessage } from '@/workers/worker-protocol'

export function usePipelineWorker() {
  const workerRef = useRef<Worker | null>(null)
  const store = useTranslationStore

  const start = useCallback(
    (config: PipelineConfig, fileContent: string, filename: string) => {
      // Clean up any existing worker
      workerRef.current?.terminate()

      const worker = new Worker(
        new URL('../workers/pipeline.worker.ts', import.meta.url),
        { type: 'module' },
      )

      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data

        switch (msg.type) {
          case 'progress':
            store.getState().updateProgress(msg.event)
            break
          case 'result':
            store.getState().completeTranslation(msg.result)
            worker.terminate()
            workerRef.current = null
            break
          case 'error':
            store.getState().failTranslation(msg.error)
            worker.terminate()
            workerRef.current = null
            break
        }
      }

      worker.onerror = (error) => {
        store.getState().failTranslation({
          code: 'PIPELINE_ERROR',
          message: error.message || 'Worker error',
          recoverable: false,
        })
        worker.terminate()
        workerRef.current = null
      }

      workerRef.current = worker

      const message: WorkerInMessage = {
        type: 'start',
        config,
        fileContent,
        filename,
      }
      worker.postMessage(message)

      store.getState().startTranslation()
    },
    [],
  )

  const cancel = useCallback(() => {
    if (workerRef.current) {
      const message: WorkerInMessage = { type: 'cancel' }
      workerRef.current.postMessage(message)
      // Give it a moment to clean up, then terminate
      setTimeout(() => {
        workerRef.current?.terminate()
        workerRef.current = null
      }, 1000)
      store.getState().cancelTranslation()
    }
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  return { start, cancel }
}
