import { describe, it, expect } from 'vitest'
import { ProgressTracker } from '../progress-tracker.js'
import type { ProgressEvent } from '@srtora/types'

describe('ProgressTracker', () => {
  it('emits progress events with correct phase', () => {
    const events: ProgressEvent[] = []
    const tracker = new ProgressTracker((e) => events.push(e))

    tracker.emit('parsing', { message: 'Parsing...' })
    tracker.emit('translating', { chunkIndex: 0, totalChunks: 5, phaseProgress: 0 })

    expect(events).toHaveLength(2)
    expect(events[0]!.phase).toBe('parsing')
    expect(events[1]!.phase).toBe('translating')
  })

  it('calculates percent based on phase weights', () => {
    const events: ProgressEvent[] = []
    const tracker = new ProgressTracker((e) => events.push(e))

    tracker.emit('parsing', { phaseProgress: 1 })
    // Parsing: 0-2%, phaseProgress=1 => 2%
    expect(events[0]!.percent).toBe(2)

    tracker.emit('translating', { phaseProgress: 0.5, chunkIndex: 2, totalChunks: 5 })
    // Translating: 15-85%, phaseProgress=0.5 => 50%
    expect(events[1]!.percent).toBe(50)
  })

  it('reports 100% on complete', () => {
    const events: ProgressEvent[] = []
    const tracker = new ProgressTracker((e) => events.push(e))

    tracker.emit('complete', { phaseProgress: 1 })
    expect(events[0]!.percent).toBe(100)
  })

  it('tracks warning count', () => {
    const events: ProgressEvent[] = []
    const tracker = new ProgressTracker((e) => events.push(e))

    tracker.addWarnings(2)
    tracker.addWarnings(1)
    tracker.emit('translating', {})

    expect(events[0]!.warningCount).toBe(3)
  })

  it('estimates ETA from chunk times', () => {
    const events: ProgressEvent[] = []
    const tracker = new ProgressTracker((e) => events.push(e))

    tracker.recordChunkTime(1000)
    tracker.recordChunkTime(1200)
    tracker.emit('translating', { chunkIndex: 1, totalChunks: 5, phaseProgress: 0.4 })

    // Should have an ETA since we have chunk times
    expect(events[0]!.etaMs).toBeDefined()
    expect(events[0]!.etaMs).toBeGreaterThan(0)
  })
})
