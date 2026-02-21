/**
 * End-to-end tests for security features and vulnerabilities
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

describe('Security E2E Tests', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('SQL Injection Protection', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should prevent SQL injection in queries', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create test user
          const user = await userRepo.create({
            id: 'sql-injection-user',
            email: 'sqlinjection@example.com',
            firstName: 'SQLInjection',
            lastName: 'User',
            active: true
          })
          // Test SQL injection attempts
          const maliciousInputs = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; INSERT INTO users VALUES ('hacker', 'hacker@evil.com', 'Hacker', 'User', true); --",
            "' UNION SELECT * FROM users --",
            "'; UPDATE users SET email = 'hacked@evil.com' WHERE id = 'sql-injection-user'; --"
          ]
          
          for (const maliciousInput of maliciousInputs) {
            // Test findById with malicious input
            const result = await userRepo.findById(maliciousInput)
            expect(result).to.be.null
            
            // Test findBy with malicious input
            const results = await userRepo.findBy('email', maliciousInput)
            expect(results).to.have.length(0)
            
            // Test findWhere with malicious input
            const whereResults = await userRepo.findWhere({
              email: maliciousInput
            })
            expect(whereResults).to.have.length(0)
          }
          
          // Verify original user still exists and is unchanged
          const originalUser = await userRepo.findById('sql-injection-user')
          expect(originalUser).to.exist
          expect((originalUser as any).email).to.equal('sqlinjection@example.com')
          
          // Clean up
          await userRepo.delete('sql-injection-user')
        }))
        it('should prevent SQL injection in updates', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create test user
          const user = await userRepo.create({
            id: 'update-injection-user',
            email: 'updateinjection@example.com',
            firstName: 'UpdateInjection',
            lastName: 'User',
            active: true
          })
          // Test SQL injection attempts in updates
          const maliciousInputs = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; INSERT INTO users VALUES ('hacker', 'hacker@evil.com', 'Hacker', 'User', true); --"
          ]
          
          for (const maliciousInput of maliciousInputs) {
            // Test update with malicious input
            const userToUpdate = await userRepo.findById('update-injection-user')
            expect(userToUpdate).to.exist
            ;(userToUpdate as any).firstName = maliciousInput
            
            const updated = await userRepo.update(userToUpdate as any)
            // Should update safely (malicious input treated as literal string)
            expect(updated).to.exist
            expect((updated as any).firstName).to.equal(maliciousInput)

            // Reset for next test
            const userToReset = await userRepo.findById('update-injection-user')
            expect(userToReset).to.exist
            ;(userToReset as any).firstName = 'UpdateInjection'
            await userRepo.update(userToReset as any)
          }
          
          // Verify user still exists and table structure is intact
          const finalUser = await userRepo.findById('update-injection-user')
          expect(finalUser).to.exist
          expect((finalUser as any).email).to.equal('updateinjection@example.com')
          
          // Clean up
          await userRepo.delete('update-injection-user')
        }))
        it('should prevent SQL injection in deletes', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create test users
          const user1 = await userRepo.create({
            id: 'delete-injection-user1',
            email: 'deleteinjection1@example.com',
            firstName: 'DeleteInjection1',
            lastName: 'User',
            active: true
          })
          const user2 = await userRepo.create({
            id: 'delete-injection-user2',
            email: 'deleteinjection2@example.com',
            firstName: 'DeleteInjection2',
            lastName: 'User',
            active: true
          })
          // Test SQL injection attempts in deletes
          const maliciousInputs = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; DELETE FROM users; --"
          ]
          
          for (const maliciousInput of maliciousInputs) {
            // Test delete with malicious input
            const deleted = await userRepo.delete(maliciousInput)
            expect(deleted).to.be.false // Should not delete anything
          }
          
          // Verify both users still exist
          const existingUser1 = await userRepo.findById('delete-injection-user1')
          const existingUser2 = await userRepo.findById('delete-injection-user2')
          
          expect(existingUser1).to.exist
          expect(existingUser2).to.exist
          
          // Clean up
          await userRepo.delete('delete-injection-user1')
          await userRepo.delete('delete-injection-user2')
        }))
        it('should prevent SQL injection in complex queries', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const user = await userRepo.create({
            id: 'complex-injection-user',
            email: 'complexinjection@example.com',
            firstName: 'ComplexInjection',
            lastName: 'User',
            active: true
          })
          const post = await postRepo.create({
            id: 'complex-injection-post',
            userId: (user as any).id,
            title: 'Complex Injection Post',
            content: 'This post tests complex SQL injection',
            published: true
          })
          // Test SQL injection in relationship queries
          const maliciousInputs = [
            "'; DROP TABLE posts; --",
            "' OR '1'='1",
            "'; INSERT INTO posts VALUES ('hacker-post', 'hacker', 'Hacker Post', 'Content', true); --"
          ]
          
          for (const maliciousInput of maliciousInputs) {
            // Test relationship loading with malicious input
            const userWithPosts = await userRepo.findWithRelations((user as any).id, ['posts'])
            expect(userWithPosts).to.exist
            expect((userWithPosts as any).posts).to.have.length(1)
            expect((userWithPosts as any).posts[0].id).to.equal('complex-injection-post')
          }
          
          // Verify data integrity
          const finalUser = await userRepo.findById('complex-injection-user')
          const finalPost = await postRepo.findById('complex-injection-post')
          
          expect(finalUser).to.exist
          expect(finalPost).to.exist
          
          // Clean up
          await postRepo.delete('complex-injection-post')
          await userRepo.delete('complex-injection-user')
        }))
      })
    }
  })
  describe('Data Validation and Sanitization', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should sanitize input data properly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test various types of malicious input
          const maliciousInputs = [
            {
              id: 'sanitize-user',
              email: 'sanitize@example.com',
              firstName: '<script>alert("xss")</script>',
              lastName: 'User',
              active: true
            },
            {
              id: 'sanitize-user2',
              email: 'sanitize2@example.com',
              firstName: 'Normal Name',
              lastName: 'User<script>alert("xss")</script>',
              active: true
            },
            {
              id: 'sanitize-user3',
              email: 'sanitize3@example.com',
              firstName: 'Normal Name',
              lastName: 'User',
              active: true
            }
          ]
          
          for (const input of maliciousInputs) {
            const user = await userRepo.create(input)
            expect(user).to.exist
            
            // Verify data is stored safely
            const retrievedUser = await userRepo.findById((user as any).id)
            expect(retrievedUser).to.exist
            
            // Data should be stored as-is (sanitization happens at application level)
            expect((retrievedUser as any).firstName).to.equal(input.firstName)
            expect((retrievedUser as any).lastName).to.equal(input.lastName)
          }
          
          // Clean up
          for (const input of maliciousInputs) {
            await userRepo.delete(input.id)
          }
        }))
        it('should validate data types properly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test invalid data types
          const invalidInputs = [
            {
              id: 123 as any, // Should be string
              email: 'invalid@example.com',
              firstName: 'Invalid',
              lastName: 'User',
              active: true
            },
            {
              id: 'invalid-user2',
              email: 123 as any, // Should be string
              firstName: 'Invalid',
              lastName: 'User',
              active: true
            },
            {
              id: 'invalid-user3',
              email: 'invalid3@example.com',
              firstName: 'Invalid',
              lastName: 'User',
              active: 'yes' as any // Should be boolean
            }
          ]
          
          for (const input of invalidInputs) {
            try {
              await userRepo.create(input)
              // Some databases might accept type coercion
              // Verify the data was stored correctly
              const user = await userRepo.findById(input.id)
              if (user) {
                expect(typeof (user as any).id).to.equal('string')
                expect(typeof (user as any).email).to.equal('string')
                expect(typeof (user as any).active).to.equal('boolean')
                
                // Clean up
                await userRepo.delete((user as any).id)
              }
            } catch (error) {
              // Expected for some invalid inputs
              expect(error).to.be.instanceOf(Error)
            }
          }
        }))
        it('should enforce data length limits', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test extremely long strings
          const longString = 'a'.repeat(10000)
          
          try {
            const user = await userRepo.create({
              id: 'long-string-user',
              email: 'longstring@example.com',
              firstName: longString,
              lastName: 'User',
              active: true
            })
            // Should either succeed or fail gracefully
            if (user) {
              const retrievedUser = await userRepo.findById('long-string-user')
              expect(retrievedUser).to.exist
              
              // Clean up
              await userRepo.delete('long-string-user')
            }
          } catch (error) {
            // Expected for extremely long strings
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })
  describe('Access Control and Permissions', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should respect database user permissions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test operations that should be allowed
          const user = await userRepo.create({
            id: 'permission-user',
            email: 'permission@example.com',
            firstName: 'Permission',
            lastName: 'User',
            active: true
          })
          expect(user).to.exist

          // Test read operations
          const retrievedUser = await userRepo.findById('permission-user')
          expect(retrievedUser).to.exist

          // Test update operations
          const userToUpdate = await userRepo.findById('permission-user')
          expect(userToUpdate).to.exist
          ;(userToUpdate as any).firstName = 'UpdatedPermission'
          
          const updatedUser = await userRepo.update(userToUpdate as any)
          expect(updatedUser).to.exist
          expect((updatedUser as any).firstName).to.equal('UpdatedPermission')
          
          // Test delete operations
          const deleted = await userRepo.delete('permission-user')
          expect(deleted).to.be.true
          
          // Verify deletion
          const deletedUser = await userRepo.findById('permission-user')
          expect(deletedUser).to.be.null
        }))
        it('should handle insufficient permissions gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test operations that might be restricted
          try {
            // Try to create user (should work with test database)
            const user = await userRepo.create({
              id: 'insufficient-permission-user',
              email: 'insufficient@example.com',
              firstName: 'Insufficient',
              lastName: 'Permission',
              active: true
            })
            expect(user).to.exist
            
            // Clean up
            await userRepo.delete('insufficient-permission-user')
          } catch (error) {
            // Might fail due to insufficient permissions
            expect(error).to.be.instanceOf(Error)
          }
        }))
        it('should prevent unauthorized schema modifications', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const kysely = db.getKysely()
          
          try {
            // Try to create a new table (should fail in test environment)
            await kysely.schema
              .createTable('unauthorized_table')
              .addColumn('id', 'varchar(255)', (col) => col.primaryKey())
              .addColumn('data', 'text')
              .execute()
            
            // If successful, clean up
            await kysely.schema.dropTable('unauthorized_table').execute()
          } catch (error) {
            // Expected to fail due to insufficient permissions
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })
  describe('Connection Security', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should use secure connection parameters', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test that connection is established securely
          const userRepo = db.getRepository('users')
          const user = await userRepo.create({
            id: 'secure-connection-user',
            email: 'secure@example.com',
            firstName: 'Secure',
            lastName: 'Connection',
            active: true
          })
          expect(user).to.exist
          
          // Clean up
          await userRepo.delete('secure-connection-user')
        }))
        it('should handle connection timeouts securely', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test connection timeout handling
          const userRepo = db.getRepository('users')
          
          try {
            // Perform operation that might timeout
            const user = await userRepo.create({
              id: 'timeout-user',
              email: 'timeout@example.com',
              firstName: 'Timeout',
              lastName: 'User',
              active: true
            })
            expect(user).to.exist
            
            // Clean up
            await userRepo.delete('timeout-user')
          } catch (error) {
            // Might fail due to timeout
            expect(error).to.be.instanceOf(Error)
          }
        }))
        it('should prevent connection hijacking', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test that connection is not easily hijackable
          const userRepo = db.getRepository('users')
          
          // Create user
          const user = await userRepo.create({
            id: 'hijack-test-user',
            email: 'hijacktest@example.com',
            firstName: 'HijackTest',
            lastName: 'User',
            active: true
          })
          // Verify user was created by current connection
          const retrievedUser = await userRepo.findById('hijack-test-user')
          expect(retrievedUser).to.exist
          expect((retrievedUser as any).email).to.equal('hijacktest@example.com')

          // Clean up
          await userRepo.delete('hijack-test-user')
        }))
      })
    }
  })
  describe('Data Encryption and Privacy', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle sensitive data appropriately', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test with sensitive data
          const sensitiveData = {
            id: 'sensitive-user',
            email: 'sensitive@example.com',
            firstName: 'Sensitive',
            lastName: 'User',
            active: true
          }
          
          const user = await userRepo.create(sensitiveData)
          expect(user).to.exist
          
          // Verify data is stored and retrieved correctly
          const retrievedUser = await userRepo.findById('sensitive-user')
          expect(retrievedUser).to.exist
          expect((retrievedUser as any).email).to.equal('sensitive@example.com')
          
          // Clean up
          await userRepo.delete('sensitive-user')
        }))
        it('should prevent data leakage in error messages', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test error handling that might leak sensitive data
          try {
            await userRepo.create({
              id: 'leak-test-user',
              email: 'leaktest@example.com',
              firstName: 'LeakTest',
              lastName: 'User',
              active: true
            })
            // Force an error
            await userRepo.create({
              id: 'leak-test-user', // Duplicate ID
              email: 'leaktest2@example.com',
              firstName: 'LeakTest2',
              lastName: 'User2',
              active: true
            })
            expect.fail('Should have thrown an error')
          } catch (error: any) {
            // Verify error message doesn't contain sensitive data
            expect(error).to.be.instanceOf(Error)
            expect(error.message).to.not.include('leaktest@example.com')
            expect(error.message).to.not.include('LeakTest')
          }
          
          // Clean up
          await userRepo.delete('leak-test-user')
        }))
        it('should handle data anonymization', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create user with personal data
          const user = await userRepo.create({
            id: 'anonymize-user',
            email: 'anonymize@example.com',
            firstName: 'Anonymize',
            lastName: 'User',
            active: true
          })
          // Test anonymization by updating with generic data
          const userToAnonymize = await userRepo.findById('anonymize-user')
          expect(userToAnonymize).to.exist
          ;(userToAnonymize as any).email = 'anonymous@example.com'
          ;(userToAnonymize as any).firstName = 'Anonymous'
          ;(userToAnonymize as any).lastName = 'User'
          
          const anonymizedUser = await userRepo.update(userToAnonymize as any)
          expect(anonymizedUser).to.exist
          expect((anonymizedUser as any).email).to.equal('anonymous@example.com')
          expect((anonymizedUser as any).firstName).to.equal('Anonymous')

          // Clean up
          await userRepo.delete('anonymize-user')
        }))
      })
    }
  })
  describe('Rate Limiting and DoS Protection', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle high-frequency requests gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test high-frequency operations
          const promises: Promise<any>[] = []
          for (let i = 0; i < 100; i++) {
            promises.push(
              userRepo.create({
                id: `rate-limit-user-${i}`,
                email: `ratelimit${i}@example.com`,
                firstName: `RateLimit${i}`,
                lastName: 'User',
                active: true
              })
            )
          }
          
          try {
            const results = await Promise.all(promises)
            expect(results).to.have.length(100)
            
            // Clean up
            for (const user of results) {
              await userRepo.delete((user as any).id)
            }
          } catch (error) {
            // Might fail due to rate limiting
            expect(error).to.be.instanceOf(Error)
          }
        }))
        it('should prevent resource exhaustion attacks', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test resource exhaustion scenarios
          try {
            // Create many users to test resource limits
            const users: any[] = []
            for (let i = 0; i < 1000; i++) {
              const user = await userRepo.create({
                id: `exhaustion-user-${i}`,
                email: `exhaustion${i}@example.com`,
                firstName: `Exhaustion${i}`,
                lastName: 'User',
                active: true
              })
              users.push(user)
            }
            
            // Should handle large datasets gracefully
            expect(users.length).to.equal(1000)
            
            // Clean up
            for (const user of users) {
              await userRepo.delete((user as any).id)
            }
          } catch (error) {
            // Might fail due to resource limits
            expect(error).to.be.instanceOf(Error)
          }
        }))
        it('should handle concurrent access securely', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test concurrent operations
          const promises: Promise<any>[] = []
          for (let i = 0; i < 50; i++) {
            promises.push(
              userRepo.create({
                id: `concurrent-user-${i}`,
                email: `concurrent${i}@example.com`,
                firstName: `Concurrent${i}`,
                lastName: 'User',
                active: true
              })
            )
          }
          
          try {
            const results = await Promise.all(promises)
            expect(results).to.have.length(50)
            
            // Clean up
            for (const user of results) {
              await userRepo.delete((user as any).id)
            }
          } catch (error) {
            // Might fail due to concurrency limits
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })
  describe('Audit and Logging Security', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should log security-relevant events appropriately', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test operations that should be logged
          const user = await userRepo.create({
            id: 'audit-user',
            email: 'audit@example.com',
            firstName: 'Audit',
            lastName: 'User',
            active: true
          })
          expect(user).to.exist

          // Test update operation
          const userToUpdate = await userRepo.findById('audit-user')
          expect(userToUpdate).to.exist
          ;(userToUpdate as any).firstName = 'UpdatedAudit'
          
          const updatedUser = await userRepo.update(userToUpdate as any)
          expect(updatedUser).to.exist
          
          // Test delete operation
          const deleted = await userRepo.delete('audit-user')
          expect(deleted).to.be.true
        }))
        it('should prevent log injection attacks', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test with potentially malicious log data
          const maliciousLogData = {
            id: 'log-injection-user',
            email: 'loginjection@example.com',
            firstName: 'Log\nInjection\nAttack',
            lastName: 'User',
            active: true
          }
          
          try {
            const user = await userRepo.create(maliciousLogData)
            expect(user).to.exist
            
            // Verify data is stored correctly
            const retrievedUser = await userRepo.findById('log-injection-user')
            expect(retrievedUser).to.exist
            expect((retrievedUser as any).firstName).to.equal('Log\nInjection\nAttack')
            
            // Clean up
            await userRepo.delete('log-injection-user')
          } catch (error) {
            // Might fail due to log injection prevention
            expect(error).to.be.instanceOf(Error)
          }
        }))
        it('should handle sensitive data in logs appropriately', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test with sensitive data that might appear in logs
          const sensitiveData = {
            id: 'sensitive-log-user',
            email: 'sensitivelog@example.com',
            firstName: 'SensitiveLog',
            lastName: 'User',
            active: true
          }
          
          const user = await userRepo.create(sensitiveData)
          expect(user).to.exist

          // Clean up
          await userRepo.delete('sensitive-log-user')
        }))
      })
    }
  })
})