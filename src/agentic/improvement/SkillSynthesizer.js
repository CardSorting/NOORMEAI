"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillSynthesizer = void 0;
const sql_js_1 = require("../../raw-builder/sql.js");
/**
 * SkillSynthesizer continuously analyzes session history to detect
 * inefficiencies, repeat failures, and latent opportunities.
 * It synthesizes novel "sandbox" capabilities when it finds gaps.
 */
class SkillSynthesizer {
    db;
    cortex;
    config;
    evolutionConfig;
    actionsTable;
    telemetryEventsTable;
    constructor(db, cortex, config = {}) {
        this.db = db;
        this.cortex = cortex;
        this.config = config;
        this.evolutionConfig = config.evolution || {
            verificationWindow: 20,
            rollbackThresholdZ: 2.5,
            enableHiveLink: true,
            mutationAggressiveness: 0.5,
            maxSandboxSkills: 5
        };
        this.actionsTable = config.actionsTable || 'agent_actions';
        this.telemetryEventsTable = config.telemetryEventsTable || 'agent_telemetry_events';
    }
    /**
     * Scan recent histories for repeating failures across specific tools.
     * Generates a new "mutated" skill and places it in the sandbox.
     */
    async discoverAndSynthesize() {
        console.log('[SkillSynthesizer] Analyzing telemetry for capability gaps...');
        // Check if we are already at max sandbox capacity to prevent destabilization
        const sandboxCount = await this.getSandboxSkillCount();
        if (sandboxCount >= (this.evolutionConfig.maxSandboxSkills || 5)) {
            console.log('[SkillSynthesizer] Sandbox is full. Pausing synthesis.');
            return null;
        }
        // 1. Detect Failure Patterns
        // Find tools that failed multiple times recently
        const recentFailures = await this.db
            .selectFrom(this.actionsTable)
            .select(['tool_name', (0, sql_js_1.sql) `COUNT(id)`.as('fail_count')])
            .where('status', '=', 'failure')
            .orderBy('created_at', 'desc')
            .limit(100)
            .groupBy('tool_name')
            .having((0, sql_js_1.sql) `COUNT(id)`, '>', 3) // More than 3 failures in the recent window
            .execute();
        if (recentFailures.length === 0) {
            return null; // System is relatively stable, no obvious failure hotspots
        }
        // 2. Target the most problematic tool for Synthesis
        const targetTool = recentFailures[0].tool_name;
        // Retrieve existing capability facts to seed the mutation
        const existingCap = await this.cortex.capabilities.getCapabilities().then(caps => caps.find(c => c.name === targetTool));
        if (!existingCap)
            return null;
        // 3. Synthesize the new skill (Simulated Meta-Evolution Step)
        // In a full implementation, this calls the LLM with the failure context to rewrite the prompt/tool structure
        const mutationName = `${targetTool}_mutated_v${Date.now()}`;
        const newCapability = await this.cortex.capabilities.registerCapability(mutationName, '1.0.0', `Synthesized mutation of ${targetTool} designed to handle recent failure edge cases.`, {
            initialStatus: 'sandbox',
            mutatedFrom: targetTool,
            synthesisReason: 'Frequent failures detected in base capability.',
            aggressiveness: this.evolutionConfig.mutationAggressiveness
        });
        console.log(`[SkillSynthesizer] Synthesized novel sandbox capability: ${mutationName}`);
        return newCapability;
    }
    async getSandboxSkillCount() {
        const sandboxSkills = await this.cortex.capabilities.getCapabilities('sandbox');
        return sandboxSkills.length;
    }
}
exports.SkillSynthesizer = SkillSynthesizer;
