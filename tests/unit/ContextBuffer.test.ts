import { describe, it, expect, beforeEach } from '@jest/globals'
import { ContextBuffer } from '../../src/agentic/ContextBuffer.js'
import { AgentMessage } from '../../src/types/index.js'

describe('ContextBuffer', () => {
    let buffer: ContextBuffer

    beforeEach(() => {
        buffer = new ContextBuffer({ maxMessages: 5, maxTokens: 100 })
    })

    const createMsg = (role: AgentMessage['role'], content: string): AgentMessage => ({
        id: Math.random(),
        sessionId: 1,
        role,
        content,
        createdAt: new Date()
    })

    it('should respect message limits', () => {
        buffer.addMessage(createMsg('system', 'System prompt'))
        buffer.addMessage(createMsg('user', '1'))
        buffer.addMessage(createMsg('assistant', '2'))
        buffer.addMessage(createMsg('user', '3'))
        buffer.addMessage(createMsg('assistant', '4'))
        buffer.addMessage(createMsg('user', '5'))

        const win = buffer.getWindow()
        expect(win).toHaveLength(5)
        expect(win[0].role).toBe('system') // System should be preserved
        expect(win[4].content).toBe('5') // Most recent should be included
    })

    it('should respect token limits', () => {
        buffer = new ContextBuffer({ maxTokens: 10 }) // ~40 chars
        buffer.addMessage(createMsg('system', 'SYS')) // ~1 token
        buffer.addMessage(createMsg('user', 'This is a long message that exceeds limit')) // ~10 tokens
        buffer.addMessage(createMsg('assistant', 'Short')) // ~2 tokens

        const win = buffer.getWindow()
        expect(win[0].role).toBe('system')
        expect(win).toHaveLength(2) // System + Short (long user message was skipped)
        expect(win[1].content).toBe('Short')
    })

    it('should estimate tokens correctly', () => {
        const stats = buffer.getUsageStats()
        expect(stats.totalTokens).toBe(0)

        buffer.addMessage(createMsg('user', '12345678')) // 8 chars = 2 tokens
        expect(buffer.getUsageStats().totalTokens).toBe(2)
    })

    it('should generate prompt string', () => {
        buffer.addMessage(createMsg('user', 'Hello'))
        const str = buffer.toPromptString()
        expect(str).toContain('[USER]: Hello')
    })
})
