import type { Kysely } from '../../../kysely.js'
import type { AgenticConfig, AgentCapability } from '../../../types/index.js'
import type { Cortex } from '../../Cortex.js'

export class SkillPropagator {
    async propagate(
        db: Kysely<any>,
        cortex: Cortex,
        config: AgenticConfig,
    ): Promise<number> {
        let broadcastCount = 0
        const capTable = config.capabilitiesTable || 'agent_capabilities'

        // 1. Regular Skill Propagation (Verified Alpha/Shadow)
        const verifiedSkills = await cortex.capabilities.getCapabilities('verified')
        const lineageGroups = new Map<string, any[]>()

        for (const skill of verifiedSkills) {
            const meta = typeof skill.metadata === 'string' ? JSON.parse(skill.metadata) : (skill.metadata || {})
            const lineage = meta.lineage || skill.name
            if (!lineageGroups.has(lineage)) lineageGroups.set(lineage, [])
            lineageGroups.get(lineage)!.push({ skill, meta })
        }

        for (const [_, variants] of lineageGroups.entries()) {
            const alphaCandidate = variants.reduce((prev, curr) => {
                const getScore = (v: any) => {
                    const r = v.skill.reliability ?? 0.5
                    const n = (typeof v.meta === 'string' ? JSON.parse(v.meta) : v.meta)?.usages ?? 1
                    const K = 5
                    const prior = 0.5
                    return (r * n + K * prior) / (n + K)
                }
                return getScore(curr) > getScore(prev) ? curr : prev
            })

            await db.transaction().execute(async (trx) => {
                const currentMeta = alphaCandidate.meta || {}
                const updatedMeta = {
                    ...currentMeta,
                    is_alpha: true,
                    broadcasted: true,
                    broadcasted_at: new Date()
                }

                await trx
                    .updateTable(capTable as any)
                    .set({ metadata: JSON.stringify(updatedMeta) } as any)
                    .where('id', '=', alphaCandidate.skill.id)
                    .execute()

                const shadowIds = variants
                    .filter(v => v.skill.id !== alphaCandidate.skill.id)
                    .map(v => v.skill.id)

                for (const sid of shadowIds) {
                    const sMatch = variants.find(v => v.skill.id === sid)
                    const sMeta = sMatch?.meta || {}
                    await trx.updateTable(capTable as any)
                        .set({
                            metadata: JSON.stringify({ ...sMeta, is_alpha: false, is_shadow: true }),
                            status: 'experimental'
                        } as any)
                        .where('id', '=', sid)
                        .execute()
                }
            })
            broadcastCount++
        }

        // 2. Blacklisted Skill Propagation (Immune Prophet)
        const blacklisted = await cortex.capabilities.getCapabilities('blacklisted')
        const blackIDs = blacklisted
            .filter(s => {
                const meta = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata || {})
                return !meta.broadcasted || !meta.hive_blacklisted
            })
            .map(s => s.id)

        if (blackIDs.length > 0) {
            await db.transaction().execute(async (trx) => {
                for (const bid of blackIDs) {
                    const skill = await trx.selectFrom(capTable as any)
                        .select('metadata')
                        .where('id', '=', bid)
                        .executeTakeFirst()

                    if (skill) {
                        const meta = typeof (skill as any).metadata === 'string' ? JSON.parse((skill as any).metadata) : ((skill as any).metadata || {})
                        await trx.updateTable(capTable as any)
                            .set({
                                metadata: JSON.stringify({ ...meta, broadcasted: true, hive_blacklisted: true }),
                                updated_at: new Date()
                            } as any)
                            .where('id', '=', bid)
                            .execute()
                    }
                }
            })
            broadcastCount += blackIDs.length
        }

        return broadcastCount
    }
}
