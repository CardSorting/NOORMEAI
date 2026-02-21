import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { optimize } from '../../../src/cli/commands/optimize.js'
import { createTestContext, cleanupTestContext, ConsoleCapture, createMockNOORMMEWithBehavior } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Optimize Command', () => {
  let testContext: any
  let consoleCapture: ConsoleCapture

  beforeEach(async () => {
    testContext = await createTestContext()
    consoleCapture = new ConsoleCapture()
    consoleCapture.start()
  })

  afterEach(async () => {
    consoleCapture.stop()
    await cleanupTestContext(testContext)
  })

  describe('Basic optimization', () => {
    it('should run all optimizations by default', async () => {
      await optimize({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('NOORMME SQLite Optimization')).toBe(true)
      expect(consoleCapture.hasOutput('Automating Performance')).toBe(true)
      expect(consoleCapture.hasOutput('Database:')).toBe(true)
      expect(consoleCapture.hasOutput('DRY RUN MODE')).toBe(false) // Should not be in dry run mode
    })

    it('should apply PRAGMA optimizations', async () => {
      await optimize({
        database: testContext.databasePath,
        pragma: true
      })

      expect(consoleCapture.hasOutput('Applying PRAGMA optimizations')).toBe(true)
      expect(consoleCapture.hasOutput('Applied 3 PRAGMA optimizations')).toBe(true)
      expect(consoleCapture.hasOutput('Enabled WAL mode')).toBe(true)
      expect(consoleCapture.hasOutput('Set cache size to 64MB')).toBe(true)
      expect(consoleCapture.hasOutput('Enabled foreign key constraints')).toBe(true)
    })

    it('should apply index recommendations', async () => {
      await optimize({
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('Analyzing and applying index recommendations')).toBe(true)
      expect(consoleCapture.hasOutput('Applied 2 index recommendations')).toBe(true)
    })

    it('should run ANALYZE for query optimization', async () => {
      await optimize({
        database: testContext.databasePath,
        analyze: true
      })

      expect(consoleCapture.hasOutput('Running ANALYZE for query optimization')).toBe(true)
      expect(consoleCapture.hasOutput('ANALYZE completed successfully')).toBe(true)
    })

    it('should enable WAL mode', async () => {
      await optimize({
        database: testContext.databasePath,
        wal: true
      })

      expect(consoleCapture.hasOutput('Configuring WAL mode for better concurrency')).toBe(true)
      expect(consoleCapture.hasOutput('WAL mode enabled successfully')).toBe(true)
    })

    it('should show performance metrics', async () => {
      await optimize({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Current Performance Metrics:')).toBe(true)
      expect(consoleCapture.hasOutput('Cache hit rate: 85.0%')).toBe(true)
      expect(consoleCapture.hasOutput('Average query time: 45.20ms')).toBe(true)
      expect(consoleCapture.hasOutput('Database size: 2.00MB')).toBe(true)
      expect(consoleCapture.hasOutput('Page count: 500')).toBe(true)
    })

    it('should show optimization summary', async () => {
      await optimize({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Optimization Completed Successfully')).toBe(true)
      expect(consoleCapture.hasOutput('Applied')).toBe(true)
      expect(consoleCapture.hasOutput('optimizations')).toBe(true)
      expect(consoleCapture.hasOutput('Next Steps:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme analyze')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme watch')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme status')).toBe(true)
    })
  })

  describe('Dry run mode', () => {
    it('should show what would be optimized without applying changes', async () => {
      await optimize({
        database: testContext.databasePath,
        dryRun: true
      })

      expect(consoleCapture.hasOutput('DRY RUN MODE - No changes will be applied')).toBe(true)
      expect(consoleCapture.hasOutput('Would apply PRAGMA optimizations:')).toBe(true)
      expect(consoleCapture.hasOutput('Would run ANALYZE to update query statistics')).toBe(true)
      expect(consoleCapture.hasOutput('Would enable WAL mode for better concurrency')).toBe(true)
      expect(consoleCapture.hasOutput('To apply these optimizations, run:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme optimize')).toBe(true)
    })

    it('should not apply actual optimizations in dry run mode', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        applySQLiteOptimizations: jest.fn(),
        applySQLiteIndexRecommendations: jest.fn(),
        runSQLiteAnalyze: jest.fn(),
        enableSQLiteWALMode: jest.fn()
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        dryRun: true
      })

      expect(mockNOORMME.applySQLiteOptimizations).not.toHaveBeenCalled()
      expect(mockNOORMME.applySQLiteIndexRecommendations).not.toHaveBeenCalled()
      expect(mockNOORMME.runSQLiteAnalyze).not.toHaveBeenCalled()
      expect(mockNOORMME.enableSQLiteWALMode).not.toHaveBeenCalled()
    })
  })

  describe('Individual optimization options', () => {
    it('should skip PRAGMA optimizations when disabled', async () => {
      await optimize({
        database: testContext.databasePath,
        pragma: false
      })

      expect(consoleCapture.hasOutput('Applying PRAGMA optimizations')).toBe(false)
    })

    it('should skip index recommendations when disabled', async () => {
      await optimize({
        database: testContext.databasePath,
        indexes: false
      })

      expect(consoleCapture.hasOutput('Analyzing and applying index recommendations')).toBe(false)
    })

    it('should skip ANALYZE when disabled', async () => {
      await optimize({
        database: testContext.databasePath,
        analyze: false
      })

      expect(consoleCapture.hasOutput('Running ANALYZE for query optimization')).toBe(false)
    })

    it('should skip WAL mode configuration when disabled', async () => {
      await optimize({
        database: testContext.databasePath,
        wal: false
      })

      expect(consoleCapture.hasOutput('Configuring WAL mode for better concurrency')).toBe(false)
    })
  })

  describe('Error handling', () => {
    it('should handle PRAGMA optimization errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteOptimizations: jest.fn().mockRejectedValue(new Error('PRAGMA optimization failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        pragma: true
      })

      expect(consoleCapture.hasOutput('PRAGMA optimization failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle index optimization errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockRejectedValue(new Error('Index optimization failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('Index optimization failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle ANALYZE errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        runSQLiteAnalyze: jest.fn().mockRejectedValue(new Error('ANALYZE failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        analyze: true
      })

      expect(consoleCapture.hasOutput('ANALYZE failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle WAL mode configuration errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        enableSQLiteWALMode: jest.fn().mockRejectedValue(new Error('WAL mode configuration failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        wal: true
      })

      expect(consoleCapture.hasOutput('WAL mode configuration failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle performance metrics errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockRejectedValue(new Error('Performance metrics failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Failed to get performance metrics')).toBe(true)
    })

    it('should handle database connection errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        initialize: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(optimize({
        database: testContext.databasePath
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Optimization failed')).toBe(true)
    })
  })

  describe('Warnings handling', () => {
    it('should display warnings when present', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteOptimizations: jest.fn().mockResolvedValue({
          appliedOptimizations: ['Enabled WAL mode'],
          warnings: ['Some warning message', 'Another warning']
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        pragma: true
      })

      expect(consoleCapture.hasOutput('2 warnings')).toBe(true)
      expect(consoleCapture.hasOutput('Some warning message')).toBe(true)
      expect(consoleCapture.hasOutput('Another warning')).toBe(true)
    })
  })

  describe('No recommendations scenarios', () => {
    it('should handle no index recommendations', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
          recommendations: []
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('No index recommendations found')).toBe(true)
    })

    it('should handle no optimizations to apply', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteOptimizations: jest.fn().mockResolvedValue({
          appliedOptimizations: [],
          warnings: []
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath,
        pragma: true
      })

      expect(consoleCapture.hasOutput('Applied 0 PRAGMA optimizations')).toBe(true)
    })
  })

  describe('Environment variable support', () => {
    it('should use DATABASE_PATH environment variable when database option is not provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      process.env.DATABASE_PATH = testContext.databasePath

      await optimize({})

      expect(consoleCapture.hasOutput('Database:')).toBe(true)
      expect(consoleCapture.hasOutput(testContext.databasePath)).toBe(true)

      // Restore original environment
      if (originalEnv) {
        process.env.DATABASE_PATH = originalEnv
      } else {
        delete process.env.DATABASE_PATH
      }
    })

    it('should use default database path when no option or environment variable is provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      delete process.env.DATABASE_PATH

      await optimize({})

      expect(consoleCapture.hasOutput('Database: ./database.sqlite')).toBe(true)

      // Restore original environment
      if (originalEnv) {
        process.env.DATABASE_PATH = originalEnv
      }
    })
  })

  describe('Optimization combinations', () => {
    it('should run all optimizations when all options are enabled', async () => {
      await optimize({
        database: testContext.databasePath,
        pragma: true,
        indexes: true,
        analyze: true,
        wal: true
      })

      expect(consoleCapture.hasOutput('Applying PRAGMA optimizations')).toBe(true)
      expect(consoleCapture.hasOutput('Analyzing and applying index recommendations')).toBe(true)
      expect(consoleCapture.hasOutput('Running ANALYZE for query optimization')).toBe(true)
      expect(consoleCapture.hasOutput('Configuring WAL mode for better concurrency')).toBe(true)
    })

    it('should run only specific optimizations when others are disabled', async () => {
      await optimize({
        database: testContext.databasePath,
        pragma: true,
        indexes: false,
        analyze: false,
        wal: false
      })

      expect(consoleCapture.hasOutput('Applying PRAGMA optimizations')).toBe(true)
      expect(consoleCapture.hasOutput('Analyzing and applying index recommendations')).toBe(false)
      expect(consoleCapture.hasOutput('Running ANALYZE for query optimization')).toBe(false)
      expect(consoleCapture.hasOutput('Configuring WAL mode for better concurrency')).toBe(false)
    })
  })

  describe('Performance metrics display', () => {
    it('should format performance metrics correctly', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockResolvedValue({
          cacheHitRate: 0.8567,
          averageQueryTime: 123.456,
          databaseSize: 3145728, // 3MB
          pageCount: 1234,
          freePages: 56
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await optimize({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Cache hit rate: 85.7%')).toBe(true)
      expect(consoleCapture.hasOutput('Average query time: 123.46ms')).toBe(true)
      expect(consoleCapture.hasOutput('Database size: 3.00MB')).toBe(true)
      expect(consoleCapture.hasOutput('Page count: 1,234')).toBe(true)
      expect(consoleCapture.hasOutput('Free pages: 56')).toBe(true)
    })
  })
})
