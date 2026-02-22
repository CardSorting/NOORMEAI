import type { Kysely } from '../kysely.js'
import type { AgenticConfig, ResourceUsage } from '../types/index.js'
import { sql } from '../raw-builder/sql.js'

export interface ResourceTable {
  id: number | string
  session_id: number | string | null
  agent_id: string | null
  model_name: string
  input_tokens: number
  output_tokens: number
  cost: number
  currency: string
  metadata: string | null // JSON string
  created_at: string | Date
}

export interface ResourceDatabase {
  agent_resource_usage: ResourceTable
}

/**
 * ResourceMonitor tracks token usage and costs across sessions.
 */
export class ResourceMonitor {
  private resourcesTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.resourcesTable = config.resourcesTable || 'agent_resource_usage'
  }

  private get typedDb(): Kysely<ResourceDatabase> {
    return this.db as unknown as Kysely<ResourceDatabase>
  }

  /**
   * Record token usage
   */
  async recordUsage(
    sessionId: string | number,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    cost?: number,
    agentId?: string,
    metadata?: Record<string, any>,
  ): Promise<ResourceUsage> {
    const usage = await this.typedDb
      .insertInto(this.resourcesTable as any)
      .values({
        session_id: sessionId,
        agent_id: agentId || null,
        model_name: modelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: cost || 0,
        currency: 'USD',
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.parseUsage(usage)
  }

  /**
   * Get total cost for a session
   */
  async getSessionTotalCost(sessionId: string | number): Promise<number> {
    const result = await this.typedDb
      .selectFrom(this.resourcesTable as any)
      .select((eb: any) => eb.fn.sum('cost').as('totalCost'))
      .where('session_id', '=', sessionId)
      .executeTakeFirst()

    return Number((result as any)?.totalCost || 0)
  }

  /**
   * Get global total cost across all sessions.
   */
  async getGlobalTotalCost(): Promise<number> {
    const result = await this.typedDb
      .selectFrom(this.resourcesTable as any)
      .select((eb: any) => eb.fn.sum('cost').as('totalCost'))
      .executeTakeFirst()

    return Number((result as any)?.totalCost || 0)
  }

  /**
   * Get usage stats per model.
   */
  async getModelUsageStats(): Promise<
    { modelName: string; totalTokens: number; totalCost: number }[]
  > {
    const results = await this.typedDb
      .selectFrom(this.resourcesTable as any)
      .select([
        'model_name',
        (eb: any) =>
          eb.fn.sum(sql`input_tokens + output_tokens`).as('totalTokens'),
        (eb: any) => eb.fn.sum('cost').as('totalCost'),
      ])
      .groupBy('model_name')
      .execute()

    return results.map((r: any) => ({
      modelName: r.model_name,
      totalTokens: Number(r.totalTokens),
      totalCost: Number(r.totalCost),
    }))
  }

  private parseUsage(usage: any): ResourceUsage {
    return {
      id: usage.id,
      sessionId: usage.session_id,
      agentId: usage.agent_id,
      modelName: usage.model_name,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cost: usage.cost,
      currency: usage.currency,
      createdAt: new Date(usage.created_at),
    }
  }
}
