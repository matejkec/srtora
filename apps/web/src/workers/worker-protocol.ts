import type {
  PipelineConfig,
  ProgressEvent,
  TranslationResult,
  PipelineError,
} from '@srtora/types'

/** Messages from the main thread to the worker */
export type WorkerInMessage =
  | {
      type: 'start'
      config: PipelineConfig
      fileContent: string
      filename: string
    }
  | { type: 'cancel' }

/** Messages from the worker to the main thread */
export type WorkerOutMessage =
  | { type: 'progress'; event: ProgressEvent }
  | { type: 'result'; result: TranslationResult }
  | { type: 'error'; error: PipelineError }
