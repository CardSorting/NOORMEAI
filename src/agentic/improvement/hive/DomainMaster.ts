import type { Kysely } from '../../../kysely.js'
import type { AgenticConfig } from '../../../types/index.js'
import { sql } from '../../../raw-builder/sql.js'

export class DomainMaster {
    async boostDomain(
        db: Kysely<any>,
        knowledgeTable: string,
        domainTag: string,
        boostFactor: number = 0.05
    ): Promise<number> {
        const result = await db
            .updateTable(knowledgeTable as any)
            .set({
                confidence: sql`MIN(1.0, confidence + ${boostFactor})`,
                updated_at: new Date(),
            } as any)
            .where('tags', 'like', `%"${domainTag}"%`)
            .where('confidence', '<', 1.0)
            .execute()

        return Number((result as any)[0]?.numUpdatedRows ?? 1)
    }
}
