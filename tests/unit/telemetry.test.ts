import { TelemetryOrchestrator } from '../../src/agentic/telemetry/TelemetryOrchestrator.js'

describe('Deep Telemetry Integration', () => {
    let db: any
    let telemetry: TelemetryOrchestrator

    beforeEach(() => {
        // Mock DB with transaction support
        const trxMock = {
            insertInto: jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    execute: jest.fn().mockResolvedValue({ id: 1 }),
                    returningAll: jest.fn().mockReturnValue({
                        executeTakeFirstOrThrow: jest.fn().mockResolvedValue({ id: 1 })
                    })
                })
            }),
            updateTable: jest.fn().mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        execute: jest.fn().mockResolvedValue({ id: 1 }),
                        returningAll: jest.fn().mockReturnValue({
                            executeTakeFirstOrThrow: jest.fn().mockResolvedValue({ id: 1 })
                        })
                    })
                })
            }),
            selectFrom: jest.fn().mockReturnValue({
                selectAll: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        executeTakeFirst: jest.fn().mockResolvedValue(null)
                    })
                })
            })
        }

        db = {
            ...trxMock,
            transaction: jest.fn().mockReturnValue({
                execute: jest.fn().mockImplementation(async (callback) => {
                    return await callback(trxMock)
                })
            })
        }

        telemetry = new TelemetryOrchestrator(db as any, {
            telemetryEventsTable: 'agent_telemetry_events',
            sessionEvolutionTable: 'agent_session_evolution',
            researchMetricsTable: 'agent_research_metrics'
        })
    })

    test('track() prompt should log raw events and trigger hardened synthesizer', async () => {
        await telemetry.track('session-123', 'prompt', 'I need to implement a new feature')

        // Layer A
        expect(db.insertInto).toHaveBeenCalledWith('agent_telemetry_events')

        // Layer B (via transaction)
        // Note: within transaction, we use the trxMock. We check if transaction() was called.
        expect(db.transaction).toHaveBeenCalled()
    })

    test('pivot events should document path in evolutionTable', async () => {
        await telemetry.track('session-123', 'pivot', 'Changing direction')
        expect(db.transaction).toHaveBeenCalled()
    })

    test('magic events should trigger alchemist', async () => {
        await telemetry.track('session-123', 'magic', 'Unexpected success', { surpriseScore: 1.0 })
        expect(db.insertInto).toHaveBeenCalledWith('agent_research_metrics')
    })
})
