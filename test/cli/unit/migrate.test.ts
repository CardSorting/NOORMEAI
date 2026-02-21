import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { migrate } from '../../../src/cli/commands/migrate.js'
import { createTestContext, cleanupTestContext, ConsoleCapture, createMockNOORMMEWithBehavior } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Migrate Command', () => {
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

  describe('Migration status', () => {
    it('should show migration status by default', async () => {
      await migrate({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('NOORMME Migration Management')).toBe(true)
      expect(consoleCapture.hasOutput('Automated Schema Evolution')).toBe(true)
      expect(consoleCapture.hasOutput('Migration Status:')).toBe(true)
      expect(consoleCapture.hasOutput('Current version: 001')).toBe(true)
      expect(consoleCapture.hasOutput('Applied migrations: 1')).toBe(true)
      expect(consoleCapture.hasOutput('Pending migrations: 0')).toBe(true)
    })

    it('should show applied migrations', async () => {
      await migrate({
        database: testContext.databasePath,
        status: true
      })

      expect(consoleCapture.hasOutput('Applied Migrations:')).toBe(true)
      expect(consoleCapture.hasOutput('001 - initial_schema')).toBe(true)
      expect(consoleCapture.hasOutput('Applied: 2024-01-01 00:00:00')).toBe(true)
    })

    it('should show pending migrations', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          getMigrationStatus: jest.fn().mockResolvedValue({
            currentVersion: '001',
            appliedMigrations: [
              { version: '001', name: 'initial_schema', appliedAt: '2024-01-01T00:00:00Z' }
            ],
            pendingMigrations: [
              { version: '002', name: 'add_user_roles' },
              { version: '003', name: 'add_post_categories' }
            ],
            availableMigrations: [
              { version: '001', name: 'initial_schema' },
              { version: '002', name: 'add_user_roles' },
              { version: '003', name: 'add_post_categories' }
            ]
          })
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await migrate({
        database: testContext.databasePath,
        status: true
      })

      expect(consoleCapture.hasOutput('Pending Migrations:')).toBe(true)
      expect(consoleCapture.hasOutput('002 - add_user_roles')).toBe(true)
      expect(consoleCapture.hasOutput('003 - add_post_categories')).toBe(true)
    })

    it('should handle no pending migrations', async () => {
      await migrate({
        database: testContext.databasePath,
        status: true
      })

      expect(consoleCapture.hasOutput('No pending migrations')).toBe(true)
    })
  })

  describe('Migration generation', () => {
    it('should generate a new migration', async () => {
      await migrate({
        database: testContext.databasePath,
        generate: 'add_user_profile'
      })

      expect(consoleCapture.hasOutput('Generating Migration: add_user_profile')).toBe(true)
      expect(consoleCapture.hasOutput('Migration generated successfully')).toBe(true)
      expect(consoleCapture.hasOutput('File: 001_initial_schema.ts')).toBe(true)
      expect(consoleCapture.hasOutput('Path: /tmp/migrations/001_initial_schema.ts')).toBe(true)
      expect(consoleCapture.hasOutput('Description: Initial database schema')).toBe(true)
      expect(consoleCapture.hasOutput('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);')).toBe(true)
    })

    it('should handle migration generation errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          generateMigration: jest.fn().mockRejectedValue(new Error('Migration generation failed'))
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(migrate({
        database: testContext.databasePath,
        generate: 'add_user_profile'
      })).rejects.toThrow('Migration generation failed')

      expect(consoleCapture.hasOutput('Migration generation failed')).toBe(true)
    })
  })

  describe('Migration to latest', () => {
    it('should migrate to latest version', async () => {
      await migrate({
        database: testContext.databasePath,
        latest: true
      })

      expect(consoleCapture.hasOutput('Migrating to Latest Version')).toBe(true)
      expect(consoleCapture.hasOutput('Migration completed successfully')).toBe(true)
      expect(consoleCapture.hasOutput('Current version: 001')).toBe(true)
    })

    it('should handle no migrations to apply', async () => {
      await migrate({
        database: testContext.databasePath,
        latest: true
      })

      expect(consoleCapture.hasOutput('No new migrations to apply')).toBe(true)
    })

    it('should show applied migrations when migrating to latest', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          getMigrationStatus: jest.fn().mockResolvedValue({
            currentVersion: '001',
            appliedMigrations: [],
            pendingMigrations: [],
            availableMigrations: [
              { version: '001', name: 'initial_schema' },
              { version: '002', name: 'add_user_roles' }
            ]
          }),
          migrateToLatest: jest.fn().mockResolvedValue({
            migrationsApplied: [
              { version: '001', name: 'initial_schema' },
              { version: '002', name: 'add_user_roles' }
            ],
            migrationsRolledBack: [],
            currentVersion: '002'
          })
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await migrate({
        database: testContext.databasePath,
        latest: true
      })

      expect(consoleCapture.hasOutput('Applied migrations:')).toBe(true)
      expect(consoleCapture.hasOutput('001 - initial_schema')).toBe(true)
      expect(consoleCapture.hasOutput('002 - add_user_roles')).toBe(true)
      expect(consoleCapture.hasOutput('Current version: 002')).toBe(true)
    })

    it('should handle migration errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          migrateToLatest: jest.fn().mockRejectedValue(new Error('Migration failed'))
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(migrate({
        database: testContext.databasePath,
        latest: true
      })).rejects.toThrow('Migration failed')

      expect(consoleCapture.hasOutput('Migration failed')).toBe(true)
    })
  })

  describe('Migration to specific version', () => {
    it('should migrate to specific version', async () => {
      await migrate({
        database: testContext.databasePath,
        to: '002'
      })

      expect(consoleCapture.hasOutput('Migrating to Version: 002')).toBe(true)
      expect(consoleCapture.hasOutput('Migration completed successfully')).toBe(true)
      expect(consoleCapture.hasOutput('Current version: 001')).toBe(true)
    })

    it('should handle migration to current version', async () => {
      await migrate({
        database: testContext.databasePath,
        to: '001'
      })

      expect(consoleCapture.hasOutput('Already at version 001')).toBe(true)
    })

    it('should handle migration to invalid version', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          getMigrationStatus: jest.fn().mockResolvedValue({
            currentVersion: '001',
            appliedMigrations: [],
            pendingMigrations: [],
            availableMigrations: [
              { version: '001', name: 'initial_schema' },
              { version: '002', name: 'add_user_roles' }
            ]
          }),
          migrateToVersion: jest.fn().mockRejectedValue(new Error('Version 999 not found'))
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(migrate({
        database: testContext.databasePath,
        to: '999'
      })).rejects.toThrow('Version 999 not found')

      expect(consoleCapture.hasOutput('Migration failed')).toBe(true)
    })

    it('should show applied and rolled back migrations', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          getMigrationStatus: jest.fn().mockResolvedValue({
            currentVersion: '003',
            appliedMigrations: [],
            pendingMigrations: [],
            availableMigrations: [
              { version: '001', name: 'initial_schema' },
              { version: '002', name: 'add_user_roles' },
              { version: '003', name: 'add_post_categories' }
            ]
          }),
          migrateToVersion: jest.fn().mockResolvedValue({
            migrationsApplied: [
              { version: '001', name: 'initial_schema' }
            ],
            migrationsRolledBack: [
              { version: '003', name: 'add_post_categories' },
              { version: '002', name: 'add_user_roles' }
            ],
            currentVersion: '001'
          })
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await migrate({
        database: testContext.databasePath,
        to: '001'
      })

      expect(consoleCapture.hasOutput('Applied migrations:')).toBe(true)
      expect(consoleCapture.hasOutput('001 - initial_schema')).toBe(true)
      expect(consoleCapture.hasOutput('Rolled back migrations:')).toBe(true)
      expect(consoleCapture.hasOutput('003 - add_post_categories')).toBe(true)
      expect(consoleCapture.hasOutput('002 - add_user_roles')).toBe(true)
      expect(consoleCapture.hasOutput('Current version: 001')).toBe(true)
    })
  })

  describe('Rollback operations', () => {
    it('should rollback last migration', async () => {
      await migrate({
        database: testContext.databasePath,
        rollback: true
      })

      expect(consoleCapture.hasOutput('Rolling Back Last Migration')).toBe(true)
      expect(consoleCapture.hasOutput('No migrations to rollback')).toBe(true)
    })

    it('should show successful rollback', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          getMigrationStatus: jest.fn().mockResolvedValue({
            currentVersion: '002',
            appliedMigrations: [
              { version: '001', name: 'initial_schema', appliedAt: '2024-01-01T00:00:00Z' },
              { version: '002', name: 'add_user_roles', appliedAt: '2024-01-02T00:00:00Z' }
            ],
            pendingMigrations: [],
            availableMigrations: [
              { version: '001', name: 'initial_schema' },
              { version: '002', name: 'add_user_roles' }
            ]
          }),
          rollbackLastMigration: jest.fn().mockResolvedValue({
            success: true,
            migration: { version: '002', name: 'add_user_roles' },
            currentVersion: '001'
          })
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await migrate({
        database: testContext.databasePath,
        rollback: true
      })

      expect(consoleCapture.hasOutput('Rolled back migration: 002 - add_user_roles')).toBe(true)
      expect(consoleCapture.hasOutput('Current version: 001')).toBe(true)
    })

    it('should handle rollback errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          rollbackLastMigration: jest.fn().mockRejectedValue(new Error('Rollback failed'))
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(migrate({
        database: testContext.databasePath,
        rollback: true
      })).rejects.toThrow('Rollback failed')

      expect(consoleCapture.hasOutput('Rollback failed')).toBe(true)
    })

    it('should handle no migrations to rollback', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          getMigrationStatus: jest.fn().mockResolvedValue({
            currentVersion: null,
            appliedMigrations: [],
            pendingMigrations: [],
            availableMigrations: []
          }),
          rollbackLastMigration: jest.fn().mockResolvedValue({
            success: false,
            migration: null,
            currentVersion: null
          })
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await migrate({
        database: testContext.databasePath,
        rollback: true
      })

      expect(consoleCapture.hasOutput('No migrations to rollback')).toBe(true)
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

      await expect(migrate({
        database: testContext.databasePath
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Migration failed')).toBe(true)
    })

    it('should handle migration manager errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue(null)
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(migrate({
        database: testContext.databasePath
      })).rejects.toThrow('Migration manager not available')

      expect(consoleCapture.hasOutput('Migration manager not available')).toBe(true)
    })

    it('should handle migration status errors', async () => {
      const mockNOORMME = createMockNOORMMEWithBehavior({
        getMigrationManager: jest.fn().mockReturnValue({
          getMigrationStatus: jest.fn().mockRejectedValue(new Error('Migration status failed'))
        })
      })

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: jest.fn().mockImplementation(() => mockNOORMME)
      }))

      await expect(migrate({
        database: testContext.databasePath,
        status: true
      })).rejects.toThrow('Migration status failed')

      expect(consoleCapture.hasOutput('Migration status failed')).toBe(true)
    })
  })

  describe('Environment variable support', () => {
    it('should use DATABASE_PATH environment variable when database option is not provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      process.env.DATABASE_PATH = testContext.databasePath

      await migrate({})

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

      await migrate({})

      expect(consoleCapture.hasOutput('Database: ./database.sqlite')).toBe(true)

      // Restore original environment
      if (originalEnv) {
        process.env.DATABASE_PATH = originalEnv
      }
    })
  })

  describe('Migration recommendations', () => {
    it('should show migration recommendations', async () => {
      await migrate({
        database: testContext.databasePath
      })

      expect(consoleCapture.hasOutput('Migration Recommendations:')).toBe(true)
      expect(consoleCapture.hasOutput('To apply pending migrations:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme migrate --latest')).toBe(true)
      expect(consoleCapture.hasOutput('To generate a new migration:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme migrate --generate <name>')).toBe(true)
      expect(consoleCapture.hasOutput('To rollback last migration:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme migrate --rollback')).toBe(true)
    })
  })

  describe('Option combinations', () => {
    it('should handle conflicting options gracefully', async () => {
      // When multiple options are provided, the first one should take precedence
      await migrate({
        database: testContext.databasePath,
        latest: true,
        to: '002',
        rollback: true,
        generate: 'test_migration'
      })

      // Should show status by default when conflicting options are provided
      expect(consoleCapture.hasOutput('Migration Status:')).toBe(true)
    })
  })
})
