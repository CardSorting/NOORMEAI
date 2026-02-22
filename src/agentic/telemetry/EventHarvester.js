"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventHarvester = void 0;
class EventHarvester {
    db;
    config;
    telemetryTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.telemetryTable = config.telemetryEventsTable || 'agent_telemetry_events';
    }
    /**
     * Persist a raw telemetry event
     */
    async harvest(sessionId, type, content, metadata) {
        try {
            await this.db
                .insertInto(this.telemetryTable)
                .values({
                session_id: sessionId,
                type,
                content,
                metadata: metadata ? JSON.stringify(metadata) : null,
                created_at: new Date()
            })
                .execute();
        }
        catch (e) {
            console.warn(`[EventHarvester] Failed to harvest event: ${e}`);
        }
    }
}
exports.EventHarvester = EventHarvester;
