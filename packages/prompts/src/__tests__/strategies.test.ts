import { describe, it, expect } from 'vitest'
import { DefaultStrategy } from '../strategies/default-strategy.js'
import { GemmaStrategy } from '../strategies/gemma-strategy.js'

describe('DefaultStrategy', () => {
  it('produces separate system and user messages', () => {
    const strategy = new DefaultStrategy()
    const messages = strategy.formatMessages('system content', 'user content')

    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'system', content: 'system content' })
    expect(messages[1]).toEqual({ role: 'user', content: 'user content' })
  })
})

describe('GemmaStrategy', () => {
  it('produces a single user message combining system and user content', () => {
    const strategy = new GemmaStrategy()
    const messages = strategy.formatMessages('system content', 'user content')

    expect(messages).toHaveLength(1)
    expect(messages[0]!.role).toBe('user')
    expect(messages[0]!.content).toContain('system content')
    expect(messages[0]!.content).toContain('user content')
  })

  it('does not include a system role message', () => {
    const strategy = new GemmaStrategy()
    const messages = strategy.formatMessages('system', 'user')

    expect(messages.every((m) => m.role !== 'system')).toBe(true)
  })
})
