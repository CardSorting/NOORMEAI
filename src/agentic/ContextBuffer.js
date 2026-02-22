"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextBuffer = void 0;
/**
 * ContextBuffer manages the conversation history that should be passed to an LLM.
 * It handles windowing, priority, and token-aware trimming.
 */
class ContextBuffer {
    messages = [];
    maxTokens;
    maxMessages;
    constructor(config = {}) {
        this.maxMessages = config.maxMessages || 50;
        this.maxTokens = config.maxTokens || 4000;
    }
    /**
     * Add a single message to the buffer.
     */
    addMessage(message) {
        this.messages.push(message);
        // Incremental Trimming: Ensure health on every insertion
        this.trimBuffer();
    }
    /**
     * Set the entire message collection (e.g. after resuming a session).
     */
    setMessages(messages) {
        this.messages = messages;
        // Ensure health after bulk load
        this.trimBuffer();
    }
    /**
     * Clear all messages from the buffer.
     */
    clear() {
        this.messages = [];
    }
    /**
     * Get the current context window limited by message count and token approximation.
     * Always attempts to preserve the 'system' message if it's the first message.
     */
    getWindow(options = {}) {
        const tokenLimit = options.maxTokens || this.maxTokens;
        const messageLimit = options.maxMessages || this.maxMessages;
        const systemMessage = this.messages.length > 0 && this.messages[0].role === 'system'
            ? this.messages[0]
            : null;
        const otherMessages = systemMessage ? this.messages.slice(1) : this.messages;
        const effectiveLimit = systemMessage ? messageLimit - 1 : messageLimit;
        // Scored selection: Prioritize anchors, then recency
        const scored = otherMessages.map((m, index) => ({
            msg: m,
            index,
            isAnchor: !!m.metadata?.anchor,
            tokens: this.estimateTokens(m.content)
        }));
        const sortedForSelection = [...scored].sort((a, b) => {
            if (a.isAnchor !== b.isAnchor)
                return a.isAnchor ? -1 : 1;
            return b.index - a.index; // Recency tie-breaker
        });
        const selected = new Set();
        let currentTokens = systemMessage ? this.estimateTokens(systemMessage.content) : 0;
        for (const item of sortedForSelection) {
            if (selected.size < effectiveLimit && (currentTokens + item.tokens) <= tokenLimit) {
                selected.add(item.msg);
                currentTokens += item.tokens;
            }
        }
        // Maintain temporal order
        const result = this.messages.filter(m => m === systemMessage || selected.has(m));
        return result;
    }
    /**
     * Generate a prompt-ready string from the context.
     */
    toPromptString(limit) {
        return this.getWindow({ maxMessages: limit })
            .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
            .join('\n\n');
    }
    /**
     * Helper to identify if the buffer is becoming too large.
     */
    shouldSummarize(tokenThreshold) {
        const threshold = tokenThreshold || (this.maxTokens * 0.8);
        return this.getTotalTokens() > threshold;
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
        };
    }
    getTotalTokens() {
        return this.messages.reduce((sum, m) => sum + this.estimateTokens(m.content), 0);
    }
    trimBuffer() {
        // We keep a bit more than maxMessages to allow windowing to work
        if (this.messages.length > this.maxMessages * 1.5) {
            const systemMessage = this.messages[0]?.role === 'system' ? this.messages[0] : null;
            const initialCount = this.messages.length;
            // Importance Trimming: Prefer keeping 'anchor' messages or high-priority messages
            // We sort a copy to determine which ones to keep, then reconstruct in temporal order
            const otherMessages = systemMessage ? this.messages.slice(1) : this.messages;
            // Heuristic for importance: anchors > assistant > user (user input is often redundant if reflected/anchored)
            const sortedByImportance = [...otherMessages].sort((a, b) => {
                const aIsAnchor = a.metadata?.anchor ? 1 : 0;
                const bIsAnchor = b.metadata?.anchor ? 1 : 0;
                if (aIsAnchor !== bIsAnchor)
                    return bIsAnchor - aIsAnchor;
                const rolePriority = { system: 3, assistant: 2, user: 1, action: 2 };
                return (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0);
            });
            const toKeep = new Set(sortedByImportance.slice(0, this.maxMessages));
            this.messages = this.messages.filter(m => m === systemMessage || toKeep.has(m));
            console.log(`[ContextBuffer] Importance Trimming: ${initialCount} -> ${this.messages.length} messages. preserved anchors and assistant reasoning.`);
        }
    }
    estimateTokens(content) {
        if (!content)
            return 0;
        // More sophisticated heuristic: 
        // - JSON/Code tends to have more tokens per character due to symbols.
        // - Natural language is ~4 chars per token.
        const isStructured = content.startsWith('{') || content.startsWith('[') || content.includes('```');
        const ratio = isStructured ? 3 : 4;
        return Math.ceil(content.length / ratio);
    }
}
exports.ContextBuffer = ContextBuffer;
