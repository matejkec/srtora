import type { PipelinePhase, ProgressEvent } from '@srtora/types'

/** Weighted phase percentages — these should sum to 100 */
const PHASE_WEIGHTS: Partial<Record<PipelinePhase, { start: number; end: number }>> = {
  parsing: { start: 0, end: 2 },
  analyzing: { start: 2, end: 15 },
  translating: { start: 15, end: 85 },
  reviewing: { start: 85, end: 95 },
  assembling: { start: 95, end: 100 },
}

export class ProgressTracker {
  private startTime: number
  private chunkTimes: number[] = []
  private onProgress: (event: ProgressEvent) => void
  private warningCount = 0

  constructor(onProgress: (event: ProgressEvent) => void) {
    this.startTime = Date.now()
    this.onProgress = onProgress
  }

  /** Emit progress for a phase with optional chunk info */
  emit(phase: PipelinePhase, options?: {
    chunkIndex?: number
    totalChunks?: number
    phaseProgress?: number
    message?: string
  }) {
    const elapsedMs = Date.now() - this.startTime
    const weights = PHASE_WEIGHTS[phase]

    let percent = 0
    if (weights) {
      const phaseProgress = options?.phaseProgress ?? 0
      percent = weights.start + (weights.end - weights.start) * phaseProgress
    }
    if (phase === 'complete') percent = 100

    const event: ProgressEvent = {
      phase,
      percent: Math.round(percent * 10) / 10,
      elapsedMs,
      warningCount: this.warningCount,
      ...(options?.chunkIndex !== undefined && { chunkIndex: options.chunkIndex }),
      ...(options?.totalChunks !== undefined && { totalChunks: options.totalChunks }),
      ...(options?.message && { message: options.message }),
    }

    // ETA estimation using exponential moving average of chunk durations
    if (phase === 'translating' && options?.chunkIndex !== undefined && options?.totalChunks) {
      const etaMs = this.estimateEta(options.chunkIndex, options.totalChunks)
      if (etaMs !== undefined) {
        event.etaMs = etaMs
      }
    }

    this.onProgress(event)
  }

  recordChunkTime(durationMs: number) {
    this.chunkTimes.push(durationMs)
  }

  addWarnings(count: number) {
    this.warningCount += count
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime
  }

  private estimateEta(currentChunk: number, totalChunks: number): number | undefined {
    if (this.chunkTimes.length === 0) return undefined

    // Exponential moving average of recent chunk times
    const alpha = 0.3
    let ema = this.chunkTimes[0]!
    for (let i = 1; i < this.chunkTimes.length; i++) {
      ema = alpha * this.chunkTimes[i]! + (1 - alpha) * ema
    }

    const remainingChunks = totalChunks - currentChunk - 1
    if (remainingChunks <= 0) return 0

    // Add estimates for review and assemble phases (~15% of total)
    const translationRemaining = ema * remainingChunks
    const reviewEstimate = translationRemaining * 0.12
    const assembleEstimate = translationRemaining * 0.06

    return Math.round(translationRemaining + reviewEstimate + assembleEstimate)
  }
}
