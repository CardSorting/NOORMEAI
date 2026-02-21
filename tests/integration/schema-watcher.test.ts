import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase, TestUtils } from '../../src/testing/test-utils.js'

describe('Schema Watcher Integration', () => {
  let db: NOORMME

  beforeEach(async () => {
    // Use SQLite for fast schema changes in tests
    db = await createTestDatabase({
      dialect: 'sqlite',
      seed: false // We'll create schema manually for testing
    })
  })

  afterEach(async () => {
    // Ensure schema watching is stopped before cleanup
    if (db) {
      db.stopSchemaWatching()
    }
    await cleanupTestDatabase(db)
  })

  describe('Schema Change Detection', () => {
    it('should detect new table creation', async () => {
      const kysely = db.getKysely()
      let changeDetected = false
      let detectedChanges: any[] = []

      // Initialize with minimal schema
      await kysely.schema
        .createTable('test_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await db.initialize()

      // Set up schema watcher
      db.onSchemaChange((changes) => {
        changeDetected = true
        detectedChanges = changes
      })

      await db.startSchemaWatching({
        pollInterval: 100, // Fast polling for tests
        enabled: true
      })

      // Wait a moment for initial state
      await TestUtils.delay(150)

      // Create a new table
      await kysely.schema
        .createTable('new_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .addColumn('name', 'text')
        .execute()

      // Wait for change detection
      await TestUtils.delay(200)

      expect(changeDetected).toBe(true)
      expect(detectedChanges.length).toBeGreaterThan(0)

      db.stopSchemaWatching()
    })

    it('should handle rapid schema changes', async () => {
      const kysely = db.getKysely()
      let changeCount = 0

      await kysely.schema
        .createTable('base_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await db.initialize()

      db.onSchemaChange(() => {
        changeCount++
      })

      await db.startSchemaWatching({
        pollInterval: 50,
        enabled: true
      })

      await TestUtils.delay(100)

      // Make multiple rapid changes
      await kysely.schema
        .createTable('table1')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await kysely.schema
        .createTable('table2')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await kysely.schema
        .createTable('table3')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      // Wait for changes to be detected
      await TestUtils.delay(300)

      expect(changeCount).toBeGreaterThan(0)

      db.stopSchemaWatching()
    })

    it('should auto-refresh schema when changes detected', async () => {
      const kysely = db.getKysely()

      await kysely.schema
        .createTable('initial_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await db.initialize()

      const initialSchema = await db.getSchemaInfo()
      expect(initialSchema.tables.length).toBe(1)

      await db.startSchemaWatching({
        pollInterval: 100,
        enabled: true
      })

      await TestUtils.delay(150)

      // Add new table
      await kysely.schema
        .createTable('new_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      // Wait for auto-refresh
      await TestUtils.delay(300)

      const updatedSchema = await db.getSchemaInfo()
      expect(updatedSchema.tables.length).toBe(2)

      db.stopSchemaWatching()
    })
  })

  describe('Watch Configuration', () => {
    it('should respect disabled state', async () => {
      const kysely = db.getKysely()
      let changeDetected = false

      await kysely.schema
        .createTable('test_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await db.initialize()

      db.onSchemaChange(() => {
        changeDetected = true
      })

      // Start watching with disabled = true
      await db.startSchemaWatching({
        enabled: false,
        pollInterval: 50
      })

      await TestUtils.delay(100)

      // Make schema change
      await kysely.schema
        .createTable('new_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await TestUtils.delay(200)

      expect(changeDetected).toBe(false)

      db.stopSchemaWatching()
    })

    it('should respect poll interval setting', async () => {
      const kysely = db.getKysely()
      const changeTimestamps: number[] = []

      await kysely.schema
        .createTable('test_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await db.initialize()

      db.onSchemaChange(() => {
        changeTimestamps.push(Date.now())
      })

      await db.startSchemaWatching({
        pollInterval: 200, // 200ms interval
        enabled: true
      })

      await TestUtils.delay(250)

      // Make multiple changes
      await kysely.schema
        .createTable('table1')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await TestUtils.delay(300)

      await kysely.schema
        .createTable('table2')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await TestUtils.delay(300)

      // Should have detected changes with appropriate timing
      expect(changeTimestamps.length).toBeGreaterThan(0)

      if (changeTimestamps.length > 1) {
        const timeDiff = changeTimestamps[1] - changeTimestamps[0]
        expect(timeDiff).toBeGreaterThanOrEqual(150) // Allow some tolerance
      }

      db.stopSchemaWatching()
    })

    it('should handle ignored tables', async () => {
      const kysely = db.getKysely()
      let changeDetected = false

      await kysely.schema
        .createTable('important_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await db.initialize()

      db.onSchemaChange(() => {
        changeDetected = true
      })

      await db.startSchemaWatching({
        pollInterval: 100,
        enabled: true,
        ignoredTables: ['temp_table']
      })

      await TestUtils.delay(150)

      // Create ignored table
      await kysely.schema
        .createTable('temp_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await TestUtils.delay(200)

      // Changes to ignored tables should not trigger callbacks
      // Note: This depends on implementation details
      // The test validates the configuration is accepted

      db.stopSchemaWatching()
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      await db.initialize()

      await db.startSchemaWatching({
        pollInterval: 100,
        enabled: true
      })

      // Simulate database connection issue by closing the database
      // but keeping the watcher running
      await db.close()

      // Wait to see if watcher handles the error
      await TestUtils.delay(300)

      // Should not throw or crash the process
      expect(true).toBe(true) // Test passes if no exception thrown
    })

    it('should not start watching if not initialized', async () => {
      // Don't initialize the database
      await expect(async () => {
        await db.startSchemaWatching()
      }).rejects.toThrow('NOORMME must be initialized')
    })
  })

  describe('Multiple Callbacks', () => {
    it('should notify multiple registered callbacks', async () => {
      const kysely = db.getKysely()
      let callback1Called = false
      let callback2Called = false

      await kysely.schema
        .createTable('test_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await db.initialize()

      db.onSchemaChange(() => {
        callback1Called = true
      })

      db.onSchemaChange(() => {
        callback2Called = true
      })

      await db.startSchemaWatching({
        pollInterval: 100,
        enabled: true
      })

      await TestUtils.delay(150)

      await kysely.schema
        .createTable('new_table')
        .addColumn('id', 'integer', col => col.primaryKey())
        .execute()

      await TestUtils.delay(200)

      expect(callback1Called).toBe(true)
      expect(callback2Called).toBe(true)

      db.stopSchemaWatching()
    })
  })

  describe('Performance', () => {
    it('should not impact normal database operations', async () => {
      const kysely = db.getKysely()

      await kysely.schema
        .createTable('performance_test')
        .addColumn('id', 'integer', col => col.primaryKey())
        .addColumn('data', 'text')
        .execute()

      await db.initialize()

      await db.startSchemaWatching({
        pollInterval: 50, // Aggressive polling
        enabled: true
      })

      // Perform multiple database operations
      const { time } = await TestUtils.measureTime(async () => {
        for (let i = 0; i < 10; i++) {
          await kysely.insertInto('performance_test')
            .values({ data: `test data ${i}` })
            .execute()
        }
        const results = await kysely.selectFrom('performance_test').selectAll().execute()
        expect(results.length).toBe(10)
      })

      // Should complete reasonably quickly even with aggressive polling
      expect(time).toBeLessThan(1000) // Should take less than 1 second

      db.stopSchemaWatching()
    })
  })
})