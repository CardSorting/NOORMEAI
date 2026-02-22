import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  TelemetryEvent,
  ResearchMetric,
} from '../../types/index.js'
import { EventHarvester } from './EventHarvester.js'
import { CognitiveSynthesizer } from './CognitiveSynthesizer.js'
import { ResearchAlchemist } from './ResearchAlchemist.js'

export class TelemetryOrchestrator {
  public harvester: EventHarvester
  public synthesizer: CognitiveSynthesizer
  public alchemist: ResearchAlchemist

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.harvester = new EventHarvester(db, config)
    this.synthesizer = new CognitiveSynthesizer(db, config)
    this.alchemist = new ResearchAlchemist(db, config)
  }

  /**
   * Track a raw event and trigger synthesis
   */
  async track(
    sessionId: string | number,
    type: TelemetryEvent['type'],
    content: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Layer A: Harvest
    await this.harvester.harvest(sessionId, type, content, metadata)

    // Layer B: Synthesize
    if (type === 'prompt' || type === 'action') {
      await this.synthesizer.synthesize(sessionId, content)
    }

    // Layer C: Research triggers
    if (type === 'magic') {
      await this.alchemist.recordMagic(
        sessionId,
        metadata?.surpriseScore || 1.0,
      )
    }

    if (type === 'pivot' || type === 'error') {
      await this.synthesizer.trackShift(
        sessionId,
        type === 'pivot' ? 'pivot' : 'abandonment',
      )
    }
  }

  /**
   * Record interaction metrics
   */
  async logResearchMetric(
    sessionId: string | number,
    metric: ResearchMetric['metricName'],
    value: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.alchemist.transmute(sessionId, metric, value, metadata)
  }
}
