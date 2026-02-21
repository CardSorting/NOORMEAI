import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase, setupTestSchema, TestDataFactory } from '../../src/testing/test-utils.js'

describe('Pagination', () => {
  let db: NOORMME
  let factory: TestDataFactory

  beforeEach(async () => {
    db = await createTestDatabase({ seed: true })
    factory = new TestDataFactory(db)
  })

  afterEach(async () => {
    await cleanupTestDatabase(db)
  })

  describe('Basic Pagination', () => {
    it('should return correct pagination metadata', async () => {
      // Create test data
      await factory.createUsers(25)

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({ page: 1, limit: 10 })

      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(result.pagination.total).toBe(25)
      expect(result.pagination.totalPages).toBe(3)
      expect(result.pagination.hasNext).toBe(true)
      expect(result.pagination.hasPrev).toBe(false)
      expect(result.data.length).toBe(10)
    })

    it('should handle second page correctly', async () => {
      await factory.createUsers(25)

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({ page: 2, limit: 10 })

      expect(result.pagination.page).toBe(2)
      expect(result.pagination.hasNext).toBe(true)
      expect(result.pagination.hasPrev).toBe(true)
      expect(result.data.length).toBe(10)
    })

    it('should handle last page correctly', async () => {
      await factory.createUsers(25)

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({ page: 3, limit: 10 })

      expect(result.pagination.page).toBe(3)
      expect(result.pagination.hasNext).toBe(false)
      expect(result.pagination.hasPrev).toBe(true)
      expect(result.data.length).toBe(5) // Last page has 5 items
    })

    it('should handle empty results', async () => {
      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({ page: 1, limit: 10 })

      expect(result.pagination.total).toBe(0)
      expect(result.pagination.totalPages).toBe(0)
      expect(result.pagination.hasNext).toBe(false)
      expect(result.pagination.hasPrev).toBe(false)
      expect(result.data.length).toBe(0)
    })
  })

  describe('Pagination with WHERE Conditions', () => {
    it('should filter results with WHERE clause', async () => {
      // Create mix of active and inactive users
      await factory.createUsers(10, { active: true })
      await factory.createUsers(5, { active: false })

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({
        page: 1,
        limit: 10,
        where: { active: true }
      })

      expect(result.pagination.total).toBe(10)
      expect(result.data.every((user: any) => user.active === true)).toBe(true)
    })

    it('should handle multiple WHERE conditions', async () => {
      // Create users with different ages
      await factory.createUsers(5, { age: 25, active: true })
      await factory.createUsers(5, { age: 30, active: true })
      await factory.createUsers(5, { age: 25, active: false })

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({
        page: 1,
        limit: 10,
        where: { age: 25, active: true }
      })

      expect(result.pagination.total).toBe(5)
      expect(result.data.every((user: any) => user.age === 25 && user.active === true)).toBe(true)
    })
  })

  describe('Pagination with ORDER BY', () => {
    it('should order results by specified column', async () => {
      // Create users with different ages
      const users = await factory.createUsers(5)
      // Update ages to specific values
      const userRepo = db.getRepository('users')
      await userRepo.update({ ...users[0], age: 30 })
      await userRepo.update({ ...users[1], age: 25 })
      await userRepo.update({ ...users[2], age: 35 })

      const result = await userRepo.paginate({
        page: 1,
        limit: 10,
        orderBy: { column: 'age', direction: 'asc' } as any
      })

      // Check that results are ordered by age ascending
      for (let i = 1; i < result.data.length; i++) {
        const prev = result.data[i-1] as any
        const current = result.data[i] as any
        if (prev.age && current.age) {
          expect(prev.age).toBeLessThanOrEqual(current.age)
        }
      }
    })

    it('should order results descending', async () => {
      const users = await factory.createUsers(5)
      const userRepo = db.getRepository('users')
      await userRepo.update({ ...users[0], age: 30 })
      await userRepo.update({ ...users[1], age: 25 })
      await userRepo.update({ ...users[2], age: 35 })

      const result = await userRepo.paginate({
        page: 1,
        limit: 10,
        orderBy: { column: 'age', direction: 'desc' } as any
      })

      // Check that results are ordered by age descending
      for (let i = 1; i < result.data.length; i++) {
        const prev = result.data[i-1] as any
        const current = result.data[i] as any
        if (prev.age && current.age) {
          expect(prev.age).toBeGreaterThanOrEqual(current.age)
        }
      }
    })
  })

  describe('Pagination with Combined Conditions', () => {
    it('should handle WHERE and ORDER BY together', async () => {
      // Create mix of users
      await factory.createUsers(5, { age: 25, active: true })
      await factory.createUsers(5, { age: 30, active: true })
      await factory.createUsers(5, { age: 25, active: false })

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({
        page: 1,
        limit: 10,
        where: { active: true },
        orderBy: { column: 'age', direction: 'desc' } as any
      })

      expect(result.pagination.total).toBe(10) // Only active users
      expect(result.data.every((user: any) => user.active === true)).toBe(true)

      // Check ordering
      for (let i = 1; i < result.data.length; i++) {
        const prev = result.data[i-1] as any
        const current = result.data[i] as any
        if (prev.age && current.age) {
          expect(prev.age).toBeGreaterThanOrEqual(current.age)
        }
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle page beyond total pages', async () => {
      await factory.createUsers(5)

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({ page: 10, limit: 10 })

      expect(result.pagination.page).toBe(10)
      expect(result.pagination.hasNext).toBe(false)
      expect(result.pagination.hasPrev).toBe(true)
      expect(result.data.length).toBe(0)
    })

    it('should handle large limit values', async () => {
      await factory.createUsers(5)

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({ page: 1, limit: 1000 })

      expect(result.pagination.limit).toBe(1000)
      expect(result.data.length).toBe(5) // Only 5 users exist
      expect(result.pagination.hasNext).toBe(false)
    })

    it('should handle limit of 1', async () => {
      await factory.createUsers(5)

      const userRepo = db.getRepository('users')
      const result = await userRepo.paginate({ page: 1, limit: 1 })

      expect(result.pagination.limit).toBe(1)
      expect(result.pagination.totalPages).toBe(5)
      expect(result.data.length).toBe(1)
      expect(result.pagination.hasNext).toBe(true)
    })
  })
})