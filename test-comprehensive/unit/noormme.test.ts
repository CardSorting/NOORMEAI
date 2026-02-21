/**
 * Comprehensive unit tests for NOORMME core functionality
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { NOORMME } from '../../src/noormme.js';
import { withTestDatabase, performanceHelper, memoryHelper, assertions } from '../setup/test-helpers.js';
import { getEnabledDatabases } from '../setup/test-config.js';

describe('NOORMME Core Functionality', () => {
  const enabledDatabases = getEnabledDatabases();
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing');
    return;
  }

  describe('Initialization', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should initialize successfully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          
          // Should not throw during initialization
          try {
            ;
          } catch (error) {
            expect.fail('Database initialization should not throw an error');
          }
          
          // Should be marked as initialized
          expect(db).to.have.property('initialized', true);
        }));

        it('should throw error when getting repository before initialization', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          
          // Create new instance without initializing
          const newDb = new NOORMME({
            dialect,
            connection: testDb.connection
          });
          
          expect(() => {
            newDb.getRepository('users');
          }).to.throw('NOORMME must be initialized before getting repositories');
        }));

        it('should throw error for non-existent table', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          expect(() => {
            db.getRepository('nonexistent_table');
          }).to.throw('Table \'nonexistent_table\' not found in schema');
        }));

        it('should provide Kysely instance', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const kysely = db.getKysely();
          expect(kysely).to.exist;
          expect(typeof kysely.selectFrom).to.equal('function');
          expect(typeof kysely.insertInto).to.equal('function');
          expect(typeof kysely.updateTable).to.equal('function');
          expect(typeof kysely.deleteFrom).to.equal('function');
        }));

        it('should provide performance metrics', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const metrics = db.getPerformanceMetrics();
          expect(metrics).to.have.property('queryCount');
          expect(metrics).to.have.property('averageQueryTime');
          expect(metrics).to.have.property('cacheHitRate');
          expect(metrics).to.have.property('repositoryCount');
          
          expect(metrics.queryCount).to.be.a('number');
          expect(metrics.averageQueryTime).to.be.a('number');
          expect(metrics.cacheHitRate).to.be.a('number');
          expect(metrics.repositoryCount).to.be.a('number');
        }));
      });
    }
  });

  describe('Repository Management', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should create repository for existing table', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const userRepo = db.getRepository('users');
          expect(userRepo).to.exist;
          expect(typeof userRepo.findById).to.equal('function');
          expect(typeof userRepo.findAll).to.equal('function');
          expect(typeof userRepo.create).to.equal('function');
          expect(typeof userRepo.update).to.equal('function');
          expect(typeof userRepo.delete).to.equal('function');
        }));

        it('should cache repository instances', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const repo1 = db.getRepository('users');
          const repo2 = db.getRepository('users');
          
          expect(repo1).to.equal(repo2);
        }));

        it('should create different repositories for different tables', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const userRepo = db.getRepository('users');
          const postRepo = db.getRepository('posts');
          
          expect(userRepo).to.not.equal(postRepo);
        }));

        it('should provide schema information', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const schemaInfo = await db.getSchemaInfo();
          expect(schemaInfo).to.have.property('tables');
          expect(schemaInfo).to.have.property('relationships');
          expect(schemaInfo).to.have.property('views');
          
          expect(schemaInfo.tables).to.be.an('array');
          expect(schemaInfo.relationships).to.be.an('array');
          expect(schemaInfo.views).to.be.an('array');
          
          // Should have our test tables
          const tableNames = schemaInfo.tables.map(t => t.name);
          expect(tableNames).to.include('users');
          expect(tableNames).to.include('posts');
          expect(tableNames).to.include('comments');
        }));
      });
    }
  });

  describe('Configuration Management', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should update configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          // Update logging configuration
          db.updateConfig({
            logging: {
              level: 'debug',
              enabled: true
            }
          });
          
          // Should not throw
          expect(() => {
            db.updateConfig({
              cache: {
                ttl: 600000,
                maxSize: 2000
              }
            });
          }).to.not.throw();
        }));

        it('should handle invalid configuration gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          // Should not throw with invalid config
          expect(() => {
            db.updateConfig({
              logging: {
                level: 'invalid' as any,
                enabled: true
              }
            });
          }).to.not.throw();
        }));
      });
    }
  });

  describe('Transaction Support', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should execute transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const result = await db.transaction(async (trx) => {
            const user = await trx
              .insertInto('users')
              .values({
                id: 'transaction-user',
                email: 'transaction@example.com',
                firstName: 'Transaction',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow();
            
            return user;
          });
          
          expect(result).to.exist;
          expect(result.id).to.equal('transaction-user');
          expect(result.email).to.equal('transaction@example.com');
        }));

        it('should rollback transactions on error', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          try {
            await db.transaction(async (trx) => {
              await trx
                .insertInto('users')
                .values({
                  id: 'rollback-user',
                  email: 'rollback@example.com',
                  firstName: 'Rollback',
                  lastName: 'User',
                  active: true
                })
                .execute();
              
              // Force an error
              throw new Error('Transaction rollback test');
            });
          } catch (error) {
            // Expected error
          }
          
          // User should not exist after rollback
          const userRepo = db.getRepository('users');
          const user = await userRepo.findById('rollback-user');
          expect(user).to.be.null;
        }));
      });
    }
  });

  describe('Raw SQL Execution', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should execute raw SQL queries', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const result = await db.execute('SELECT COUNT(*) as count FROM users');
          expect(result).to.exist;
          expect(result[0]).to.have.property('count');
          expect(result[0].count).to.be.a('number');
        }));

        it('should execute raw SQL with parameters', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const result = await db.execute('SELECT * FROM users WHERE active = ?', [true]);
          expect(result).to.be.an('array');
        }));
      });
    }
  });

  describe('Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should initialize within performance threshold', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          
          const start = performance.now();
          ;
          const duration = performance.now() - start;
          
          // Initialization should be fast
          expect(duration).to.be.lessThan(1000); // 1 second max
        }));

        it('should handle memory efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          
          const { delta } = await memoryHelper.measureMemory(async () => {
            ;
          });
          
          // Memory usage should be reasonable
          assertions.assertMemoryUsage(delta, 50); // 50MB limit
        }));

        it('should maintain performance with multiple repositories', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const start = performance.now();
          // Create multiple repositories
          for (let i = 0; i < 100; i++) {
            db.getRepository('users');
            db.getRepository('posts');
            db.getRepository('comments');
          }
          const duration = performance.now() - start;
          
          // Should be very fast due to caching
          expect(duration).to.be.lessThan(100); // 100ms max
        }));
      });
    }
  });

  describe('Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle database connection errors gracefully', async () => {
          const invalidDb = new NOORMME({
            dialect,
            connection: {
              host: 'invalid-host',
              port: 9999,
              database: 'invalid-db',
              username: 'invalid-user',
              password: 'invalid-password'
            }
          });
          
          try {
            await invalidDb.initialize();
            expect.fail('Database initialization should throw an error for invalid connection');
          } catch (error) {
            expect(error).to.be.instanceOf(Error);
          }
        });

        it('should handle invalid SQL gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          try {
            await db.execute('INVALID SQL QUERY');
            expect.fail('Invalid SQL should throw an error');
          } catch (error) {
            expect(error).to.be.instanceOf(Error);
          }
        }));

        it('should handle repository operations on closed database', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          await db.close();
          
          expect(() => {
            db.getRepository('users');
          }).to.throw('NOORMME must be initialized before getting repositories');
        }));
      });
    }
  });

  describe('Cleanup', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should close database connections properly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          // Should not throw
          try {
            await db.close();
          } catch (error) {
            expect.fail('Database close should not throw an error');
          }
          
          // Should be marked as not initialized
          expect(db).to.have.property('initialized', false);
        }));

        it('should handle multiple close calls gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          // First close
          await db.close();
          
          // Second close should not throw
          try {
            await db.close();
          } catch (error) {
            expect.fail('Multiple database close calls should not throw an error');
          }
        }));
      });
    }
  });
});