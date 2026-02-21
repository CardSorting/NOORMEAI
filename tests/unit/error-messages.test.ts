import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { NoormError, ColumnNotFoundError, TableNotFoundError, RelationshipNotFoundError } from '../../src/errors/NoormError.js'
import { createTestDatabase, cleanupTestDatabase, setupTestSchema } from '../../src/testing/test-utils.js'

describe('Error Messages', () => {
  let db: NOORMME

  beforeEach(async () => {
    db = await createTestDatabase({ seed: true })
  })

  afterEach(async () => {
    await cleanupTestDatabase(db)
  })

  describe('Column Not Found Errors', () => {
    it('should suggest similar column names for typos', async () => {
      const userRepo = db.getRepository('users')

      try {
        // Intentionally use wrong column name - use type assertion to bypass TypeScript check
        await (userRepo as any).findByEmai('test@example.com') // Should be 'email'
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ColumnNotFoundError)
        const noormError = error as ColumnNotFoundError
        expect(noormError.message).toContain('emai')
        expect(noormError.message).toContain('users')
        expect(noormError.context.suggestion).toContain('email')
        expect(noormError.context.availableOptions).toContain('email')
      }
    })

    it('should provide helpful context for column errors', async () => {
      const userRepo = db.getRepository('users')

      try {
        await (userRepo as any).findByInvalidColumn('test')
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ColumnNotFoundError)
        const noormError = error as ColumnNotFoundError
        expect(noormError.context.table).toBe('users')
        expect(noormError.context.operation).toBe('column_lookup')
        expect(noormError.context.availableOptions).toEqual(
          expect.arrayContaining(['id', 'name', 'email', 'age', 'active'])
        )
      }
    })

    it('should format error messages properly', async () => {
      const userRepo = db.getRepository('users')

      try {
        await (userRepo as any).findByInvalidColumn('test')
        expect(true).toBe(false)
      } catch (error) {
        const noormError = error as ColumnNotFoundError
        const formatted = noormError.getFormattedMessage()

        expect(formatted).toContain('Table: users')
        expect(formatted).toContain('Operation: column_lookup')
        expect(formatted).toContain('Available options:')
      }
    })
  })

  describe('Table Not Found Errors', () => {
    it('should suggest similar table names', async () => {
      try {
        db.getRepository('user') // Should be 'users'
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(NoormError)
        const noormError = error as NoormError
        expect(noormError.message).toContain('user')
        expect(noormError.message).toContain('Available tables')
      }
    })
  })

  describe('Relationship Not Found Errors', () => {
    it('should suggest available relationships', async () => {
      const userRepo = db.getRepository('users')
      
      // Create a user first so entity exists for relationship validation
      const user = await userRepo.create({
        name: 'Test User',
        email: 'relationship-test@example.com',
        age: 30,
        active: true
      }) as any

      try {
        await userRepo.withCount(user.id, ['invalid_relationship'])
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(RelationshipNotFoundError)
        const noormError = error as RelationshipNotFoundError
        expect(noormError.context.table).toBe('users')
        expect(noormError.context.availableOptions).toBeDefined()
      }
    })
  })

  describe('Error JSON Serialization', () => {
    it('should serialize error context to JSON', async () => {
      const userRepo = db.getRepository('users')

      try {
        await (userRepo as any).findByInvalidColumn('test')
        expect(true).toBe(false)
      } catch (error) {
        const noormError = error as ColumnNotFoundError
        const json = noormError.toJSON()

        expect(json.name).toBe('ColumnNotFoundError')
        expect(json.message).toBeDefined()
        expect(json.context).toBeDefined()
        expect(json.context.table).toBe('users')
        expect(json.stack).toBeDefined()
      }
    })
  })
})