import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, TelemetryEvent } from '../../types/index.js'

export class EventHarvester {
  private telemetryTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.telemetryTable =
      config.telemetryEventsTable || 'agent_telemetry_events'
  }

  /**
   * Persist a raw telemetry event with safety valves for scale.
   */
  async harvest(
    sessionId: string | number,
    type: TelemetryEvent['type'],
    content: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // 1. Safety Valve: Drop excessively large payloads (> 100KB)
    if (content.length > 102400) {
      console.warn(
        `[EventHarvester] DROPPING EVENT: Content exceeds 100KB safety limit (${content.length} bytes)`,
      )
      return
    }

    // 2. Metadata Integrity: Ensure metadata is a valid object
    const finalMetadata =
      metadata && typeof metadata === 'object' ? metadata : {}

    try {
      await this.db
        .insertInto(this.telemetryTable as any)
        .values({
          session_id: sessionId,
          type,
          content: content.substring(0, 50000), // Hard truncated for storage safety
          metadata: JSON.stringify(finalMetadata),
          created_at: new Date(),
        } as any)
        .execute()
    } catch (e) {
      console.warn(`[EventHarvester] Failed to harvest event: ${e}`)
    }
  }
}
