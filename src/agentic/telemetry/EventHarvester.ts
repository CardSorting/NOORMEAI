import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, TelemetryEvent } from '../../types/index.js'

export class EventHarvester {
    private telemetryTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.telemetryTable = config.telemetryEventsTable || 'agent_telemetry_events'
    }

    /**
     * Persist a raw telemetry event
     */
    async harvest(
        sessionId: string | number,
        type: TelemetryEvent['type'],
        content: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            await this.db
                .insertInto(this.telemetryTable as any)
                .values({
                    session_id: sessionId,
                    type,
                    content,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    created_at: new Date()
                } as any)
                .execute()
        } catch (e) {
            console.warn(`[EventHarvester] Failed to harvest event: ${e}`)
        }
    }
}
