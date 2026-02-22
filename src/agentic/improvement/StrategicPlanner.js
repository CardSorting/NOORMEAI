"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategicPlanner = void 0;
const sql_js_1 = require("../../raw-builder/sql.js");
/**
 * StrategicPlanner proactively suggests mutation to agent personas
 * based on performance trends observed in SovereignMetrics.
 */
class StrategicPlanner {
    db;
    cortex;
    config;
    personasTable;
    metricsTable;
    constructor(db, cortex, config = {}) {
        this.db = db;
        this.cortex = cortex;
        this.config = config;
        this.personasTable = config.personasTable || 'agent_personas';
        this.metricsTable = config.metricsTable || 'agent_metrics';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Analyze performance for all personas and apply mutations where necessary.
     */
    async mutateStrategy() {
        const mutations = [];
        // 0. Pre-Flight System Health Check (Phase 4)
        const tests = await this.cortex.tests.runAllProbes();
        const failedTests = tests.filter(t => !t.success);
        if (failedTests.length > 0) {
            console.warn(`[StrategicPlanner] Mutation cycle aborted. System health probes failed: ${failedTests.map(t => t.name).join(', ')}`);
            return [];
        }
        const personas = await this.typedDb
            .selectFrom(this.personasTable)
            .selectAll()
            .execute();
        for (const p of personas) {
            const persona = this.parsePersona(p);
            // 1. Verification Monitor
            if (persona.metadata?.evolution_status === 'verifying') {
                const result = await this.verifyEvolution(persona);
                if (result)
                    mutations.push(result);
                continue;
            }
            // 2. Failure Analysis (Intelligence Refinement)
            const failures = await this.analyzeFailurePatterns(persona.id);
            const report = await this.analyzePersona(persona.id);
            // 3. Blacklist Check (Local & Global Phase 5)
            const lastMutation = persona.metadata?.last_failed_mutation;
            const allPersonas = await this.typedDb.selectFrom(this.personasTable).selectAll().execute();
            const isGloballyBlacklisted = allPersonas.some(p => {
                const mp = this.parsePersona(p);
                return mp.metadata?.last_failed_mutation?.type === report.recommendation && (Date.now() - (mp.metadata?.last_failed_mutation?.timestamp || 0) < 3600000);
            });
            if (isGloballyBlacklisted || (lastMutation && report.recommendation === lastMutation.type && (Date.now() - lastMutation.timestamp < 86400000))) {
                console.log(`[StrategicPlanner] Skipping blacklisted mutation ${report.recommendation} for persona ${persona.id} (Global=${isGloballyBlacklisted})`);
                continue;
            }
            if (report.recommendation !== 'maintain' || failures.length > 0) {
                const result = await this.applyDirectMutation(persona, report, failures);
                if (result) {
                    mutations.push(result);
                }
            }
        }
        return mutations;
    }
    /**
     * Directly mutate a persona and put it into 'verifying' status.
     * Performs a pre-flight conflict check and injects distilled lessons.
     */
    async applyDirectMutation(persona, report, failures = []) {
        return await this.db.transaction().execute(async (trx) => {
            const reason = failures.length > 0 ? `Failure Patterns: ${failures.join(', ')}` : report.recommendation;
            console.log(`[StrategicPlanner] Applying direct mutation to persona ${persona.id} (Reason: ${reason})`);
            let updates = {};
            let mutationType = 'role_update';
            if (failures.length > 0) {
                // Lesson-Driven Synthesis: Pull categories of lessons
                const lessons = await this.cortex.reasoner.synthesizeLessons();
                const relevantLessons = updates.role ? [] : (lessons['general'] || []).slice(0, 2);
                updates = { role: `${persona.role || ''} (Optimized for: ${failures.join(', ')}. Patterns: ${relevantLessons.join('; ')})`.trim() };
            }
            else {
                // Evolutionary Cross-Pollination (Phase 5)
                const allPersonas = await this.typedDb.selectFrom(this.personasTable).selectAll().execute();
                const winningMutations = allPersonas
                    .map(p => this.parsePersona(p))
                    .filter(p => (p.metadata?.evolution_status === 'stable' || !p.metadata?.evolution_status) && p.metadata?.mutation_reason?.includes(report.recommendation));
                if (winningMutations.length > 0 && Math.random() > 0.5) {
                    console.log(`[StrategicPlanner] Cross-Pollinating success from Persona ${winningMutations[0].id}`);
                    updates = { role: winningMutations[0].role || persona.role };
                }
                else {
                    switch (report.recommendation) {
                        case 'optimize_accuracy':
                            updates = { role: `${persona.role || ''} (Focus strictly on accuracy and detailed verification)`.trim() };
                            break;
                        case 'optimize_efficiency':
                            updates = { policies: [...(persona.policies || []), 'timeout_reduction', 'concise_output'] };
                            mutationType = 'policy_update';
                            break;
                        case 'critical_intervention':
                            return await this.rollbackPersona(persona.id);
                        default:
                            return null;
                    }
                }
            }
            // 1. Predictive Conflict Detection (Pre-flight)
            const proposedState = { ...persona, ...updates };
            const contradictions = await this.cortex.reasoner.detectContradictions();
            // If the new role contradicts existing goals, block mutation
            for (const contradiction of contradictions) {
                if (updates.role && contradiction.includes(updates.role.slice(0, 20))) {
                    console.warn(`[StrategicPlanner] Mutation blocked due to goal contradiction: ${contradiction}`);
                    return null;
                }
            }
            // Record mutation in history
            const mutation = {
                id: `mut_${Date.now()}`,
                timestamp: Date.now(),
                type: mutationType,
                previousState: {
                    role: persona.role,
                    policies: persona.policies,
                    capabilities: persona.capabilities
                },
                newState: { ...updates },
                reason: `Auto-mutation triggered by ${report.recommendation}`
            };
            const history = [...(persona.metadata?.mutationHistory || []), mutation];
            if (history.length > 5)
                history.shift();
            const newMetadata = {
                ...persona.metadata,
                mutationHistory: history,
                evolution_status: 'verifying',
                mutation_reason: report.recommendation, // Hive Signal (Phase 5)
                verification_started_at: Date.now(),
                verification_baseline: {
                    successRate: report.successRate,
                    averageLatency: report.averageLatency
                }
            };
            await trx
                .updateTable(this.personasTable)
                .set({
                role: updates.role || persona.role,
                policies: updates.policies ? JSON.stringify(updates.policies) : undefined,
                capabilities: updates.capabilities ? JSON.stringify(updates.capabilities) : undefined,
                metadata: JSON.stringify(newMetadata),
                updated_at: new Date()
            })
                .where('id', '=', persona.id)
                .execute();
            return `Persona ${persona.id} mutated and entering verification window for ${mutationType}.`;
        });
    }
    /**
     * Check if a persona in verification should be stabilized or rolled back.
     * Uses dynamic statistical variance and adaptive meta-tuning.
     */
    async verifyEvolution(persona) {
        const report = await this.analyzePersona(persona.id);
        // Adaptive Meta-Tuning: Increase window based on rollback history (Phase 4)
        const rollbackHistory = persona.metadata?.rollbackHistory || [];
        const recentRollbacks = rollbackHistory.filter(ts => (Date.now() - ts < 604800000)).length;
        // Hive-Mind Verification Speedups (Phase 5)
        const allPersonas = await this.typedDb.selectFrom(this.personasTable).selectAll().execute();
        const hiveTrusted = allPersonas.map(p => this.parsePersona(p)).filter(p => p.metadata?.evolution_status === 'stable' && p.metadata?.mutation_reason === (persona.metadata?.mutation_reason)).length;
        let sampleSizeThreshold = 10 + (recentRollbacks * 10);
        if (hiveTrusted >= 3) {
            console.log(`[StrategicPlanner] Accelerating verification for Persona ${persona.id} (Hive-Mind Trusted)`);
            sampleSizeThreshold = Math.max(5, Math.floor(sampleSizeThreshold / 2));
        }
        if (report.sampleSize < sampleSizeThreshold)
            return null;
        const baseline = persona.metadata?.verification_baseline || { successRate: 0.8, averageLatency: 500 };
        // Dynamic Variance Calculation (Intelligence Refinement)
        const recentMetrics = await this.cortex.metrics.getRecentMetrics(100);
        const values = recentMetrics
            .filter(m => m.metricName === 'success_rate')
            .map(m => Number(m.metricValue));
        const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length || 1);
        const stdDev = Math.sqrt(variance) || 0.1;
        const zScore = (report.successRate - baseline.successRate) / (stdDev || 1);
        console.log(`[StrategicPlanner] Verifying persona ${persona.id}: Success=${report.successRate.toFixed(2)} (Baseline=${baseline.successRate.toFixed(2)}, σ=${stdDev.toFixed(3)}, Z-Score=${zScore.toFixed(2)}, Threshold=${sampleSizeThreshold})`);
        // 1. Early Rollback (Critical statistical drop)
        if (zScore < -2.0) {
            console.warn(`[StrategicPlanner] STATISTICAL DEGRADATION detected for persona ${persona.id} (Z-Score: ${zScore.toFixed(2)}). Rolling back early.`);
            return await this.rollbackPersona(persona.id);
        }
        // 2. Stabilization (Proven improvement or stability)
        if (report.sampleSize >= (sampleSizeThreshold * 2) && zScore >= -0.5) {
            console.log(`[StrategicPlanner] Evolution for persona ${persona.id} STABILIZED.`);
            // Cognitive Rule Distillation (Phase 4)
            if (persona.metadata?.mutation_reason?.includes('optimize_efficiency')) {
                await this.cortex.rules.defineRule('all', 'all', 'audit', {
                    condition: 'latency > 500',
                    priority: 10,
                    metadata: { reason: `Distilled from successful persona ${persona.id} optimization` }
                });
            }
            await this.db.updateTable(this.personasTable)
                .set({ metadata: JSON.stringify({ ...persona.metadata, evolution_status: 'stable' }) })
                .where('id', '=', persona.id)
                .execute();
            return `Evolution stabilized for persona ${persona.id}`;
        }
        // 3. Time-out or persistent mild degradation
        const timeInVerification = (Date.now() - (persona.metadata?.verification_started_at || 0)) / 1000;
        if (timeInVerification > 86400 * 3) {
            console.warn(`[StrategicPlanner] Verification period timed out for ${persona.id}. Rolling back to safety.`);
            return await this.rollbackPersona(persona.id);
        }
        return null;
    }
    /**
     * Analyze recent actions for specific failure patterns.
     */
    async analyzeFailurePatterns(personaId) {
        const patterns = [];
        // Use ActionJournal if available to find failing tools
        try {
            const failureReport = await this.cortex.actions.getFailureReport();
            // Only consider tools that failed more than once
            const frequentFailures = failureReport.filter(f => f.failureCount > 1);
            for (const fail of frequentFailures) {
                patterns.push(`tool_failure_${fail.toolName}`);
            }
        }
        catch (e) {
            // Fallback to basic metrics if ActionJournal is not reachable
        }
        return patterns;
    }
    /**
     * Generate a performance report for a specific persona.
     * Uses dynamic satisfaction thresholds based on global population stats (Phase 6).
     */
    async analyzePersona(id) {
        const recentMetrics = await this.typedDb
            .selectFrom(this.metricsTable)
            .selectAll()
            .where((eb) => eb.or([
            eb((0, sql_js_1.sql) `json_extract(metadata, '$.persona_id')`, '=', id),
            eb((0, sql_js_1.sql) `metadata->>'persona_id'`, '=', String(id))
        ]))
            .orderBy('created_at', 'desc')
            .limit(50)
            .execute();
        // 1. Fetch Global Baseline for Dynamic Thresholds
        const globalMetrics = await this.cortex.metrics.getRecentMetrics(200);
        const calcStats = (metricName) => {
            const vals = globalMetrics.filter(m => m.metricName === metricName).map(m => Number(m.metricValue));
            if (vals.length < 10)
                return { mean: metricName === 'query_latency' ? 500 : 0.9, stdDev: 0.1 };
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
            return { mean, stdDev: Math.sqrt(variance) || 0.05 };
        };
        const successStats = calcStats('task_success_rate');
        const latencyStats = calcStats('query_latency');
        if (recentMetrics.length === 0) {
            return {
                personaId: id,
                successRate: successStats.mean,
                averageLatency: latencyStats.mean,
                sampleSize: 0,
                recommendation: 'maintain'
            };
        }
        const successMetrics = recentMetrics.filter(m => m.metric_name === 'task_success_rate');
        const latencyMetrics = recentMetrics.filter(m => m.metric_name === 'query_latency');
        const avgSuccess = successMetrics.length > 0
            ? successMetrics.reduce((sum, m) => sum + Number(m.metric_value), 0) / successMetrics.length
            : successStats.mean;
        const avgLatency = latencyMetrics.length > 0
            ? latencyMetrics.reduce((sum, m) => sum + Number(m.metric_value), 0) / latencyMetrics.length
            : latencyStats.mean;
        let recommendation = 'maintain';
        // 2. Map Dynamic Thresholds to Recommendations
        // Critical: Worse than 2.5 standard deviations from mean
        const criticalThreshold = successStats.mean - (2.5 * successStats.stdDev);
        // Optimize: Worse than 1.0 standard deviations from mean
        const accuracyThreshold = successStats.mean - (1.0 * successStats.stdDev);
        // Efficiency: Latency > 2 standard deviations above mean
        const efficiencyThreshold = latencyStats.mean + (2.0 * latencyStats.stdDev);
        if (avgSuccess < criticalThreshold) {
            recommendation = 'critical_intervention';
        }
        else if (avgSuccess < accuracyThreshold) {
            recommendation = 'optimize_accuracy';
        }
        else if (avgLatency > efficiencyThreshold) {
            recommendation = 'optimize_efficiency';
        }
        console.log(`[StrategicPlanner] Analysis for ${id}: Success=${avgSuccess.toFixed(3)} (Min=${accuracyThreshold.toFixed(3)}), Latency=${avgLatency.toFixed(0)} (Max=${efficiencyThreshold.toFixed(0)})`);
        return {
            personaId: id,
            successRate: avgSuccess,
            averageLatency: avgLatency,
            sampleSize: recentMetrics.length,
            recommendation
        };
    }
    /**
     * (Deprecated in favor of initiateAblationMutation) Evolve a persona directly.
     */
    async evolvePersona(persona, report) {
        return await this.applyDirectMutation(persona, report);
    }
    /**
     * Revert the last mutation for a persona.
     */
    async rollbackPersona(id) {
        return await this.db.transaction().execute(async (trx) => {
            const current = await trx
                .selectFrom(this.personasTable)
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst();
            if (!current)
                throw new Error(`Persona ${id} not found`);
            const persona = this.parsePersona(current);
            const history = persona.metadata?.mutationHistory || [];
            const lastMutation = history.pop();
            if (!lastMutation) {
                return `No mutations to rollback for persona ${id}`;
            }
            const previous = lastMutation.previousState;
            const rollbackHistory = persona.metadata?.rollbackHistory || [];
            rollbackHistory.push(Date.now());
            const newMetadata = {
                ...persona.metadata,
                mutationHistory: history,
                rollbackHistory: rollbackHistory,
                last_failed_mutation: {
                    type: lastMutation.type,
                    timestamp: Date.now()
                },
                evolution_status: 'stable',
                lastRollback: Date.now()
            };
            await trx
                .updateTable(this.personasTable)
                .set({
                role: previous.role,
                policies: previous.policies ? JSON.stringify(previous.policies) : undefined,
                capabilities: previous.capabilities ? JSON.stringify(previous.capabilities) : undefined,
                metadata: JSON.stringify(newMetadata),
                updated_at: new Date()
            })
                .where('id', '=', id)
                .execute();
            return `Rolled back mutation ${lastMutation.id} for persona ${id}`;
        });
    }
    parsePersona(p) {
        return {
            id: p.id,
            name: p.name,
            role: p.role,
            capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : (p.capabilities || []),
            policies: typeof p.policies === 'string' ? JSON.parse(p.policies) : (p.policies || []),
            metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {}),
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
        };
    }
}
exports.StrategicPlanner = StrategicPlanner;
