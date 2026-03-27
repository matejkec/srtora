import { PipelineOrchestrator } from '@srtora/pipeline'
import { PipelineException } from '@srtora/types'
import type { WorkerInMessage, WorkerOutMessage } from './worker-protocol.js'

let abortController: AbortController | null = null

function postMsg(msg: WorkerOutMessage) {
  self.postMessage(msg)
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data

  if (msg.type === 'cancel') {
    abortController?.abort()
    return
  }

  if (msg.type === 'start') {
    abortController = new AbortController()

    const orchestrator = new PipelineOrchestrator(msg.config, {
      signal: abortController.signal,
    })

    try {
      const result = await orchestrator.run(msg.fileContent, msg.filename, {
        onProgress: (progressEvent) => {
          postMsg({ type: 'progress', event: progressEvent })
        },
      })
      postMsg({ type: 'result', result })
    } catch (error) {
      if (error instanceof PipelineException) {
        postMsg({ type: 'error', error: error.error })
      } else {
        postMsg({
          type: 'error',
          error: {
            code: 'PIPELINE_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            recoverable: false,
          },
        })
      }
    } finally {
      abortController = null
    }
  }
}
