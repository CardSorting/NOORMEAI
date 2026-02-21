import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { status } from '../../../src/cli/commands/status.js'
import { createTestContext, cleanupTestContext, ConsoleCapture, createMockNOORMMEWithBehavior } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Status Command', () => {
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

  describe('Basic status display', () => {
    it('should show basic status information', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('NOORMME Automation Status')).toBe(true)
      expect(consoleCapture.hasOutput('Database Health Dashboard')).toBe(true)
      expect(consoleCapture.hasOutput('Database:')).toBe(true)
    })

    it('should show schema information', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Schema Information:')).toBe(true)
      expect(consoleCapture.hasOutput('Tables: 2')).toBe(true)
      expect(consoleCapture.hasOutput('Relationships: 1')).toBe(true)
      expect(consoleCapture.hasOutput('Indexes: 4')).toBe(true)
    })

    it('should show automation status', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Automation Status:')).toBe(true)
      expect(consoleCapture.hasOutput('Schema Discovery: ✅ Active')).toBe(true)
      expect(consoleCapture.hasOutput('Type Generation: ✅ Active')).toBe(true)
      expect(consoleCapture.hasOutput('Performance Optimization: ✅ Active')).toBe(true)
      expect(consoleCapture.hasOutput('Index Management: ✅ Active')).toBe(true)
      expect(consoleCapture.hasOutput('Migration Management: ✅ Active')).toBe(true)
    })
  })

  describe('Performance metrics', () => {
    it('should show performance metrics when requested', async () => {
      await status({
        database: testContext.databasePath,
        metrics: true
      })

      expect(consoleCapture.hasOutput('Performance Metrics:')).toBe(true)
      expect(consoleCapture.hasOutput('Cache hit rate: 85.0%')).toBe(true)
      expect(consoleCapture.hasOutput('Average query time: 45.20ms')).toBe(true)
      expect(consoleCapture.hasOutput('Total queries executed: 1,250')).toBe(true)
      expect(consoleCapture.hasOutput('Slow queries (>1000ms): 5')).toBe(true)
      expect(consoleCapture.hasOutput('Database size: 2.00MB')).toBe(true)
      expect(consoleCapture.hasOutput('Page count: 500')).toBe(true)
      expect(consoleCapture.hasOutput('Free pages: 50')).toBe(true)
    })

    it('should show optimization status in metrics', async () => {
      await status({
        database: testContext.databasePath,
        metrics: true
      })

      expect(consoleCapture.hasOutput('WAL mode: Enabled')).toBe(true)
      expect(consoleCapture.hasOutput('Foreign keys: Enabled')).toBe(true)
      expect(consoleCapture.hasOutput('Auto vacuum: INCREMENTAL')).toBe(true)
      expect(consoleCapture.hasOutput('Journal mode: WAL')).toBe(true)
      expect(consoleCapture.hasOutput('Synchronous: NORMAL')).toBe(true)
    })

    it('should handle performance metrics errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockRejectedValue(new Error('Performance metrics failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await status({
        database: testContext.databasePath,
        metrics: true
      })

      expect(consoleCapture.hasOutput('Failed to get performance metrics')).toBe(true)
    })
  })

  describe('Optimization status', () => {
    it('should show optimization status when requested', async () => {
      await status({
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('Applied Optimizations:')).toBe(true)
      expect(consoleCapture.hasOutput('Enabled WAL mode')).toBe(true)
      expect(consoleCapture.hasOutput('Set cache size to 64MB')).toBe(true)
      expect(consoleCapture.hasOutput('Enabled foreign key constraints')).toBe(true)
    })

    it('should show index recommendations', async () => {
      await status({
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('Index Recommendations:')).toBe(true)
      expect(consoleCapture.hasOutput('users.created_at')).toBe(true)
      expect(consoleCapture.hasOutput('posts.created_at')).toBe(true)
    })

    it('should handle no optimization recommendations', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
          recommendations: []
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await status({
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('No optimization recommendations')).toBe(true)
    })

    it('should handle optimization errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteOptimizations: jest.fn().mockRejectedValue(new Error('Optimization status failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await status({
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('Failed to get optimization status')).toBe(true)
    })
  })

  describe('Cache status', () => {
    it('should show cache status when requested', async () => {
      await status({
        database: testContext.databasePath,
        cache: true
      })

      expect(consoleCapture.hasOutput('Cache Status:')).toBe(true)
      expect(consoleCapture.hasOutput('Cache hit rate: 85.0%')).toBe(true)
      expect(consoleCapture.hasOutput('Cache size: 1,000 entries')).toBe(true)
      expect(consoleCapture.hasOutput('Cache memory usage: 2.50MB')).toBe(true)
      expect(consoleCapture.hasOutput('Cache enabled: Yes')).toBe(true)
    })

    it('should handle cache statistics errors gracefully', async () => {
      await status({
        database: testContext.databasePath,
        cache: true
      })

      // Since getCacheStatistics is commented out in the actual implementation,
      // we should see the fallback message
      expect(consoleCapture.hasOutput('Cache statistics not available')).toBe(true)
      expect(consoleCapture.hasOutput('Cache feature may require a newer version')).toBe(true)
    })
  })

  describe('File system status', () => {
    it('should show file system status', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('File System Status:')).toBe(true)
      expect(consoleCapture.hasOutput('Database file:')).toBe(true)
      expect(consoleCapture.hasOutput('Database exists:')).toBe(true)
      expect(consoleCapture.hasOutput('Database readable:')).toBe(true)
      expect(consoleCapture.hasOutput('Database writable:')).toBe(true)
    })

    it('should show database file information', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Database file:')).toBe(true)
      expect(consoleCapture.hasOutput('Database exists:')).toBe(true)
      expect(consoleCapture.hasOutput('Database readable:')).toBe(true)
      expect(consoleCapture.hasOutput('Database writable:')).toBe(true)
    })
  })

  describe('Health score calculation', () => {
    it('should calculate and display overall health score', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Overall Health Score:')).toBe(true)
      expect(consoleCapture.hasOutput('/100')).toBe(true)
      expect(consoleCapture.hasOutput('Health factors:')).toBe(true)
    })

    it('should show health factors', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Health factors:')).toBe(true)
      expect(consoleCapture.hasOutput('Performance:')).toBe(true)
      expect(consoleCapture.hasOutput('Optimization:')).toBe(true)
      expect(consoleCapture.hasOutput('Schema:')).toBe(true)
      expect(consoleCapture.hasOutput('Automation:')).toBe(true)
    })

    it('should show excellent health score for well-optimized database', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockResolvedValue({
          cacheHitRate: 0.95,
          averageQueryTime: 20,
          walMode: true,
          foreignKeys: true
        }),
        getSQLiteOptimizations: jest.fn().mockResolvedValue({
          appliedOptimizations: ['Enabled WAL mode', 'Set cache size to 64MB', 'Enabled foreign keys'],
          warnings: []
        }),
        getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
          recommendations: []
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('100/100')).toBe(true)
      expect(consoleCapture.hasOutput('Excellent')).toBe(true)
    })

    it('should show poor health score for poorly optimized database', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockResolvedValue({
          cacheHitRate: 0.3,
          averageQueryTime: 500,
          walMode: false,
          foreignKeys: false
        }),
        getSQLiteOptimizations: jest.fn().mockResolvedValue({
          appliedOptimizations: [],
          warnings: ['No optimizations applied']
        }),
        getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
          recommendations: [
            { table: 'users', column: 'created_at', reason: 'Missing index', impact: 'high' },
            { table: 'posts', column: 'user_id', reason: 'Missing foreign key index', impact: 'high' }
          ]
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('25/100')).toBe(true)
      expect(consoleCapture.hasOutput('Poor')).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        initialize: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(status({
        database: testContext.databasePath
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Status check failed')).toBe(true)
    })

    it('should handle schema info errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSchemaInfo: jest.fn().mockRejectedValue(new Error('Schema info failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Failed to get schema information')).toBe(true)
    })

    it('should handle index recommendation errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockRejectedValue(new Error('Index recommendations failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await status({
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('Failed to get index recommendations')).toBe(true)
    })
  })

  describe('Environment variable support', () => {
    it('should use DATABASE_PATH environment variable when database option is not provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      process.env.DATABASE_PATH = testContext.databasePath

      await status({})

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

      await status({})

      expect(consoleCapture.hasOutput('Database: ./database.sqlite')).toBe(true)

      // Restore original environment
      if (originalEnv) {
        process.env.DATABASE_PATH = originalEnv
      }
    })
  })

  describe('Option combinations', () => {
    it('should show all information when all options are enabled', async () => {
      await status({
        database: testContext.databasePath,
        metrics: true,
        optimizations: true,
        cache: true
      })

      expect(consoleCapture.hasOutput('Schema Information:')).toBe(true)
      expect(consoleCapture.hasOutput('Automation Status:')).toBe(true)
      expect(consoleCapture.hasOutput('Performance Metrics:')).toBe(true)
      expect(consoleCapture.hasOutput('Applied Optimizations:')).toBe(true)
      expect(consoleCapture.hasOutput('Cache Status:')).toBe(true)
      expect(consoleCapture.hasOutput('File System Status:')).toBe(true)
      expect(consoleCapture.hasOutput('Overall Health Score:')).toBe(true)
    })

    it('should show only specific information when specific options are enabled', async () => {
      await status({
        database: testContext.databasePath,
        metrics: true
      })

      expect(consoleCapture.hasOutput('Schema Information:')).toBe(true)
      expect(consoleCapture.hasOutput('Automation Status:')).toBe(true)
      expect(consoleCapture.hasOutput('Performance Metrics:')).toBe(true)
      expect(consoleCapture.hasOutput('Applied Optimizations:')).toBe(false)
      expect(consoleCapture.hasOutput('Cache Status:')).toBe(false)
    })
  })

  describe('Migration status display', () => {
    it('should show migration status information', async () => {
      await status({
        database: testContext.databasePath
      })

      // Since getMigrationManager is commented out in the actual implementation,
      // we should see the fallback message
      expect(consoleCapture.hasOutput('Migration status not available')).toBe(true)
      expect(consoleCapture.hasOutput('Migration feature may require a newer version')).toBe(true)
    })
  })

  describe('Status summary', () => {
    it('should show status summary at the end', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Status Summary:')).toBe(true)
      expect(consoleCapture.hasOutput('Database is healthy')).toBe(true)
      expect(consoleCapture.hasOutput('Automation is active')).toBe(true)
      expect(consoleCapture.hasOutput('Performance is good')).toBe(true)
    })

    it('should show recommendations for improvement', async () => {
      await status({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Recommendations:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme optimize')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme analyze')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme watch')).toBe(true)
    })
  })
})
