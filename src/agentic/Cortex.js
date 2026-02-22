"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cortex = void 0;
const SessionManager_js_1 = require("./SessionManager.js");
const ContextBuffer_js_1 = require("./ContextBuffer.js");
const VectorIndexer_js_1 = require("./VectorIndexer.js");
const ReflectionEngine_js_1 = require("./improvement/ReflectionEngine.js");
const KnowledgeDistiller_js_1 = require("./improvement/KnowledgeDistiller.js");
const ActionJournal_js_1 = require("./ActionJournal.js");
const ResourceMonitor_js_1 = require("./ResourceMonitor.js");
const EpisodicMemory_js_1 = require("./EpisodicMemory.js");
const CapabilityManager_js_1 = require("./CapabilityManager.js");
const PolicyEnforcer_js_1 = require("./PolicyEnforcer.js");
const SessionCompressor_js_1 = require("./SessionCompressor.js");
const PersonaManager_js_1 = require("./PersonaManager.js");
const SovereignMetrics_js_1 = require("./improvement/SovereignMetrics.js");
const SelfEvolution_js_1 = require("./improvement/SelfEvolution.js");
const CortexJanitor_js_1 = require("./improvement/CortexJanitor.js");
const RecursiveReasoner_js_1 = require("./improvement/RecursiveReasoner.js");
const RuleEngine_js_1 = require("./improvement/RuleEngine.js");
const GovernanceManager_js_1 = require("./improvement/GovernanceManager.js");
const EvolutionaryPilot_js_1 = require("./improvement/EvolutionaryPilot.js");
const ConflictResolver_js_1 = require("./improvement/ConflictResolver.js");
const GoalArchitect_js_1 = require("./improvement/GoalArchitect.js");
const CuriosityEngine_js_1 = require("./improvement/CuriosityEngine.js");
const RitualOrchestrator_js_1 = require("./improvement/RitualOrchestrator.js");
const ActionRefiner_js_1 = require("./improvement/ActionRefiner.js");
const HiveLink_js_1 = require("./improvement/HiveLink.js");
const StrategicPlanner_js_1 = require("./improvement/StrategicPlanner.js");
const AblationEngine_js_1 = require("./improvement/AblationEngine.js");
const SelfTestRegistry_js_1 = require("./improvement/SelfTestRegistry.js");
const TelemetryOrchestrator_js_1 = require("./telemetry/TelemetryOrchestrator.js");
const SkillSynthesizer_js_1 = require("./improvement/SkillSynthesizer.js");
/**
 * Cortex is the unified facade for agentic operations.
 * It coordinates sessions, memory, reflection, and knowledge.
 */
class Cortex {
    db;
    config;
    sessions;
    buffer;
    vectors;
    reflections;
    knowledge;
    actions;
    resources;
    episodes;
    capabilities;
    policies;
    metrics;
    evolution;
    compressor;
    personas;
    janitor;
    reasoner;
    rules;
    governor;
    pilot;
    conflicts;
    goalArchitect;
    curiosity;
    rituals;
    refiner;
    hive;
    strategy;
    ablation;
    tests;
    telemetry;
    skillSynthesizer;
    agenticConfig;
    constructor(db, config) {
        this.db = db;
        this.config = config;
        const agenticConfig = config.agentic || {};
        this.agenticConfig = agenticConfig;
        this.telemetry = new TelemetryOrchestrator_js_1.TelemetryOrchestrator(db, agenticConfig);
        this.sessions = new SessionManager_js_1.SessionManager(db, agenticConfig, this.telemetry);
        this.buffer = new ContextBuffer_js_1.ContextBuffer({ maxMessages: agenticConfig.contextWindowSize });
        this.vectors = agenticConfig.vectorConfig
            ? new VectorIndexer_js_1.VectorIndexer(db, agenticConfig.vectorConfig, agenticConfig.memoriesTable)
            : null;
        this.reflections = new ReflectionEngine_js_1.ReflectionEngine(db, agenticConfig);
        this.knowledge = new KnowledgeDistiller_js_1.KnowledgeDistiller(db, agenticConfig);
        this.actions = new ActionJournal_js_1.ActionJournal(db, agenticConfig, this.telemetry);
        this.resources = new ResourceMonitor_js_1.ResourceMonitor(db, agenticConfig);
        this.episodes = new EpisodicMemory_js_1.EpisodicMemory(db, agenticConfig);
        this.capabilities = new CapabilityManager_js_1.CapabilityManager(db, agenticConfig);
        this.policies = new PolicyEnforcer_js_1.PolicyEnforcer(db, agenticConfig);
        this.metrics = new SovereignMetrics_js_1.SovereignMetrics(db, agenticConfig);
        this.evolution = new SelfEvolution_js_1.SelfEvolution(db, config);
        this.compressor = new SessionCompressor_js_1.SessionCompressor(db, agenticConfig);
        this.personas = new PersonaManager_js_1.PersonaManager(db, agenticConfig);
        this.janitor = new CortexJanitor_js_1.CortexJanitor(db, agenticConfig);
        this.reasoner = new RecursiveReasoner_js_1.RecursiveReasoner(db, agenticConfig);
        this.rules = new RuleEngine_js_1.RuleEngine(db, agenticConfig);
        this.governor = new GovernanceManager_js_1.GovernanceManager(db, this, agenticConfig);
        this.pilot = new EvolutionaryPilot_js_1.EvolutionaryPilot(db, this, agenticConfig);
        this.conflicts = new ConflictResolver_js_1.ConflictResolver(db, agenticConfig);
        this.goalArchitect = new GoalArchitect_js_1.GoalArchitect(db, agenticConfig);
        this.curiosity = new CuriosityEngine_js_1.CuriosityEngine(db, agenticConfig);
        this.rituals = new RitualOrchestrator_js_1.RitualOrchestrator(db, this, agenticConfig);
        this.refiner = new ActionRefiner_js_1.ActionRefiner(db, this, agenticConfig);
        this.hive = new HiveLink_js_1.HiveLink(db, this, agenticConfig);
        this.strategy = new StrategicPlanner_js_1.StrategicPlanner(db, this, agenticConfig);
        this.ablation = new AblationEngine_js_1.AblationEngine(db, this, agenticConfig);
        this.tests = new SelfTestRegistry_js_1.SelfTestRegistry(db, this, agenticConfig);
        this.skillSynthesizer = new SkillSynthesizer_js_1.SkillSynthesizer(db, this, agenticConfig);
    }
    /**
     * The "Soul-Searching" Loop: A top-level orchestration of all self-improvement rituals.
     */
    async selfIterate() {
        console.log('[Cortex] Initiating Autonomous Soul-Searching Loop v2 (Deep Hardening Pass)...');
        try {
            // 1. Audit health & Run self-tests
            const audit = await this.governor.performAudit();
            if (!audit.healthy) {
                console.warn('[Cortex] Audit issues detected before iteration:', audit.issues);
            }
            await this.tests.runAllProbes();
            // 2. Run background rituals (optimization, compression)
            await this.rituals.runPendingRituals();
            // 3. Learn from actions & Prune dead data
            await this.refiner.refineActions();
            await this.ablation.pruneZombies();
            // Industrial Hardening: Monitor and recover from bad ablations
            await this.ablation.monitorAblationPerformance();
            // 4. Mutation & Strategy
            await this.strategy.mutateStrategy();
            // 5. Broadcast knowledge & skills
            await this.hive.broadcastKnowledge();
            // 5b. Emergent Skill Synthesis
            await this.skillSynthesizer.discoverAndSynthesize();
            // 6. Evolutionary pulse
            await this.pilot.runSelfImprovementCycle();
            console.log('[Cortex] Soul-Searching loop completed.');
        }
        catch (err) {
            console.error('[Cortex] Soul-Searching loop failed:', err);
            // Telemetry: track failure
            await this.telemetry.track('system', 'error', 'Self-iteration failed', { error: String(err) });
        }
    }
    /**
     * Helper to quickly resume a session and fill the context buffer
     */
    async resumeSession(sessionId, limit = 20) {
        const history = await this.sessions.getHistory(sessionId, limit);
        this.buffer.setMessages(history);
        return history;
    }
    /**
     * Record an interaction (user + assistant) and optionally index it
     */
    async recordInteraction(sessionId, role, content, options = {}) {
        const message = await this.sessions.addMessage(sessionId, role, content);
        // Telemetry: Track prompt and output
        const type = role === 'user' ? 'prompt' : (role === 'assistant' ? 'output' : 'action');
        await this.telemetry.track(sessionId, type, content, { role, messageId: message.id });
        if (options.index && options.embedding && this.vectors) {
            await this.vectors.addMemory(content, options.embedding, sessionId);
        }
    }
}
exports.Cortex = Cortex;
