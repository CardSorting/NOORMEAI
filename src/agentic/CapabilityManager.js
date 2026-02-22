"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapabilityManager = void 0;
/**
 * CapabilityManager tracks the skills (tools) available to an agent
 * and their historical reliability.
 */
class CapabilityManager {
    db;
    config;
    capabilitiesTable;
    evolutionConfig;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.capabilitiesTable = config.capabilitiesTable || 'agent_capabilities';
        this.evolutionConfig = config.evolution || {
            verificationWindow: 20,
            rollbackThresholdZ: 2.5,
            enableHiveLink: true,
            mutationAggressiveness: 0.5,
            maxSandboxSkills: 5
        };
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Register or update a capability (skill)
     */
    async registerCapability(name, version, description, metadata = {}) {
        return await this.db.transaction().execute(async (trx) => {
            const existing = await trx
                .selectFrom(this.capabilitiesTable)
                .selectAll()
                .where('name', '=', name)
                .where('version', '=', version)
                .executeTakeFirst();
            if (existing) {
                const updated = await trx
                    .updateTable(this.capabilitiesTable)
                    .set({
                    description: description || existing.description,
                    status: existing.status || 'experimental',
                    metadata: JSON.stringify({ ...JSON.parse(existing.metadata || '{}'), ...metadata }),
                    updated_at: new Date()
                })
                    .where('id', '=', existing.id)
                    .returningAll()
                    .executeTakeFirstOrThrow();
                return this.parseCapability(updated);
            }
            const created = await trx
                .insertInto(this.capabilitiesTable)
                .values({
                name,
                version,
                description: description || null,
                status: metadata.initialStatus || 'experimental',
                reliability: 1.0,
                metadata: JSON.stringify({ ...metadata, successCount: 0, totalCount: 0 }),
                created_at: new Date(),
                updated_at: new Date()
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.parseCapability(created);
        });
    }
    /**
     * Update reliability based on action outcome using a damped moving average.
     * Manages the lifecycle of emergent skills (sandbox -> verified / blacklisted).
     */
    async reportOutcome(name, success) {
        await this.db.transaction().execute(async (trx) => {
            const capability = await trx
                .selectFrom(this.capabilitiesTable)
                .selectAll()
                .where('name', '=', name)
                .orderBy('updated_at', 'desc')
                .executeTakeFirst();
            if (capability) {
                const cap = capability;
                const metadata = typeof cap.metadata === 'string' ? JSON.parse(cap.metadata) : (cap.metadata || {});
                const totalCount = (metadata.totalCount || 0) + 1;
                const successCount = (metadata.successCount || 0) + (success ? 1 : 0);
                // Damped moving average: weight recent outcomes more but keep history
                // formula: new = old * (1 - alpha) + current * alpha
                const alpha = 0.2;
                const currentReliability = cap.reliability;
                const newReliability = success
                    ? Math.min(1.0, currentReliability * (1 - alpha) + alpha)
                    : Math.max(0.0, currentReliability * (1 - alpha));
                let newStatus = cap.status || 'experimental';
                // --- Emergent Skill Lifecycle Management ---
                if (newStatus === 'sandbox') {
                    const windowSize = this.evolutionConfig.verificationWindow || 20;
                    // Only evaluate if we have enough sample data in the sandbox
                    if (totalCount >= windowSize) {
                        const winRate = successCount / totalCount;
                        // Promotion Threshold
                        if (winRate >= 0.8) {
                            console.log(`[CapabilityManager] Skill '${name}' PASSED sandbox verification (WinRate: ${(winRate * 100).toFixed(1)}%). Promoting to Verified.`);
                            newStatus = 'verified';
                        }
                        else if (winRate < 0.5) { // Demotion / Blacklist Threshold
                            console.log(`[CapabilityManager] Skill '${name}' FAILED sandbox verification (WinRate: ${(winRate * 100).toFixed(1)}%). Blacklisting.`);
                            newStatus = 'blacklisted';
                        }
                        else {
                            // Borderline: keep in experimental
                            console.log(`[CapabilityManager] Skill '${name}' yielded borderline results in sandbox (WinRate: ${(winRate * 100).toFixed(1)}%). Rolling back to Experimental.`);
                            newStatus = 'experimental';
                        }
                    }
                }
                else if (newStatus === 'verified') {
                    // Continuous Monitoring of Verified Skills
                    // If a verified skill suddenly drops in reliability significantly, demote it.
                    if (totalCount > 30 && newReliability < 0.6) {
                        console.warn(`[CapabilityManager] Verified Skill '${name}' reliability collapsed (${newReliability.toFixed(2)}). Demoting to Experimental.`);
                        newStatus = 'experimental';
                    }
                }
                await trx
                    .updateTable(this.capabilitiesTable)
                    .set({
                    reliability: newReliability,
                    status: newStatus,
                    metadata: JSON.stringify({ ...metadata, totalCount, successCount }),
                    updated_at: new Date()
                })
                    .where('id', '=', cap.id)
                    .execute();
            }
        });
    }
    /**
     * Get reliability score for a capability.
     */
    async getReliability(name) {
        const cap = await this.typedDb
            .selectFrom(this.capabilitiesTable)
            .select('reliability')
            .where('name', '=', name)
            .orderBy('updated_at', 'desc')
            .executeTakeFirst();
        return cap ? cap.reliability : 0.0;
    }
    /**
     * Get all registered capabilities, optionally filtered by status
     */
    async getCapabilities(status) {
        let query = this.typedDb
            .selectFrom(this.capabilitiesTable)
            .selectAll();
        if (status) {
            query = query.where('status', '=', status);
        }
        const list = await query
            .orderBy('name', 'asc')
            .execute();
        return list.map(c => this.parseCapability(c));
    }
    parseCapability(cap) {
        return {
            id: cap.id,
            name: cap.name,
            version: cap.version,
            description: cap.description,
            status: cap.status || 'experimental',
            reliability: cap.reliability,
            metadata: typeof cap.metadata === 'string' ? JSON.parse(cap.metadata) : (cap.metadata || {}),
            createdAt: new Date(cap.created_at),
            updatedAt: new Date(cap.updated_at)
        };
    }
}
exports.CapabilityManager = CapabilityManager;
