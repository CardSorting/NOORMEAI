import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, AgentGoal } from '../../types/index.js'

interface GoalTable {
  id: number | string
  session_id: number | string
  description: string
  status: string
  created_at: string | Date
  updated_at: string | Date
}

interface ReflectionTable {
  lessons_learned: string | null
}

interface ReasonerDatabase {
  agent_goals: GoalTable
  agent_reflections: ReflectionTable
}

/**
 * RecursiveReasoner performs cross-session analysis to find patterns
 * and progress across the agent's entire history.
 */
export class RecursiveReasoner {
  private goalsTable: string
  private conflictPairs: [string, string][] = [
    ['minimize', 'maximize'],
    ['increase', 'decrease'],
    ['low', 'high'],
    ['fast', 'slow'],
    ['short', 'long'],
    ['start', 'stop'],
    ['enable', 'disable'],
  ]
  private stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'with',
    'from',
  ])

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.goalsTable = config.goalsTable || 'agent_goals'
  }

  private get typedDb(): Kysely<ReasonerDatabase> {
    return this.db as unknown as Kysely<ReasonerDatabase>
  }

  /**
   * Find goals matching a pattern across all sessions
   */
  async analyzeGlobalProgress(pattern: string): Promise<AgentGoal[]> {
    const goals = (await this.typedDb
      .selectFrom(this.goalsTable as any)
      .selectAll()
      .where('description', 'like', `%${pattern}%`)
      .orderBy('created_at', 'desc')
      .execute()) as unknown as GoalTable[]

    return goals.map(this.parseGoal)
  }

  /**
   * Synthesize high-level lessons and cluster similar ones using Token-Weighted significance.
   * Pass 5: High-Throughput Semantic Analysis.
   */
  async synthesizeLessons(): Promise<Record<string, string[]>> {
    console.log(
      '[RecursiveReasoner] Performing high-throughput weighted token clustering...',
    )

    const reflectionsTable = this.config.reflectionsTable || 'agent_reflections'
    const results = (await this.typedDb
      .selectFrom(reflectionsTable as any)
      .select('lessons_learned')
      .where('lessons_learned', 'is not', null)
      .execute()) as unknown as ReflectionTable[]

    const rawLessons: string[] = results
      .map((l) => l.lessons_learned!)
      .filter(Boolean)
    const clusters: Record<string, string[]> = {}

    // Global Token Frequency Pass
    const globalTokenFreq = new Map<string, number>()
    const maxItems = (this.config as any).maxSynthesisItems || 500
    const limitedResults = rawLessons.slice(0, maxItems)

    for (const lesson of limitedResults) {
      for (const token of this.tokenize(lesson)) {
        globalTokenFreq.set(token, (globalTokenFreq.get(token) || 0) + 1)
      }
    }

    for (const lesson of limitedResults) {
      const tokens = this.tokenize(lesson)
      if (tokens.length === 0) continue

      // Weight tokens by (length * global_rarity) to find the most "defining" token
      // Rarity = 1 / Frequency
      const definingToken =
        tokens.sort((a, b) => {
          const weightA = a.length * (1 / (globalTokenFreq.get(a) || 1))
          const weightB = b.length * (1 / (globalTokenFreq.get(b) || 1))
          return weightB - weightA
        })[0] || 'general'

      if (!clusters[definingToken]) {
        clusters[definingToken] = []
      }
      clusters[definingToken].push(lesson)
    }

    return clusters
  }

  /**
   * Pass 6: Goal Cross-Pollination
   * Distill successful persona mutations into global systemic goals.
   */
  async crossPollinateGoals(): Promise<number> {
    console.log(
      '[RecursiveReasoner] Cross-pollinating successful persona breakthroughs into global goals...',
    )

    const personasTable = this.config.personasTable || 'agent_personas'
    const goalsTable = this.config.goalsTable || 'agent_goals'

    // Find personas with 'stable' evolution status (proven breakthroughs)
    const breakthroughs = await this.typedDb
      .selectFrom(personasTable as any)
      .selectAll()
      .where('metadata', 'like', '%"evolution_status":"stable"%')
      .execute()

    // Audit Phase 14: Linear Batch Check
    const descriptions = breakthroughs
      .map((p: any) => {
        const meta = JSON.parse(p.metadata || '{}')
        const reasoning = meta.mutation_reasoning || meta.reasoning
        return reasoning ? `Systemic Best-Practice: ${reasoning}` : null
      })
      .filter(Boolean) as string[]

    if (descriptions.length === 0) return 0

    const existingGoals = await this.typedDb
      .selectFrom(goalsTable as any)
      .select('description')
      .where('description', 'in', descriptions)
      .execute()

    const existingSet = new Set(existingGoals.map((g) => g.description))
    let goalsCreated = 0

    for (const desc of descriptions) {
      if (!existingSet.has(desc)) {
        console.log(`[RecursiveReasoner] Distilling breakthrough into Global Goal: ${desc.slice(0, 50)}...`)
        await this.typedDb
          .insertInto(goalsTable as any)
          .values({
            session_id: 0, // System-level goal
            description: desc,
            status: 'pending',
            priority: 5,
            metadata: JSON.stringify({
              cross_pollinated: true,
            }),
            created_at: new Date(),
            updated_at: new Date(),
          } as any)
          .execute()
        goalsCreated++
      }
    }

    return goalsCreated
  }

  /**
   * Detect contradictions in goals (e.g., opposing objectives).
   */
  async detectContradictions(): Promise<string[]> {
    console.log(
      '[RecursiveReasoner] Detecting logical contradictions in systemic goals...',
    )

    const activeGoals = (await this.typedDb
      .selectFrom(this.goalsTable as any)
      .selectAll()
      .where('status', '=', 'active')
      .execute()) as unknown as GoalTable[]

    const contradictions: string[] = []
    const subjectMap = new Map<string, { desc: string; keywords: Set<string> }[]>()

    // Audit Phase 7: O(N) Linear Contradiction Detection
    for (const goal of activeGoals) {
      const tokens = this.tokenize(goal.description)
      for (const token of tokens) {
        if (!subjectMap.has(token)) subjectMap.set(token, [])
        subjectMap.get(token)!.push({ desc: goal.description, keywords: new Set(tokens) })
      }
    }

    for (const [subject, entries] of subjectMap.entries()) {
      if (entries.length < 2) continue
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const conflict = this.checkConflict(entries[i].desc, entries[j].desc)
          if (conflict) {
            contradictions.push(`Goal Conflict: "${entries[i].desc}" opposes "${entries[j].desc}" regarding '${conflict}'`)
            // Limit duplicates for the same pair
            if (contradictions.length > 50) break
          }
        }
        if (contradictions.length > 50) break
      }
      if (contradictions.length > 50) break
    }

    return contradictions
  }

  /**
   * Register a new conflict pair (e.g. ['buy', 'sell'])
   */
  registerConflictPair(word1: string, word2: string): void {
    this.conflictPairs.push([word1.toLowerCase(), word2.toLowerCase()])
  }

  private checkConflict(text1: string, text2: string): string | null {
    const t1 = text1.toLowerCase()
    const t2 = text2.toLowerCase()

    // Check explicit opposites
    for (const [op1, op2] of this.conflictPairs) {
      if (
        (t1.includes(op1) && t2.includes(op2)) ||
        (t1.includes(op2) && t2.includes(op1))
      ) {
        // Determine the subject of conflict (common words)
        const intersection = this.intersect(
          this.tokenize(t1),
          this.tokenize(t2),
        )
        // If they share a subject (e.g. "latency"), it's a conflict
        if (intersection.length > 0) {
          return intersection.join(', ')
        }
        // If they are just opposites without common subject, it might be vague, but we'll flag the pair
        return `${op1}/${op2}`
      }
    }
    return null
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[\W_]+/)
      .filter((w) => w.length > 2 && !this.stopWords.has(w))
  }

  private intersect(arr1: string[], arr2: string[]): string[] {
    const s2 = new Set(arr2)
    return arr1.filter((x) => s2.has(x))
  }

  private parseGoal(g: any): AgentGoal {
    return {
      id: g.id,
      sessionId: g.session_id,
      parentId: g.parent_id,
      description: g.description,
      status: g.status,
      priority: g.priority,
      metadata:
        typeof g.metadata === 'string'
          ? JSON.parse(g.metadata)
          : g.metadata || {},
      createdAt: new Date(g.created_at),
      updatedAt: new Date(g.updated_at),
    }
  }
}
