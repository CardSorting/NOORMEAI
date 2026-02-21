import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import { createMockNOORMMEWithBehavior, ConsoleCapture } from '../utils/test-helpers.ts'

describe('CLI Functionality Tests', () => {
  let consoleCapture: ConsoleCapture

  beforeEach(() => {
    consoleCapture = new ConsoleCapture()
    consoleCapture.start()
  })

  describe('NOORMME Mock System', () => {
    it('should create a working NOORMME mock', () => {
      const mockNOORMME = global.createMockNOORMME()
      
      expect(mockNOORMME).toBeDefined()
      expect(typeof mockNOORMME.initialize).toBe('function')
      expect(typeof mockNOORMME.close).toBe('function')
      expect(typeof mockNOORMME.getSchemaInfo).toBe('function')
      expect(typeof mockNOORMME.getSQLiteOptimizations).toBe('function')
    })

    it('should return mock schema information', async () => {
      const mockNOORMME = global.createMockNOORMME()
      const schemaInfo = await mockNOORMME.getSchemaInfo()
      
      expect(schemaInfo).toBeDefined()
      expect(schemaInfo.tables).toBeDefined()
      expect(Array.isArray(schemaInfo.tables)).toBe(true)
      expect(schemaInfo.tables.length).toBeGreaterThan(0)
      
      // Check first table structure
      const usersTable = schemaInfo.tables.find((table: any) => table.name === 'users')
      expect(usersTable).toBeDefined()
      expect(usersTable.columns).toBeDefined()
      expect(usersTable.columns.length).toBeGreaterThan(0)
    })

    it('should return mock SQLite optimizations', async () => {
      const mockNOORMME = global.createMockNOORMME()
      const optimizations = await mockNOORMME.getSQLiteOptimizations()
      
      expect(optimizations).toBeDefined()
      expect(optimizations.appliedOptimizations).toBeDefined()
      expect(Array.isArray(optimizations.appliedOptimizations)).toBe(true)
      expect(optimizations.warnings).toBeDefined()
      expect(Array.isArray(optimizations.warnings)).toBe(true)
    })

    it('should return mock performance metrics', async () => {
      const mockNOORMME = global.createMockNOORMME()
      const metrics = await mockNOORMME.getSQLitePerformanceMetrics()
      
      expect(metrics).toBeDefined()
      expect(typeof metrics.cacheHitRate).toBe('number')
      expect(typeof metrics.averageQueryTime).toBe('number')
      expect(typeof metrics.totalQueries).toBe('number')
      expect(metrics.cacheHitRate).toBeGreaterThan(0)
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1)
    })
  })

  describe('Custom Mock Behavior', () => {
    it('should allow custom mock behavior', async () => {
      const customMock = createMockNOORMMEWithBehavior({
        getSQLiteOptimizations: jest.fn().mockResolvedValue({
          appliedOptimizations: ['Custom optimization'],
          warnings: ['Custom warning']
        })
      })

      const optimizations = await customMock.getSQLiteOptimizations()
      expect(optimizations.appliedOptimizations).toContain('Custom optimization')
      expect(optimizations.warnings).toContain('Custom warning')
    })

    it('should handle error scenarios', async () => {
      const errorMock = createMockNOORMMEWithBehavior({
        initialize: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      })

      await expect(errorMock.initialize()).rejects.toThrow('Database connection failed')
    })

    it('should provide migration manager mock', async () => {
      const mockNOORMME = global.createMockNOORMME()
      const migrationManager = mockNOORMME.getMigrationManager()
      
      expect(migrationManager).toBeDefined()
      expect(typeof migrationManager.getMigrationStatus).toBe('function')
      
      const status = await migrationManager.getMigrationStatus()
      expect(status).toBeDefined()
      expect(status.currentVersion).toBeDefined()
      expect(status.appliedMigrations).toBeDefined()
      expect(status.pendingMigrations).toBeDefined()
      expect(status.availableMigrations).toBeDefined()
    })
  })

  describe('Console Output Capture', () => {
    it('should capture console output', () => {
      console.log('Test message 1')
      console.error('Error message')
      console.warn('Warning message')
      console.info('Info message')

      const logs = consoleCapture.getLogs()
      const errors = consoleCapture.getErrors()
      const warns = consoleCapture.getWarns()
      const infos = consoleCapture.getInfos()

      expect(logs).toContain('Test message 1')
      expect(errors).toContain('Error message')
      expect(warns).toContain('Warning message')
      expect(infos).toContain('Info message')
    })

    it('should check for output patterns', () => {
      console.log('Database initialized successfully')
      console.log('Optimizations applied: 3')

      expect(consoleCapture.hasOutput('Database initialized')).toBe(true)
      expect(consoleCapture.hasOutput('Optimizations applied')).toBe(true)
      expect(consoleCapture.hasOutput(/successfully/)).toBe(true)
    })
  })

  describe('Schema Information Structure', () => {
    it('should provide realistic schema data', () => {
      const schemaInfo = global.createMockSchemaInfo()
      
      // Check users table
      const usersTable = schemaInfo.tables.find((table: any) => table.name === 'users')
      expect(usersTable).toBeDefined()
      expect(usersTable.columns).toHaveLength(5)
      
      const idColumn = usersTable.columns.find((col: any) => col.name === 'id')
      expect(idColumn).toBeDefined()
      expect(idColumn.type).toBe('INTEGER')
      expect(idColumn.isPrimaryKey).toBe(true)
      expect(idColumn.isAutoIncrement).toBe(true)
      
      // Check posts table
      const postsTable = schemaInfo.tables.find((table: any) => table.name === 'posts')
      expect(postsTable).toBeDefined()
      expect(postsTable.foreignKeys).toHaveLength(1)
      
      const fk = postsTable.foreignKeys[0]
      expect(fk.column).toBe('user_id')
      expect(fk.referencedTable).toBe('users')
      expect(fk.referencedColumn).toBe('id')
      expect(fk.onDelete).toBe('CASCADE')
    })

    it('should provide relationship information', () => {
      const schemaInfo = global.createMockSchemaInfo()
      
      expect(schemaInfo.relationships).toBeDefined()
      expect(Array.isArray(schemaInfo.relationships)).toBe(true)
      expect(schemaInfo.relationships.length).toBeGreaterThan(0)
      
      const userPostsRel = schemaInfo.relationships.find((rel: any) => rel.name === 'user_posts')
      expect(userPostsRel).toBeDefined()
      expect(userPostsRel.fromTable).toBe('users')
      expect(userPostsRel.toTable).toBe('posts')
      expect(userPostsRel.type).toBe('one-to-many')
    })
  })
})
