import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { analyze } from '../../../src/cli/commands/analyze.js'
import { createTestContext, cleanupTestContext, ConsoleCapture, createMockNOORMMEWithBehavior } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Analyze Command', () => {
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

  describe('Basic analysis', () => {
    it('should run query pattern analysis by default', async () => {
      await analyze({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('NOORMME Query Analysis')).toBe(true)
      expect(consoleCapture.hasOutput('Intelligent Performance Insights')).toBe(true)
      expect(consoleCapture.hasOutput('Database:')).toBe(true)
    })

    it('should show query pattern analysis', async () => {
      await analyze({
        database: testContext.databasePath,
        patterns: true
      })

      expect(consoleCapture.hasOutput('Analyzing Query Patterns')).toBe(true)
      expect(consoleCapture.hasOutput('Query Pattern Analysis:')).toBe(true)
      expect(consoleCapture.hasOutput('Total queries analyzed: 100')).toBe(true)
      expect(consoleCapture.hasOutput('Unique query patterns: 25')).toBe(true)
      expect(consoleCapture.hasOutput('Average execution time: 45.20ms')).toBe(true)
    })

    it('should show frequent queries', async () => {
      await analyze({
        database: testContext.databasePath,
        patterns: true
      })

      expect(consoleCapture.hasOutput('Most Frequent Queries:')).toBe(true)
      expect(consoleCapture.hasOutput('SELECT * FROM users WHERE email = ?')).toBe(true)
      expect(consoleCapture.hasOutput('50 times')).toBe(true)
      expect(consoleCapture.hasOutput('SELECT * FROM posts WHERE user_id = ?')).toBe(true)
      expect(consoleCapture.hasOutput('30 times')).toBe(true)
    })

    it('should show slow queries', async () => {
      await analyze({
        database: testContext.databasePath,
        patterns: true
      })

      expect(consoleCapture.hasOutput('Slow Queries (>1000ms):')).toBe(true)
      expect(consoleCapture.hasOutput('SELECT * FROM users ORDER BY created_at DESC')).toBe(true)
      expect(consoleCapture.hasOutput('1500ms max')).toBe(true)
    })

    it('should show N+1 query patterns', async () => {
      await analyze({
        database: testContext.databasePath,
        patterns: true
      })

      expect(consoleCapture.hasOutput('N+1 Query Patterns Detected:')).toBe(true)
      expect(consoleCapture.hasOutput('User posts query without join')).toBe(true)
      expect(consoleCapture.hasOutput('5 occurrences')).toBe(true)
    })
  })

  describe('Slow query analysis', () => {
    it('should analyze slow queries when requested', async () => {
      await analyze({
        database: testContext.databasePath,
        slowQueries: true
      })

      expect(consoleCapture.hasOutput('Analyzing Slow Queries')).toBe(true)
      expect(consoleCapture.hasOutput('Found 1 slow queries:')).toBe(true)
      expect(consoleCapture.hasOutput('Execution time: 1500ms')).toBe(true)
      expect(consoleCapture.hasOutput('SELECT * FROM users ORDER BY created_at DESC')).toBe(true)
      expect(consoleCapture.hasOutput('Suggestions:')).toBe(true)
      expect(consoleCapture.hasOutput('Add index on created_at column')).toBe(true)
      expect(consoleCapture.hasOutput('Consider pagination')).toBe(true)
    })

    it('should handle no slow queries', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSlowQueries: jest.fn().mockResolvedValue([]) as jest.MockedFunction<() => Promise<any[]>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        slowQueries: true
      })

      expect(consoleCapture.hasOutput('No slow queries detected')).toBe(true)
    })
  })

  describe('Index recommendations', () => {
    it('should show index recommendations when requested', async () => {
      await analyze({
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('Generating Index Recommendations')).toBe(true)
      expect(consoleCapture.hasOutput('Index Recommendations:')).toBe(true)
      expect(consoleCapture.hasOutput('Table: users')).toBe(true)
      expect(consoleCapture.hasOutput('Column: created_at')).toBe(true)
      expect(consoleCapture.hasOutput('Reason: Frequently queried for sorting')).toBe(true)
      expect(consoleCapture.hasOutput('Impact: high')).toBe(true)
      expect(consoleCapture.hasOutput('CREATE INDEX idx_users_created_at ON users(created_at)')).toBe(true)
    })

    it('should handle no index recommendations', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
          recommendations: []
        }) as jest.MockedFunction<() => Promise<any>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('No index recommendations at this time')).toBe(true)
    })
  })

  describe('Detailed performance report', () => {
    it('should generate detailed performance report when requested', async () => {
      await analyze({
        database: testContext.databasePath,
        report: true
      })

      expect(consoleCapture.hasOutput('Generating Detailed Performance Report')).toBe(true)
      expect(consoleCapture.hasOutput('Performance Report for')).toBe(true)
      expect(consoleCapture.hasOutput('Database Information:')).toBe(true)
      expect(consoleCapture.hasOutput('Tables: 2')).toBe(true)
      expect(consoleCapture.hasOutput('Relationships: 1')).toBe(true)
      expect(consoleCapture.hasOutput('Database size: 2.00MB')).toBe(true)
      expect(consoleCapture.hasOutput('Page count: 500')).toBe(true)
      expect(consoleCapture.hasOutput('Free pages: 50')).toBe(true)
    })

    it('should show performance metrics in report', async () => {
      await analyze({
        database: testContext.databasePath,
        report: true
      })

      expect(consoleCapture.hasOutput('Performance Metrics:')).toBe(true)
      expect(consoleCapture.hasOutput('Cache hit rate: 85.0%')).toBe(true)
      expect(consoleCapture.hasOutput('Average query time: 45.20ms')).toBe(true)
      expect(consoleCapture.hasOutput('Total queries executed: 1,250')).toBe(true)
      expect(consoleCapture.hasOutput('Slow queries (>1000ms): 5')).toBe(true)
    })

    it('should show optimization status in report', async () => {
      await analyze({
        database: testContext.databasePath,
        report: true
      })

      expect(consoleCapture.hasOutput('Optimization Status:')).toBe(true)
      expect(consoleCapture.hasOutput('WAL mode: Enabled')).toBe(true)
      expect(consoleCapture.hasOutput('Foreign keys: Enabled')).toBe(true)
      expect(consoleCapture.hasOutput('Auto vacuum: INCREMENTAL')).toBe(true)
      expect(consoleCapture.hasOutput('Journal mode: WAL')).toBe(true)
      expect(consoleCapture.hasOutput('Synchronous: NORMAL')).toBe(true)
    })

    it('should calculate and display overall performance score', async () => {
      await analyze({
        database: testContext.databasePath,
        report: true
      })

      expect(consoleCapture.hasOutput('Overall Performance Score:')).toBe(true)
      expect(consoleCapture.hasOutput('/100')).toBe(true)
      expect(consoleCapture.hasOutput('Performance factors:')).toBe(true)
    })

    it('should show performance score with color coding', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockResolvedValue({
          cacheHitRate: 0.95,
          averageQueryTime: 50,
          walMode: true,
          foreignKeys: true
        }) as jest.MockedFunction<() => Promise<any>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        report: true
      })

      expect(consoleCapture.hasOutput('100/100')).toBe(true)
      expect(consoleCapture.hasOutput('Excellent')).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should handle query pattern analysis errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getQueryAnalyzer: jest.fn().mockReturnValue({
          getQueryPatterns: jest.fn().mockImplementation(() => {
            throw new Error('Query pattern analysis failed')
          })
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        patterns: true
      })

      expect(consoleCapture.hasOutput('Query pattern analysis failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle slow query analysis errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSlowQueries: jest.fn().mockRejectedValue(new Error('Slow query analysis failed')) as jest.MockedFunction<() => Promise<any[]>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        slowQueries: true
      })

      expect(consoleCapture.hasOutput('Slow query analysis failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle index recommendation errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockRejectedValue(new Error('Index recommendation failed')) as jest.MockedFunction<() => Promise<any>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('Index recommendation analysis failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle performance report errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockRejectedValue(new Error('Performance report failed')) as jest.MockedFunction<() => Promise<any>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        report: true
      })

      expect(consoleCapture.hasOutput('Performance report generation failed')).toBe(true)
      expect(consoleCapture.hasOutput('Failed')).toBe(true)
    })

    it('should handle database connection errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        initialize: jest.fn().mockRejectedValue(new Error('Database connection failed')) as jest.MockedFunction<() => Promise<void>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(analyze({
        database: testContext.databasePath
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Analysis failed')).toBe(true)
    })

    it('should handle missing query analyzer', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getQueryAnalyzer: jest.fn().mockReturnValue(null)
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(analyze({
        database: testContext.databasePath,
        patterns: true
      })).rejects.toThrow('Query analyzer not available')

      expect(consoleCapture.hasOutput('Query analyzer not available')).toBe(true)
    })
  })

  describe('Option combinations', () => {
    it('should run all analysis types when all options are enabled', async () => {
      await analyze({
        database: testContext.databasePath,
        patterns: true,
        slowQueries: true,
        indexes: true,
        report: true
      })

      expect(consoleCapture.hasOutput('Analyzing Query Patterns')).toBe(true)
      expect(consoleCapture.hasOutput('Analyzing Slow Queries')).toBe(true)
      expect(consoleCapture.hasOutput('Generating Index Recommendations')).toBe(true)
      expect(consoleCapture.hasOutput('Generating Detailed Performance Report')).toBe(true)
    })

    it('should run only specific analysis types when others are disabled', async () => {
      await analyze({
        database: testContext.databasePath,
        patterns: false,
        slowQueries: false,
        indexes: true,
        report: false
      })

      expect(consoleCapture.hasOutput('Analyzing Query Patterns')).toBe(false)
      expect(consoleCapture.hasOutput('Analyzing Slow Queries')).toBe(false)
      expect(consoleCapture.hasOutput('Generating Index Recommendations')).toBe(true)
      expect(consoleCapture.hasOutput('Generating Detailed Performance Report')).toBe(false)
    })
  })

  describe('Recommendations display', () => {
    it('should show recommendations for next steps', async () => {
      await analyze({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Recommendations:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme optimize')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme watch')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme status')).toBe(true)
      expect(consoleCapture.hasOutput('Consider adding indexes')).toBe(true)
    })
  })

  describe('Environment variable support', () => {
    it('should use DATABASE_PATH environment variable when database option is not provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      process.env.DATABASE_PATH = testContext.databasePath

      await analyze({})

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

      await analyze({})

      expect(consoleCapture.hasOutput('Database: ./database.sqlite')).toBe(true)

      // Restore original environment
      if (originalEnv) {
        process.env.DATABASE_PATH = originalEnv
      }
    })
  })

  describe('Query pattern analysis details', () => {
    it('should display query pattern statistics correctly', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getQueryAnalyzer: jest.fn().mockReturnValue({
          getQueryPatterns: jest.fn().mockReturnValue({
            totalQueries: 500,
            uniquePatterns: 45,
            averageExecutionTime: 67.8,
            frequentQueries: [
              { sql: 'SELECT * FROM users WHERE id = ?', count: 100, avgTime: 5.2 },
              { sql: 'SELECT * FROM posts WHERE user_id = ?', count: 80, avgTime: 8.1 }
            ],
            slowQueries: [
              { sql: 'SELECT * FROM users ORDER BY created_at DESC', maxTime: 2000, avgTime: 1200 }
            ],
            nPlusOneQueries: [
              { description: 'Multiple user queries', occurrences: 10 }
            ]
          })
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await analyze({
        database: testContext.databasePath,
        patterns: true
      })

      expect(consoleCapture.hasOutput('Total queries analyzed: 500')).toBe(true)
      expect(consoleCapture.hasOutput('Unique query patterns: 45')).toBe(true)
      expect(consoleCapture.hasOutput('Average execution time: 67.80ms')).toBe(true)
      expect(consoleCapture.hasOutput('SELECT * FROM users WHERE id = ?')).toBe(true)
      expect(consoleCapture.hasOutput('100 times')).toBe(true)
      expect(consoleCapture.hasOutput('SELECT * FROM posts WHERE user_id = ?')).toBe(true)
      expect(consoleCapture.hasOutput('80 times')).toBe(true)
      expect(consoleCapture.hasOutput('2000ms max')).toBe(true)
      expect(consoleCapture.hasOutput('Multiple user queries')).toBe(true)
      expect(consoleCapture.hasOutput('10 occurrences')).toBe(true)
    })
  })
})
