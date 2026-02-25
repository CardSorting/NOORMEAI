import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { CognitiveRepository } from '../../src/agentic/CognitiveRepository.js'

describe('CognitiveRepository', () => {
    let mockRepository: any
    let mockCortex: any
    let mockTable: any

    beforeEach(() => {
        mockRepository = {
            create: jest.fn().mockImplementation((data: any) => Promise.resolve({ id: 1, ...data })),
            update: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
            delete: jest.fn().mockResolvedValue(true as never),
            findById: jest.fn().mockResolvedValue({ id: 1, name: 'test' } as never),
            findAll: jest.fn().mockResolvedValue([{ id: 1 }] as never),
            count: jest.fn().mockResolvedValue(5 as never),
            exists: jest.fn().mockResolvedValue(true as never),
        }

        mockTable = { name: 'test_table' }

        mockCortex = {
            rules: null,
            reflections: {
                reflect: jest.fn().mockResolvedValue(undefined as never),
            },
        }
    })

    describe('create/update/delete without rules', () => {
        it('should delegate create to underlying repository when no rules defined', async () => {
            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const result = await repo.create({ name: 'item' })

            expect(result).toEqual({ id: 1, name: 'item' })
            expect(mockRepository.create).toHaveBeenCalledWith({ name: 'item' })
        })

        it('should delegate update to underlying repository', async () => {
            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const entity = { id: 1, name: 'updated' }
            const result = await repo.update(entity)

            expect(result).toEqual(entity)
            expect(mockRepository.update).toHaveBeenCalled()
        })

        it('should delegate delete to underlying repository', async () => {
            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const result = await repo.delete(1)

            expect(result).toBe(true)
            expect(mockRepository.delete).toHaveBeenCalledWith(1)
        })
    })

    describe('create with rules', () => {
        it('should throw NoormError when rule denies operation', async () => {
            mockCortex.rules = {
                evaluateRules: jest.fn().mockResolvedValue({
                    action: 'deny',
                    reason: 'Blocked by policy',
                } as never),
                getActiveRules: jest.fn().mockResolvedValue([] as never),
            }

            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)

            await expect(repo.create({ name: 'blocked' })).rejects.toThrow('denied')
            expect(mockRepository.create).not.toHaveBeenCalled()
        })

        it('should log reflection when rule triggers audit', async () => {
            mockCortex.rules = {
                evaluateRules: jest.fn().mockResolvedValue({
                    action: 'audit',
                    ruleId: 'rule_1',
                } as never),
            }

            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            await repo.create({ name: 'audited' })

            expect(mockCortex.reflections.reflect).toHaveBeenCalled()
            expect(mockRepository.create).toHaveBeenCalled()
        })

        it('should apply masking when rule triggers mask', async () => {
            const maskedData = { name: '***MASKED***' }
            mockCortex.rules = {
                evaluateRules: jest.fn().mockResolvedValue({
                    action: 'mask',
                    ruleId: 'mask_rule',
                } as never),
                getActiveRules: jest.fn().mockResolvedValue([
                    { id: 'mask_rule', fields: ['name'] }
                ] as never),
                applyMasking: jest.fn().mockReturnValue(maskedData),
            }

            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            await repo.create({ name: 'sensitive_data' })

            expect(mockCortex.rules.applyMasking).toHaveBeenCalled()
            expect(mockRepository.create).toHaveBeenCalledWith(maskedData)
        })

        it('should allow operation when rule returns allow', async () => {
            mockCortex.rules = {
                evaluateRules: jest.fn().mockResolvedValue({
                    action: 'allow',
                } as never),
            }

            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const result = await repo.create({ name: 'allowed' })

            expect(result).toEqual({ id: 1, name: 'allowed' })
        })
    })

    describe('delegation methods', () => {
        it('should delegate findById to repository', async () => {
            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const result = await repo.findById(1)
            expect(result).toEqual({ id: 1, name: 'test' })
        })

        it('should delegate findAll to repository', async () => {
            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const result = await repo.findAll()
            expect(result).toEqual([{ id: 1 }])
        })

        it('should delegate count to repository', async () => {
            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const result = await repo.count()
            expect(result).toBe(5)
        })

        it('should delegate exists to repository', async () => {
            const repo = new CognitiveRepository(mockRepository, mockTable, mockCortex)
            const result = await repo.exists(1)
            expect(result).toBe(true)
        })
    })

    describe('Proxy', () => {
        it('should create a proxy that routes known methods through CognitiveRepository', () => {
            const proxy = CognitiveRepository.createProxy(
                mockRepository,
                mockTable,
                mockCortex
            )

            // Should have all repository methods
            expect(typeof proxy.create).toBe('function')
            expect(typeof proxy.update).toBe('function')
            expect(typeof proxy.delete).toBe('function')
            expect(typeof proxy.findById).toBe('function')
        })
    })
})
