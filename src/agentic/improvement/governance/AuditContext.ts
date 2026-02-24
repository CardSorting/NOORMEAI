import type { Kysely } from '../../../kysely.js'
import type { AgenticConfig } from '../../../types/index.js'
import type { Cortex } from '../../Cortex.js'

export interface AuditContext {
    db: Kysely<any>
    trx: Kysely<any>
    cortex: Cortex
    config: AgenticConfig
    metricsTable: string
    policiesTable: string
    personasTable: string
    skillsTable: string
}

export interface AuditResult {
    issues: string[]
    metadata: Record<string, any>
}
