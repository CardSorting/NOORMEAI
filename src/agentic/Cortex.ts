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
import { ReflectionEngine } from './improvement/ReflectionEngine.js'
import { KnowledgeDistiller } from './improvement/KnowledgeDistiller.js'
import { ActionJournal } from './ActionJournal.js'
import { ResourceMonitor } from './ResourceMonitor.js'
import { EpisodicMemory } from './EpisodicMemory.js'
import { CapabilityManager } from './CapabilityManager.js'
import { PolicyEnforcer } from './PolicyEnforcer.js'
import { SessionCompressor } from './SessionCompressor.js'
import { PersonaManager } from './PersonaManager.js'
import { SovereignMetrics } from './improvement/SovereignMetrics.js'
import { SelfEvolution } from './improvement/SelfEvolution.js'
import { CortexJanitor } from './improvement/CortexJanitor.js'
import { RecursiveReasoner } from './improvement/RecursiveReasoner.js'
import { RuleEngine } from './improvement/RuleEngine.js'
import { GovernanceManager } from './improvement/GovernanceManager.js'
import { EvolutionaryPilot } from './improvement/EvolutionaryPilot.js'
import { ConflictResolver } from './improvement/ConflictResolver.js'
import { GoalArchitect } from './improvement/GoalArchitect.js'
import { CuriosityEngine } from './improvement/CuriosityEngine.js'
import { RitualOrchestrator } from './improvement/RitualOrchestrator.js'
import { ActionRefiner } from './improvement/ActionRefiner.js'
import { HiveLink } from './improvement/HiveLink.js'
import { StrategicPlanner } from './improvement/StrategicPlanner.js'
import { AblationEngine } from './improvement/AblationEngine.js'
import { SelfTestRegistry } from './improvement/SelfTestRegistry.js'
import { TelemetryOrchestrator } from './telemetry/TelemetryOrchestrator.js'
import { SkillSynthesizer } from './improvement/SkillSynthesizer.js'
import { EvolutionRitual } from './improvement/EvolutionRitual.js'
import { QuotaManager } from './improvement/QuotaManager.js'

/**
 * Cortex is the unified facade for agentic operations.
 * It coordinates sessions, memory, reflection, and knowledge.
 */
export class Cortex {
  public sessions: SessionManager
  public buffer: ContextBuffer
  public vectors: VectorIndexer | null
  public reflections: ReflectionEngine
  public knowledge: KnowledgeDistiller
  public actions: ActionJournal
  public resources: ResourceMonitor
  public episodes: EpisodicMemory
  public capabilities: CapabilityManager
  public policies: PolicyEnforcer
  public metrics: SovereignMetrics
  public evolution: SelfEvolution
  public compressor: SessionCompressor
  public personas: PersonaManager
  public janitor: CortexJanitor
  public reasoner: RecursiveReasoner
  public rules: RuleEngine
  public governor: GovernanceManager
  public pilot: EvolutionaryPilot
  public conflicts: ConflictResolver
  public goalArchitect: GoalArchitect
  public curiosity: CuriosityEngine
  public rituals: RitualOrchestrator
  public refiner: ActionRefiner
  public hive: HiveLink
  public strategy: StrategicPlanner
  public ablation: AblationEngine
  public tests: SelfTestRegistry
  public telemetry: TelemetryOrchestrator
  public skillSynthesizer: SkillSynthesizer
  public evolutionRitual: EvolutionRitual
  public quotas: QuotaManager
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

    this.telemetry = new TelemetryOrchestrator(db, agenticConfig)
    this.sessions = new SessionManager(db, agenticConfig, this.telemetry)
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
    this.reflections = new ReflectionEngine(db, agenticConfig)
    this.knowledge = new KnowledgeDistiller(db, agenticConfig)
    this.actions = new ActionJournal(db, agenticConfig, this.telemetry)
    this.resources = new ResourceMonitor(db, agenticConfig)
    this.episodes = new EpisodicMemory(db, agenticConfig)
    this.capabilities = new CapabilityManager(db, this, agenticConfig)
    this.policies = new PolicyEnforcer(db, agenticConfig)
    this.metrics = new SovereignMetrics(db, agenticConfig)
    this.evolution = new SelfEvolution(db, config)
    this.compressor = new SessionCompressor(db, agenticConfig)
    this.personas = new PersonaManager(db, agenticConfig)
    this.janitor = new CortexJanitor(db, agenticConfig)
    this.reasoner = new RecursiveReasoner(db, agenticConfig)
    this.rules = new RuleEngine(db, agenticConfig)
    this.governor = new GovernanceManager(db, this, agenticConfig)
    this.pilot = new EvolutionaryPilot(db, this, agenticConfig)
    this.conflicts = new ConflictResolver(db, agenticConfig)
    this.goalArchitect = new GoalArchitect(db, agenticConfig)
    this.curiosity = new CuriosityEngine(db, agenticConfig)
    this.rituals = new RitualOrchestrator(db, this, agenticConfig)
    this.refiner = new ActionRefiner(db, this, agenticConfig)
    this.hive = new HiveLink(db, this, agenticConfig)
    this.strategy = new StrategicPlanner(db, this, agenticConfig)
    this.ablation = new AblationEngine(db, this, agenticConfig)
    this.tests = new SelfTestRegistry(db, this, agenticConfig)
    this.skillSynthesizer = new SkillSynthesizer(db, this, agenticConfig)
    this.evolutionRitual = new EvolutionRitual(db, this, agenticConfig)
    this.quotas = new QuotaManager(db, this, agenticConfig)
  }

  /**
   * The "Soul-Searching" Loop: A top-level orchestration of all self-improvement rituals.
   */
  async selfIterate(): Promise<void> {
    console.log(
      '[Cortex] Initiating Autonomous Soul-Searching Loop v2 (Deep Hardening Pass)...',
    )

    try {
      // 1. Audit health & Run self-tests
      const audit = await this.governor.performAudit()
      if (!audit.healthy) {
        console.warn(
          '[Cortex] Audit issues detected before iteration:',
          audit.issues,
        )
      }
      await this.tests.runAllProbes()

      // 2. Run background rituals (optimization, compression)
      await this.rituals.runPendingRituals()

      // 3. Learn from actions & Prune dead data
      await this.refiner.refineActions()
      await this.ablation.pruneZombies()

      // Industrial Hardening: Monitor and recover from bad ablations
      await this.ablation.monitorAblationPerformance()

      // 4. Mutation & Strategy
      await this.strategy.mutateStrategy()

      // 5. High-Throughput Evolution Pulse
      await this.evolutionRitual.execute()

      // 6. Broadcast knowledge & skills
      await this.hive.broadcastKnowledge()

      // 6b. Emergent Skill Synthesis
      await this.skillSynthesizer.discoverAndSynthesize()

      // 7. Evolutionary pulse
      await this.pilot.runSelfImprovementCycle()

      console.log('[Cortex] Soul-Searching loop completed.')
    } catch (err) {
      console.error('[Cortex] Soul-Searching loop failed:', err)
      // Telemetry: track failure
      await this.telemetry.track('system', 'error', 'Self-iteration failed', {
        error: String(err),
      })
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

    // Telemetry: Track prompt and output
    const type =
      role === 'user' ? 'prompt' : role === 'assistant' ? 'output' : 'action'
    await this.telemetry.track(sessionId, type as any, content, {
      role,
      messageId: message.id,
    })

    if (options.index && options.embedding && this.vectors) {
      await this.vectors.addMemory(content, options.embedding, sessionId)
    }
  }
}
