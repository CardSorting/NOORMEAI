import type { Kysely } from '../kysely.js'
import type {
  AgenticConfig,
  AgentMessage,
  NOORMConfig,
  LLMProvider,
} from '../types/index.js'
import { SessionManager } from './SessionManager.js'
import { ContextBuffer } from './ContextBuffer.js'
import { VectorIndexer } from './VectorIndexer.js'
import { ActionJournal } from './ActionJournal.js'
import { ResourceMonitor } from './ResourceMonitor.js'
import { EpisodicMemory } from './EpisodicMemory.js'
import { CapabilityManager } from './CapabilityManager.js'
import { CortexOptimizer } from './CortexOptimizer.js'

/**
 * Cortex is the unified facade for agentic operations.
 * It coordinates sessions, memory, reflection, and knowledge.
 */
export class Cortex {
  public sessions: SessionManager
  public buffer: ContextBuffer
  public vectors: VectorIndexer | null
  public optimizer: CortexOptimizer
  public actions: ActionJournal
  public resources: ResourceMonitor
  public episodes: EpisodicMemory
  public capabilities: CapabilityManager
  public llm: LLMProvider | null
  public llmFast: LLMProvider | null
  public llmPremium: LLMProvider | null
  public agenticConfig: AgenticConfig

  constructor(
    public db: Kysely<any>,
    public config: NOORMConfig,
  ) {
    const agenticConfig = config.agentic || {}
    this.agenticConfig = agenticConfig
    this.llm = agenticConfig.llm || null
    this.llmFast = agenticConfig.llmFast || this.llm
    this.llmPremium = agenticConfig.llmPremium || this.llm

    this.sessions = new SessionManager(db, agenticConfig)
    this.buffer = new ContextBuffer({
      maxMessages: agenticConfig.contextWindowSize,
    })
    this.vectors = agenticConfig.vectorConfig
      ? new VectorIndexer(
        db,
        agenticConfig.vectorConfig,
        agenticConfig.memoriesTable,
      )
      : null
    this.optimizer = new CortexOptimizer(db, this, agenticConfig)
    this.actions = new ActionJournal(db, agenticConfig)
    this.resources = new ResourceMonitor(db, agenticConfig)
    this.episodes = new EpisodicMemory(db, agenticConfig)
    this.capabilities = new CapabilityManager(db, this, agenticConfig)
  }

  private executionLock = false

  /**
   * The "Soul-Searching" Loop: A top-level orchestration of all self-improvement rituals.
   */
  async selfIterate(): Promise<void> {
    if (this.executionLock) {
      console.warn('[Cortex] Self-iteration already in progress. Skipping pulse.')
      return
    }

    this.executionLock = true
    console.log(
      '[Cortex] Initiating background maintenance pass...',
    )

    try {
      await this.optimizer.runMaintenance()
      console.log('[Cortex] Background maintenance completed.')
    } catch (err) {
      console.error('[Cortex] Background maintenance failed:', err)
    } finally {
      this.executionLock = false
    }
  }

  /**
   * Helper to quickly resume a session and fill the context buffer
   */
  async resumeSession(
    sessionId: string | number,
    limit: number = 20,
  ): Promise<AgentMessage[]> {
    const history = await this.sessions.getHistory(sessionId, limit)
    this.buffer.setMessages(history)
    return history
  }

  /**
   * Record an interaction (user + assistant) and optionally index it
   */
  async recordInteraction(
    sessionId: string | number,
    role: AgentMessage['role'],
    content: string,
    options: { index?: boolean; embedding?: number[] } = {},
  ): Promise<void> {
    const message = await this.sessions.addMessage(sessionId, role, content)

    if (options.index && options.embedding && this.vectors) {
      await this.vectors.addMemory(content, options.embedding, sessionId)
    }
  }
}
