/**
 * Comprehensive integration tests for transaction handling
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

describe('Transaction Handling Integration', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Basic Transaction Operations', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should execute successful transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Execute transaction
          const result = await db.transaction(async (trx) => {
            // Create user
            const user = await trx
              .insertInto('users')
              .values({
                id: 'tx-user',
                email: 'tx@example.com',
                firstName: 'Tx',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            // Create post
            const post = await trx
              .insertInto('posts')
              .values({
                id: 'tx-post',
                userId: user.id,
                title: 'Transaction Post',
                content: 'Transaction Content',
                published: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            return { user, post }
          })
          
          expect(result).to.exist
          expect((result.user as any).id).to.equal('tx-user')
          expect((result.post as any).id).to.equal('tx-post')
          expect((result.post as any).userId).to.equal((result.user as any).id)
          
          // Verify data exists
          const user = await userRepo.findById('tx-user')
          const post = await postRepo.findById('tx-post')
          
          expect(user).to.exist
          expect(post).to.exist
          expect((post as any)!.userId).to.equal((user as any)!.id)
          
          // Clean up
          await postRepo.delete('tx-post')
          await userRepo.delete('tx-user')
        }))
        
        it('should rollback failed transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          try {
            await db.transaction(async (trx) => {
              // Create user
              await trx
                .insertInto('users')
                .values({
                  id: 'rollback-user',
                  email: 'rollback@example.com',
                  firstName: 'Rollback',
                  lastName: 'User',
                  active: true
                })
                .execute()
              
              // Create post
              await trx
                .insertInto('posts')
                .values({
                  id: 'rollback-post',
                  userId: 'rollback-user',
                  title: 'Rollback Post',
                  content: 'Rollback Content',
                  published: true
                })
                .execute()
              
              // Force an error
              throw new Error('Transaction rollback test')
            })
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
            expect(error.message).to.equal('Transaction rollback test')
          }
          
          // User and post should not exist after rollback
          const user = await userRepo.findById('rollback-user')
          const post = await postRepo.findById('rollback-post')
          
          expect(user).to.be.null
          expect(post).to.be.null
        }))
        
        it('should handle transaction with multiple operations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Execute complex transaction
          const result = await db.transaction(async (trx) => {
            // Create user
            const user = await trx
              .insertInto('users')
              .values({
                id: 'complex-user',
                email: 'complex@example.com',
                firstName: 'Complex',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            // Create post
            const post = await trx
              .insertInto('posts')
              .values({
                id: 'complex-post',
                userId: user.id,
                title: 'Complex Post',
                content: 'Complex Content',
                published: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            // Create comments
            const comments: any[] = []
            for (let i = 0; i < 3; i++) {
              const comment = await trx
                .insertInto('comments')
                .values({
                  id: `complex-comment-${i}`,
                  postId: (post as any).id,
                  userId: (user as any).id,
                  content: `Comment ${i}`
                })
                .returningAll()
                .executeTakeFirstOrThrow()
              comments.push(comment)
            }
            
            return { user, post, comments }
          })
          
          expect(result).to.exist
          expect((result.user as any).id).to.equal('complex-user')
          expect((result.post as any).id).to.equal('complex-post')
          expect((result.comments as any).length).to.equal(3)
          
          // Verify all data exists
          const user = await userRepo.findById('complex-user')
          const post = await postRepo.findById('complex-post')
          const comments = await commentRepo.findAll()
          const userComments = comments.filter((c: any) => c.postId === 'complex-post')
          
          expect(user).to.exist
          expect(post).to.exist
          expect(userComments.length).to.equal(3)
          
          // Clean up
          for (const comment of userComments) {
            await commentRepo.delete((comment as any).id)
          }
          await postRepo.delete('complex-post')
          await userRepo.delete('complex-user')
        }))
      })
    }
  })
  
  describe('Nested Transactions', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle nested transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Execute nested transaction
          const result = await db.transaction(async (outerTrx) => {
            // Create user in outer transaction
            const user = await outerTrx
              .insertInto('users')
              .values({
                id: 'nested-user',
                email: 'nested@example.com',
                firstName: 'Nested',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            // Execute inner transaction
            const innerResult = await db.transaction(async (innerTrx) => {
              // Update user in inner transaction
              const updatedUser = await innerTrx
                .updateTable('users')
                .set({ firstName: 'Updated' })
                .where('id', '=', user.id)
                .returningAll()
                .executeTakeFirstOrThrow()
              
              return updatedUser
            })
            
            return { user, innerResult }
          })
          
          expect(result).to.exist
          expect((result.user as any).id).to.equal('nested-user')
          expect((result.innerResult as any).firstName).to.equal('Updated')
          
          // Verify data exists
          const user = await userRepo.findById('nested-user')
          expect(user).to.exist
          expect((user as any)!.firstName).to.equal('Updated')
          
          // Clean up
          await userRepo.delete('nested-user')
        }))
        
        it('should rollback nested transactions on error', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          try {
            await db.transaction(async (outerTrx) => {
              // Create user in outer transaction
              await outerTrx
                .insertInto('users')
                .values({
                  id: 'nested-rollback-user',
                  email: 'nestedrollback@example.com',
                  firstName: 'NestedRollback',
                  lastName: 'User',
                  active: true
                })
                .execute()
              
              // Execute inner transaction that fails
              await db.transaction(async (innerTrx) => {
                // Create post in inner transaction
                await innerTrx
                  .insertInto('posts')
                  .values({
                    id: 'nested-rollback-post',
                    userId: 'nested-rollback-user',
                    title: 'Nested Rollback Post',
                    content: 'Nested Rollback Content',
                    published: true
                  })
                  .execute()
                
                // Force an error in inner transaction
                throw new Error('Inner transaction error')
              })
            })
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
            expect(error.message).to.equal('Inner transaction error')
          }
          
          // User and post should not exist after rollback
          const user = await userRepo.findById('nested-rollback-user')
          const post = await postRepo.findById('nested-rollback-post')
          
          expect(user).to.be.null
          expect(post).to.be.null
        }))
        
        it('should handle complex nested transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Execute complex nested transaction
          const result = await db.transaction(async (outerTrx) => {
            // Create user in outer transaction
            const user = await outerTrx
              .insertInto('users')
              .values({
                id: 'complex-nested-user',
                email: 'complexnested@example.com',
                firstName: 'ComplexNested',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            // Execute inner transaction for posts
            const postResult = await db.transaction(async (innerTrx) => {
          const posts: any[] = []
          for (let i = 0; i < 2; i++) {
            const post = await innerTrx
              .insertInto('posts')
              .values({
                id: `complex-nested-post-${i}`,
                userId: (user as any).id,
                title: `Complex Nested Post ${i}`,
                content: `Complex Nested Content ${i}`,
                published: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            posts.push(post)
          }
              return posts
            })
            
            // Execute another inner transaction for comments
            const commentResult = await db.transaction(async (innerTrx) => {
              const comments: any[] = []
              for (const post of postResult) {
                for (let i = 0; i < 2; i++) {
                  const comment = await innerTrx
                    .insertInto('comments')
                    .values({
                      id: `complex-nested-comment-${(post as any).id}-${i}`,
                      postId: (post as any).id,
                      userId: (user as any).id,
                      content: `Comment ${i}`
                    })
                    .returningAll()
                    .executeTakeFirstOrThrow()
                  comments.push(comment)
                }
              }
              return comments
            })
            
            return { user, posts: postResult, comments: commentResult }
          })
          
          expect(result).to.exist
          expect(result.user.id).to.equal('complex-nested-user')
          expect(result.posts.length).to.equal(2)
          expect(result.comments.length).to.equal(4)
          
          // Verify all data exists
          const user = await userRepo.findById('complex-nested-user')
          const posts = await postRepo.findAll()
          const userPosts = posts.filter((p: any) => p.userId === 'complex-nested-user')
          const comments = await commentRepo.findAll()
          const userComments = comments.filter((c: any) => c.userId === 'complex-nested-user')
          
          expect(user).to.exist
          expect(userPosts.length).to.equal(2)
          expect(userComments.length).to.equal(4)
          
          // Clean up
          for (const comment of userComments) {
            await commentRepo.delete((comment as any).id)
          }
          for (const post of userPosts) {
            await postRepo.delete((post as any).id)
          }
          await userRepo.delete('complex-nested-user')
        }))
      })
    }
  })
  
  describe('Transaction with Repository Operations', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should use repositories within transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Execute transaction using repositories
          const result = await db.transaction(async (trx) => {
            // Create user using repository
            const user = await userRepo.create({
              id: 'repo-user',
              email: 'repo@example.com',
              firstName: 'Repo',
              lastName: 'User',
              active: true
            })
            
            // Create post using repository
            const post = await postRepo.create({
              id: 'repo-post',
              userId: (user as any).id,
              title: 'Repo Post',
              content: 'Repo Content',
              published: true
            })
            
            return { user, post }
          })
          
          expect(result).to.exist
          expect((result.user as any).id).to.equal('repo-user')
          expect((result.post as any).id).to.equal('repo-post')
          
          // Verify data exists
          const user = await userRepo.findById('repo-user')
          const post = await postRepo.findById('repo-post')
          
          expect(user).to.exist
          expect(post).to.exist
          
          // Clean up
          await postRepo.delete('repo-post')
          await userRepo.delete('repo-user')
        }))
        
        it('should handle repository operations with transaction rollback', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          try {
            await db.transaction(async (trx) => {
              // Create user using repository
              await userRepo.create({
                id: 'repo-rollback-user',
                email: 'reporellback@example.com',
                firstName: 'RepoRollback',
                lastName: 'User',
                active: true
              })
              
              // Create post using repository
              await postRepo.create({
                id: 'repo-rollback-post',
                userId: 'repo-rollback-user',
                title: 'Repo Rollback Post',
                content: 'Repo Rollback Content',
                published: true
              })
              
              // Force an error
              throw new Error('Repository transaction rollback test')
            })
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
            expect(error.message).to.equal('Repository transaction rollback test')
          }
          
          // User and post should not exist after rollback
          const user = await userRepo.findById('repo-rollback-user')
          const post = await postRepo.findById('repo-rollback-post')
          
          expect(user).to.be.null
          expect(post).to.be.null
        }))
        
        it('should handle repository updates within transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create user first
          const user = await userRepo.create({
            id: 'update-user',
            email: 'update@example.com',
            firstName: 'Update',
            lastName: 'User',
            active: true
          })
          
          // Execute transaction with repository updates
          const result = await db.transaction(async (trx) => {
            // Update user using repository
            const userToUpdate = user as any
            userToUpdate.firstName = 'Updated'
            userToUpdate.lastName = 'Name'
            const updatedUser = await userRepo.update(user as any)
            
            return updatedUser
          })
          
          expect(result).to.exist
          expect((result as any).firstName).to.equal('Updated')
          expect((result as any).lastName).to.equal('Name')
          
          // Verify update persisted
          const verifyUser = await userRepo.findById('update-user')
          expect((verifyUser as any)!.firstName).to.equal('Updated')
          expect((verifyUser as any)!.lastName).to.equal('Name')
          
          // Clean up
          await userRepo.delete('update-user')
        }))
      })
    }
  })
  
  describe('Transaction Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should execute transactions efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test transaction performance
          const duration = await performanceHelper.measure('transaction-execution', async () => {
            const result = await db.transaction(async (trx) => {
              // Create user
              const user = await trx
                .insertInto('users')
                .values({
                  id: 'perf-user',
                  email: 'perf@example.com',
                  firstName: 'Perf',
                  lastName: 'User',
                  active: true
                })
                .returningAll()
                .executeTakeFirstOrThrow()
              
              // Update user
              const updatedUser = await trx
                .updateTable('users')
                .set({ firstName: 'Updated' })
                .where('id', '=', user.id)
                .returningAll()
                .executeTakeFirstOrThrow()
              
              return updatedUser
            })
            return result
          })
          
          // Should be efficient
          expect(duration).to.be.lessThan(1000) // 1 second max
          
          // Clean up
          await userRepo.delete('perf-user')
        }))
        
        it('should handle concurrent transactions efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Execute concurrent transactions
          const start = performance.now()
          const promises: any[] = []
          
          for (let i = 0; i < 5; i++) {
            promises.push(
              db.transaction(async (trx) => {
                const user = await trx
                  .insertInto('users')
                  .values({
                    id: `concurrent-user-${i}`,
                    email: `concurrent${i}@example.com`,
                    firstName: `Concurrent${i}`,
                    lastName: 'User',
                    active: true
                  })
                  .returningAll()
                  .executeTakeFirstOrThrow()
                
                return user
              }) as any
            )
          }
          
          const results = await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should be efficient
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          expect(results.length).to.equal(5)
          
          // Verify all users were created
          for (let i = 0; i < 5; i++) {
            const user = await userRepo.findById(`concurrent-user-${i}`)
            expect(user).to.exist
            expect((user as any)!.firstName).to.equal(`Concurrent${i}`)
          }
          
          // Clean up
          for (let i = 0; i < 5; i++) {
            await userRepo.delete(`concurrent-user-${i}`)
          }
        }))
        
        it('should handle large transactions efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Test large transaction performance
          const duration = await performanceHelper.measure('large-transaction', async () => {
            const result = await db.transaction(async (trx) => {
              const users: any[] = []
              const posts: any[] = []
              
              // Create multiple users and posts
              for (let i = 0; i < 10; i++) {
                const user = await trx
                  .insertInto('users')
                  .values({
                    id: `large-user-${i}`,
                    email: `large${i}@example.com`,
                    firstName: `Large${i}`,
                    lastName: 'User',
                    active: true
                  })
                  .returningAll()
                  .executeTakeFirstOrThrow()
                users.push(user)
                
                const post = await trx
                  .insertInto('posts')
                  .values({
                    id: `large-post-${i}`,
                    userId: (user as any).id,
                    title: `Large Post ${i}`,
                    content: `Large Content ${i}`,
                    published: true
                  })
                  .returningAll()
                  .executeTakeFirstOrThrow()
                posts.push(post)
              }
              
              return { users, posts }
            })
            return result
          })
          
          // Should be efficient even for large transactions
          expect(duration).to.be.lessThan(3000) // 3 seconds max
          
          // Verify all data was created
          const allUsers = await userRepo.findAll()
          const largeUsers = allUsers.filter((u: any) => u.id.startsWith('large-user-'))
          expect(largeUsers.length).to.equal(10)
          
          // Clean up
          for (let i = 0; i < 10; i++) {
            await postRepo.delete(`large-post-${i}`)
            await userRepo.delete(`large-user-${i}`)
          }
        }))
      })
    }
  })
  
  describe('Transaction Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle database constraint errors', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          try {
            await db.transaction(async (trx) => {
              // Create user with duplicate ID
              await trx
                .insertInto('users')
                .values({
                  id: 'user-1', // This ID already exists
                  email: 'duplicate@example.com',
                  firstName: 'Duplicate',
                  lastName: 'User',
                  active: true
                })
                .execute()
            })
          } catch (error) {
            // Expected constraint error
            expect(error).to.be.instanceOf(Error)
          }
          
          // Original user should still exist
          const originalUser = await userRepo.findById('user-1')
          expect(originalUser).to.exist
          expect((originalUser as any)!.email).to.equal('john@example.com')
        }))
        
        it('should handle invalid SQL in transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          try {
            await db.transaction(async (trx) => {
              // Execute invalid SQL
              await trx.executeQuery({
                sql: 'INVALID SQL QUERY',
                parameters: []
              } as any)
            })
          } catch (error) {
            // Expected SQL error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        
        it('should handle connection errors in transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Close the database connection
          await db.close()
          
          try {
            await db.transaction(async (trx) => {
              // This should fail due to closed connection
              await trx
                .insertInto('users')
                .values({
                  id: 'connection-error-user',
                  email: 'connectionerror@example.com',
                  firstName: 'ConnectionError',
                  lastName: 'User',
                  active: true
                })
                .execute()
            })
          } catch (error) {
            // Expected connection error
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })
  
  describe('Transaction Isolation', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should maintain transaction isolation', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Start first transaction
          const transaction1 = db.transaction(async (trx1) => {
            // Create user in transaction 1
            const user = await trx1
              .insertInto('users')
              .values({
                id: 'isolation-user-1',
                email: 'isolation1@example.com',
                firstName: 'Isolation1',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            // Wait a bit to allow other operations
            await new Promise(resolve => setTimeout(resolve, 100))
            
            return user
          })
          
          // Start second transaction
          const transaction2 = db.transaction(async (trx2) => {
            // Create user in transaction 2
            const user = await trx2
              .insertInto('users')
              .values({
                id: 'isolation-user-2',
                email: 'isolation2@example.com',
                firstName: 'Isolation2',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            return user
          })
          
          // Execute both transactions concurrently
          const [result1, result2] = await Promise.all([transaction1, transaction2])
          
          expect(result1).to.exist
          expect(result2).to.exist
          expect((result1 as any).id).to.equal('isolation-user-1')
          expect((result2 as any).id).to.equal('isolation-user-2')
          
          // Verify both users exist
          const user1 = await userRepo.findById('isolation-user-1')
          const user2 = await userRepo.findById('isolation-user-2')
          
          expect(user1).to.exist
          expect(user2).to.exist
          
          // Clean up
          await userRepo.delete('isolation-user-1')
          await userRepo.delete('isolation-user-2')
        }))
        
        it('should handle transaction conflicts gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create user first
          const user = await userRepo.create({
            id: 'conflict-user',
            email: 'conflict@example.com',
            firstName: 'Conflict',
            lastName: 'User',
            active: true
          })
          
          // Start two transactions that try to update the same user
          const transaction1 = db.transaction(async (trx1) => {
            // Update user in transaction 1
            const updatedUser = await trx1
              .updateTable('users')
              .set({ firstName: 'Updated1' })
              .where('id', '=', (user as any).id)
              .returningAll()
              .executeTakeFirstOrThrow()
            
            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100))
            
            return updatedUser
          })
          
          const transaction2 = db.transaction(async (trx2) => {
            // Update user in transaction 2
            const updatedUser = await trx2
              .updateTable('users')
              .set({ firstName: 'Updated2' })
              .where('id', '=', (user as any).id)
              .returningAll()
              .executeTakeFirstOrThrow()
            
            return updatedUser
          })
          
          // Execute both transactions
          const [result1, result2] = await Promise.all([transaction1, transaction2])
          
          expect(result1).to.exist
          expect(result2).to.exist
          
          // Verify final state
          const finalUser = await userRepo.findById('conflict-user')
          expect(finalUser).to.exist
          expect((finalUser as any)!.firstName).to.be.oneOf(['Updated1', 'Updated2'])
          
          // Clean up
          await userRepo.delete('conflict-user')
        }))
      })
    }
  })
})