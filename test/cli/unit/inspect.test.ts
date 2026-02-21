import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { inspect } from '../../../src/cli/commands/inspect.js'
import { createTestContext, cleanupTestContext, ConsoleCapture, createMockNOORMMEWithBehavior } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Inspect Command', () => {
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

  describe('Basic schema inspection', () => {
    it('should inspect all tables by default', async () => {
      await inspect(undefined, {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('NOORMME Schema Inspection')).toBe(true)
      expect(consoleCapture.hasOutput('Intelligent Database Discovery')).toBe(true)
      expect(consoleCapture.hasOutput('Discovered 2 tables')).toBe(true)
      expect(consoleCapture.hasOutput('users')).toBe(true)
      expect(consoleCapture.hasOutput('posts')).toBe(true)
    })

    it('should inspect specific table', async () => {
      await inspect('users', {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Table: users')).toBe(true)
      expect(consoleCapture.hasOutput('Columns:')).toBe(true)
      expect(consoleCapture.hasOutput('id')).toBe(true)
      expect(consoleCapture.hasOutput('name')).toBe(true)
      expect(consoleCapture.hasOutput('email')).toBe(true)
    })

    it('should handle non-existent table', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSchemaInfo: jest.fn().mockResolvedValue({
          tables: [{ name: 'users' }]
        }) as jest.MockedFunction<() => Promise<any>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(inspect('nonexistent', {
        database: testContext.databasePath
      })).rejects.toThrow('Table \'nonexistent\' not found')

      expect(consoleCapture.hasOutput('Table \'nonexistent\' not found')).toBe(true)
      expect(consoleCapture.hasOutput('Available tables:')).toBe(true)
    })
  })

  describe('Relationships display', () => {
    it('should show relationships when requested', async () => {
      await inspect(undefined, {
        database: testContext.databasePath,
        relationships: true
      })

      expect(consoleCapture.hasOutput('Relationships:')).toBe(true)
      expect(consoleCapture.hasOutput('user_posts')).toBe(true)
      expect(consoleCapture.hasOutput('ONE-TO-MANY')).toBe(true)
    })

    it('should show relationships for specific table', async () => {
      await inspect('users', {
        database: testContext.databasePath,
        relationships: true
      })

      expect(consoleCapture.hasOutput('Relationships:')).toBe(true)
      expect(consoleCapture.hasOutput('user_posts')).toBe(true)
    })
  })

  describe('Optimization insights', () => {
    it('should show optimization recommendations when requested', async () => {
      await inspect(undefined, {
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('Optimization Overview:')).toBe(true)
      expect(consoleCapture.hasOutput('Applied optimizations: 3')).toBe(true)
      expect(consoleCapture.hasOutput('Enabled WAL mode')).toBe(true)
    })

    it('should show table-specific optimization analysis', async () => {
      await inspect('users', {
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('Optimization Analysis for users:')).toBe(true)
      expect(consoleCapture.hasOutput('optimization recommendations')).toBe(true)
    })

    it('should handle tables without optimization recommendations', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
          recommendations: []
        }) as jest.MockedFunction<() => Promise<any>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await inspect('users', {
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('No optimization recommendations for this table')).toBe(true)
    })
  })

  describe('Index analysis', () => {
    it('should show index analysis when requested', async () => {
      await inspect(undefined, {
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('Index Analysis:')).toBe(true)
      expect(consoleCapture.hasOutput('index recommendations available')).toBe(true)
    })

    it('should show table-specific index analysis', async () => {
      await inspect('users', {
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('Index Analysis for users:')).toBe(true)
      expect(consoleCapture.hasOutput('2 indexes found')).toBe(true)
      expect(consoleCapture.hasOutput('idx_users_email')).toBe(true)
      expect(consoleCapture.hasOutput('idx_users_status')).toBe(true)
    })

    it('should handle tables without indexes', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSchemaInfo: jest.fn().mockResolvedValue({
          tables: [{
            name: 'test_table',
            indexes: [],
            columns: [{ name: 'id' }]
          }],
          relationships: []
        }) as jest.MockedFunction<() => Promise<any>>
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await inspect('test_table', {
        database: testContext.databasePath,
        indexes: true
      })

      expect(consoleCapture.hasOutput('No indexes found')).toBe(true)
      expect(consoleCapture.hasOutput('consider adding indexes')).toBe(true)
    })
  })

  describe('Performance metrics', () => {
    it('should show performance metrics when requested', async () => {
      await inspect(undefined, {
        database: testContext.databasePath,
        performance: true
      })

      expect(consoleCapture.hasOutput('Performance Metrics:')).toBe(true)
      expect(consoleCapture.hasOutput('Cache hit rate: 85.0%')).toBe(true)
      expect(consoleCapture.hasOutput('Average query time: 45.20ms')).toBe(true)
      expect(consoleCapture.hasOutput('Database size: 2.00MB')).toBe(true)
    })

    it('should show table-specific performance metrics', async () => {
      await inspect('users', {
        database: testContext.databasePath,
        performance: true
      })

      expect(consoleCapture.hasOutput('Performance Metrics for users:')).toBe(true)
      expect(consoleCapture.hasOutput('Table size: 5 columns')).toBe(true)
      expect(consoleCapture.hasOutput('Indexes: 2')).toBe(true)
      expect(consoleCapture.hasOutput('Performance score')).toBe(true)
    })

    it('should calculate performance score correctly', async () => {
      await inspect('users', {
        database: testContext.databasePath,
        performance: true
      })

      // Users table has: 2 indexes, 0 foreign keys, 1 primary key, 5 columns (≤20)
      // Score should be: 25 (indexes) + 0 (foreign keys) + 25 (primary key) + 25 (reasonable column count) = 75
      expect(consoleCapture.hasOutput('Performance score: 75/100')).toBe(true)
    })
  })

  describe('Automation recommendations', () => {
    it('should show automation recommendations', async () => {
      await inspect(undefined, {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Automation Recommendations:')).toBe(true)
      expect(consoleCapture.hasOutput('To apply recommendations:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme optimize')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme analyze --report')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme watch --auto-optimize')).toBe(true)
    })

    it('should show specific recommendations based on schema analysis', async () => {
      await inspect(undefined, {
        database: testContext.databasePath
      })

      // Should recommend applying index recommendations
      expect(consoleCapture.hasOutput('Apply 2 index recommendations')).toBe(true)
    })

    it('should show well-optimized message when no recommendations', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
          recommendations: []
        }),
        getSQLitePerformanceMetrics: jest.fn().mockResolvedValue({
          cacheHitRate: 0.9,
          averageQueryTime: 20,
          walMode: true,
          foreignKeys: true
        }),
        getSchemaInfo: jest.fn().mockResolvedValue({
          tables: [{
            name: 'optimized_table',
            indexes: [{ name: 'idx_optimized', columns: ['id'] }],
            foreignKeys: [{ column: 'user_id', referencedTable: 'users' }],
            columns: [{ name: 'id' }, { name: 'user_id' }]
          }],
          relationships: []
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await inspect(undefined, {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Your database is well-optimized')).toBe(true)
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

      await expect(inspect(undefined, {
        database: testContext.databasePath
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Inspection failed')).toBe(true)
    })

    it('should handle schema info errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSchemaInfo: jest.fn().mockRejectedValue(new Error('Schema discovery failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(inspect(undefined, {
        database: testContext.databasePath
      })).rejects.toThrow('Schema discovery failed')
    })

    it('should handle optimization analysis errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLiteIndexRecommendations: jest.fn().mockRejectedValue(new Error('Index analysis failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await inspect('users', {
        database: testContext.databasePath,
        optimizations: true
      })

      expect(consoleCapture.hasOutput('Failed to get optimization analysis')).toBe(true)
    })

    it('should handle performance metrics errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getSQLitePerformanceMetrics: jest.fn().mockRejectedValue(new Error('Performance metrics failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await inspect('users', {
        database: testContext.databasePath,
        performance: true
      })

      expect(consoleCapture.hasOutput('Failed to get performance metrics')).toBe(true)
    })
  })

  describe('Table details display', () => {
    it('should show detailed table information', async () => {
      await inspect('users', {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Table: users')).toBe(true)
      expect(consoleCapture.hasOutput('Columns:')).toBe(true)
      expect(consoleCapture.hasOutput('id')).toBe(true)
      expect(consoleCapture.hasOutput('name')).toBe(true)
      expect(consoleCapture.hasOutput('email')).toBe(true)
      expect(consoleCapture.hasOutput('status')).toBe(true)
      expect(consoleCapture.hasOutput('created_at')).toBe(true)
    })

    it('should show primary key information', async () => {
      await inspect('users', {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Primary Key:')).toBe(true)
      expect(consoleCapture.hasOutput('id')).toBe(true)
    })

    it('should show foreign key information', async () => {
      await inspect('posts', {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Foreign Keys:')).toBe(true)
      expect(consoleCapture.hasOutput('user_id → users.id')).toBe(true)
      expect(consoleCapture.hasOutput('ON DELETE CASCADE')).toBe(true)
    })

    it('should show index information', async () => {
      await inspect('users', {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Indexes:')).toBe(true)
      expect(consoleCapture.hasOutput('idx_users_email')).toBe(true)
      expect(consoleCapture.hasOutput('UNIQUE')).toBe(true)
      expect(consoleCapture.hasOutput('idx_users_status')).toBe(true)
      expect(consoleCapture.hasOutput('INDEX')).toBe(true)
    })

    it('should show usage examples', async () => {
      await inspect('users', {
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Usage Example:')).toBe(true)
      expect(consoleCapture.hasOutput('const usersRepo = db.getRepository(\'users\')')).toBe(true)
      expect(consoleCapture.hasOutput('const records = await usersRepo.findAll()')).toBe(true)
      expect(consoleCapture.hasOutput('const record = await usersRepo.findById(1)')).toBe(true)
    })
  })

  describe('All options combined', () => {
    it('should handle all inspection options together', async () => {
      await inspect('users', {
        database: testContext.databasePath,
        relationships: true,
        optimizations: true,
        indexes: true,
        performance: true
      })

      expect(consoleCapture.hasOutput('Table: users')).toBe(true)
      expect(consoleCapture.hasOutput('Optimization Analysis for users:')).toBe(true)
      expect(consoleCapture.hasOutput('Index Analysis for users:')).toBe(true)
      expect(consoleCapture.hasOutput('Performance Metrics for users:')).toBe(true)
    })

    it('should handle all options for overview inspection', async () => {
      await inspect(undefined, {
        database: testContext.databasePath,
        relationships: true,
        optimizations: true,
        indexes: true,
        performance: true
      })

      expect(consoleCapture.hasOutput('Discovered 2 tables')).toBe(true)
      expect(consoleCapture.hasOutput('Relationships:')).toBe(true)
      expect(consoleCapture.hasOutput('Optimization Overview:')).toBe(true)
      expect(consoleCapture.hasOutput('Index Analysis:')).toBe(true)
      expect(consoleCapture.hasOutput('Performance Metrics:')).toBe(true)
      expect(consoleCapture.hasOutput('Automation Recommendations:')).toBe(true)
    })
  })
})
