import type { AgentMessage } from '../types/index.js'

/**
 * ContextBuffer manages the conversation history that should be passed to an LLM.
 * It handles windowing, priority, and token-aware trimming.
 */
export class ContextBuffer {
    private messages: AgentMessage[] = []
    private maxTokens: number
    private maxMessages: number

    constructor(config: { maxMessages?: number, maxTokens?: number } = {}) {
        this.maxMessages = config.maxMessages || 50
        this.maxTokens = config.maxTokens || 4000
    }

    /**
     * Add a single message to the buffer.
     */
    addMessage(message: AgentMessage): void {
        this.messages.push(message)
        this.trimBuffer()
    }

    /**
     * Set the entire message collection (e.g. after resuming a session).
     */
    setMessages(messages: AgentMessage[]): void {
        this.messages = [...messages]
        this.trimBuffer()
    }

    /**
     * Clear all messages from the buffer.
     */
    clear(): void {
        this.messages = []
    }

    /**
     * Get the current context window limited by message count and token approximation.
     * Always attempts to preserve the 'system' message if it's the first message.
     */
    getWindow(options: { maxTokens?: number, maxMessages?: number } = {}): AgentMessage[] {
        const tokenLimit = options.maxTokens || this.maxTokens
        const messageLimit = options.maxMessages || this.maxMessages

        const systemMessage = this.messages.length > 0 && this.messages[0].role === 'system' 
            ? this.messages[0] 
            : null

        const otherMessages = systemMessage ? this.messages.slice(1) : this.messages
        
        let result: AgentMessage[] = []
        let currentTokens = systemMessage ? this.estimateTokens(systemMessage.content) : 0
        const effectiveMessageLimit = systemMessage ? messageLimit - 1 : messageLimit

        // Work backwards from the most recent messages
        for (let i = otherMessages.length - 1; i >= 0; i--) {
            const msg = otherMessages[i]
            const tokens = this.estimateTokens(msg.content)

            if (result.length < effectiveMessageLimit && (currentTokens + tokens) <= tokenLimit) {
                result.unshift(msg)
                currentTokens += tokens
            } else {
                break
            }
        }

        if (systemMessage) {
            result.unshift(systemMessage)
        }

        return result
    }

    /**
     * Generate a prompt-ready string from the context.
     */
    toPromptString(limit?: number): string {
        return this.getWindow({ maxMessages: limit })
            .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n\n')
    }

    /**
     * Helper to identify if the buffer is becoming too large.
     */
    shouldSummarize(tokenThreshold?: number): boolean {
        const threshold = tokenThreshold || (this.maxTokens * 0.8)
        return this.getTotalTokens() > threshold
    }

    /**
     * Get current buffer statistics.
     */
    getUsageStats() {
        return {
            messageCount: this.messages.length,
            totalTokens: this.getTotalTokens(),
            maxTokens: this.maxTokens,
            maxMessages: this.maxMessages
        }
    }

    private getTotalTokens(): number {
        return this.messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0)
    }

    private trimBuffer(): void {
        // We keep a bit more than maxMessages to allow windowing to work
        if (this.messages.length > this.maxMessages * 2) {
            const systemMessage = this.messages[0]?.role === 'system' ? this.messages[0] : null
            const keepCount = this.maxMessages
            this.messages = this.messages.slice(-keepCount)
            if (systemMessage && this.messages[0] !== systemMessage) {
                this.messages.unshift(systemMessage)
            }
        }
    }

    private estimateTokens(content: string): number {
        // Rough approximation: 4 characters per token
        return Math.ceil((content || '').length / 4)
    }
}
