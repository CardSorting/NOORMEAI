import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { watch } from '../../../src/cli/commands/watch.js'
import { createTestContext, cleanupTestContext, ConsoleCapture, createMockNOORMMEWithBehavior } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Watch Command', () => {
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

  describe('Basic watch functionality', () => {
    it('should start schema watcher with default settings', async () => {
      // Mock process.exit to prevent actual exit
      const originalExit = process.exit
      process.exit = jest.fn() as any

      // Mock setTimeout to control timing
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation((callback) => {
        // Don't actually call the callback to avoid infinite loops in tests
        return 123
      }) as any

      try {
        await watch({
          database: testContext.databasePath
        })

        expect(consoleCapture.hasOutput('NOORMME Schema Watcher')).toBe(true)
        expect(consoleCapture.hasOutput('Continuous Database Monitoring')).toBe(true)
        expect(consoleCapture.hasOutput('Database:')).toBe(true)
        expect(consoleCapture.hasOutput('Watching for schema changes')).toBe(true)
        expect(consoleCapture.hasOutput('Press Ctrl+C to stop')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should show watcher configuration', async () => {
      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          interval: 5000
        })

        expect(consoleCapture.hasOutput('Watch interval: 5000ms')).toBe(true)
        expect(consoleCapture.hasOutput('Auto-optimization: disabled')).toBe(true)
        expect(consoleCapture.hasOutput('Auto-indexing: disabled')).toBe(true)
        expect(consoleCapture.hasOutput('Notifications: disabled')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })
  })

  describe('Auto-optimization', () => {
    it('should enable auto-optimization when requested', async () => {
      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          autoOptimize: true
        })

        expect(consoleCapture.hasOutput('Auto-optimization: enabled')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should apply optimizations when schema changes are detected', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          // Simulate schema change detection
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_added',
              table: 'new_table',
              details: 'Table new_table was added'
            })
          }
          return Promise.resolve()
        }),
        applySQLiteOptimizations: jest.fn().mockResolvedValue({
          appliedOptimizations: ['Enabled WAL mode'],
          warnings: []
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          autoOptimize: true
        })

        expect(consoleCapture.hasOutput('Schema change detected: table_added')).toBe(true)
        expect(consoleCapture.hasOutput('Table: new_table')).toBe(true)
        expect(consoleCapture.hasOutput('Applying automatic optimizations')).toBe(true)
        expect(consoleCapture.hasOutput('Applied 1 optimizations')).toBe(true)
        expect(consoleCapture.hasOutput('Enabled WAL mode')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should handle optimization errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_added',
              table: 'new_table',
              details: 'Table new_table was added'
            })
          }
          return Promise.resolve()
        }),
        applySQLiteOptimizations: jest.fn().mockRejectedValue(new Error('Optimization failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          autoOptimize: true
        })

        expect(consoleCapture.hasOutput('Schema change detected: table_added')).toBe(true)
        expect(consoleCapture.hasOutput('Failed to apply optimizations: Optimization failed')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })
  })

  describe('Auto-indexing', () => {
    it('should enable auto-indexing when requested', async () => {
      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          autoIndex: true
        })

        expect(consoleCapture.hasOutput('Auto-indexing: enabled')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should apply index recommendations when schema changes are detected', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_added',
              table: 'new_table',
              details: 'Table new_table was added'
            })
          }
          return Promise.resolve()
        }),
        applySQLiteIndexRecommendations: jest.fn().mockResolvedValue([
          { table: 'new_table', column: 'created_at' },
          { table: 'new_table', column: 'status' }
        ])
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          autoIndex: true
        })

        expect(consoleCapture.hasOutput('Schema change detected: table_added')).toBe(true)
        expect(consoleCapture.hasOutput('Applying automatic index recommendations')).toBe(true)
        expect(consoleCapture.hasOutput('Applied 2 index recommendations')).toBe(true)
        expect(consoleCapture.hasOutput('new_table.created_at')).toBe(true)
        expect(consoleCapture.hasOutput('new_table.status')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should handle indexing errors gracefully', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_added',
              table: 'new_table',
              details: 'Table new_table was added'
            })
          }
          return Promise.resolve()
        }),
        applySQLiteIndexRecommendations: jest.fn().mockRejectedValue(new Error('Indexing failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          autoIndex: true
        })

        expect(consoleCapture.hasOutput('Schema change detected: table_added')).toBe(true)
        expect(consoleCapture.hasOutput('Failed to apply index recommendations: Indexing failed')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })
  })

  describe('Notifications', () => {
    it('should enable notifications when requested', async () => {
      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          notify: true
        })

        expect(consoleCapture.hasOutput('Notifications: enabled')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should show notification when schema changes are detected', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_added',
              table: 'new_table',
              details: 'Table new_table was added'
            })
          }
          return Promise.resolve()
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          notify: true
        })

        expect(consoleCapture.hasOutput('🔔 Schema Change Notification')).toBe(true)
        expect(consoleCapture.hasOutput('Table new_table was added')).toBe(true)
        expect(consoleCapture.hasOutput('Time:')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })
  })

  describe('Different schema change types', () => {
    it('should handle table added changes', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_added',
              table: 'new_table',
              details: 'Table new_table was added'
            })
          }
          return Promise.resolve()
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath
        })

        expect(consoleCapture.hasOutput('Schema change detected: table_added')).toBe(true)
        expect(consoleCapture.hasOutput('Table: new_table')).toBe(true)
        expect(consoleCapture.hasOutput('Details: Table new_table was added')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should handle table modified changes', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_modified',
              table: 'users',
              details: 'Column email was modified'
            })
          }
          return Promise.resolve()
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath
        })

        expect(consoleCapture.hasOutput('Schema change detected: table_modified')).toBe(true)
        expect(consoleCapture.hasOutput('Table: users')).toBe(true)
        expect(consoleCapture.hasOutput('Details: Column email was modified')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should handle table dropped changes', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'table_dropped',
              table: 'old_table',
              details: 'Table old_table was dropped'
            })
          }
          return Promise.resolve()
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath
        })

        expect(consoleCapture.hasOutput('Schema change detected: table_dropped')).toBe(true)
        expect(consoleCapture.hasOutput('Table: old_table')).toBe(true)
        expect(consoleCapture.hasOutput('Details: Table old_table was dropped')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })

    it('should handle index changes', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockImplementation((config) => {
          if (config.onSchemaChange) {
            config.onSchemaChange({
              type: 'index_added',
              table: 'users',
              index: 'idx_users_email',
              details: 'Index idx_users_email was added'
            })
          }
          return Promise.resolve()
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath
        })

        expect(consoleCapture.hasOutput('Schema change detected: index_added')).toBe(true)
        expect(consoleCapture.hasOutput('Table: users')).toBe(true)
        expect(consoleCapture.hasOutput('Index: idx_users_email')).toBe(true)
        expect(consoleCapture.hasOutput('Details: Index idx_users_email was added')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
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

      await expect(watch({
        database: testContext.databasePath
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Failed to start schema watcher')).toBe(true)
    })

    it('should handle watcher startup errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        startSchemaWatcher: jest.fn().mockRejectedValue(new Error('Watcher startup failed'))
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(watch({
        database: testContext.databasePath
      })).rejects.toThrow('Watcher startup failed')

      expect(consoleCapture.hasOutput('Failed to start schema watcher')).toBe(true)
    })

    it('should handle graceful shutdown', async () => {
      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      // Mock process signals
      const originalProcessOn = process.on
      process.on = jest.fn().mockImplementation((event, handler) => {
        if (event === 'SIGINT') {
          // Simulate Ctrl+C
          setTimeout(() => (handler as any)(), 10)
        }
        return process
      }) as any

      try {
        await watch({
          database: testContext.databasePath
        })

        expect(consoleCapture.hasOutput('Shutting down gracefully')).toBe(true)
        expect(consoleCapture.hasOutput('Schema watcher stopped')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
        process.on = originalProcessOn
      }
    })
  })

  describe('Environment variable support', () => {
    it('should use DATABASE_PATH environment variable when database option is not provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      process.env.DATABASE_PATH = testContext.databasePath

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({})

        expect(consoleCapture.hasOutput('Database:')).toBe(true)
        expect(consoleCapture.hasOutput(testContext.databasePath)).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout

        // Restore original environment
        if (originalEnv) {
          process.env.DATABASE_PATH = originalEnv
        } else {
          delete process.env.DATABASE_PATH
        }
      }
    })

    it('should use default database path when no option or environment variable is provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      delete process.env.DATABASE_PATH

      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({})

        expect(consoleCapture.hasOutput('Database: ./database.sqlite')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout

        // Restore original environment
        if (originalEnv) {
          process.env.DATABASE_PATH = originalEnv
        }
      }
    })
  })

  describe('Option combinations', () => {
    it('should handle all options enabled', async () => {
      const originalExit = process.exit
      process.exit = jest.fn() as any
      const originalSetTimeout = global.setTimeout
      global.setTimeout = jest.fn().mockImplementation(() => 123) as any as any

      try {
        await watch({
          database: testContext.databasePath,
          interval: 3000,
          autoOptimize: true,
          autoIndex: true,
          notify: true
        })

        expect(consoleCapture.hasOutput('Watch interval: 3000ms')).toBe(true)
        expect(consoleCapture.hasOutput('Auto-optimization: enabled')).toBe(true)
        expect(consoleCapture.hasOutput('Auto-indexing: enabled')).toBe(true)
        expect(consoleCapture.hasOutput('Notifications: enabled')).toBe(true)
      } finally {
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
      }
    })
  })
})
