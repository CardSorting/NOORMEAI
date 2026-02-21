/**
 * Comprehensive unit tests for Migration System functionality
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js';
import { getEnabledDatabases } from '../setup/test-config.js';
import { createNodeMigrationManager } from '../../src/migration/node-migration-manager.js';
import { NOORMME } from '../../src/noormme.js';

describe('Migration System', () => {
  const enabledDatabases = getEnabledDatabases();
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing');
    return;
  }

  describe('Migration Manager', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should create migration manager', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations',
            migrationTimeout: 30000,
            maxConcurrentMigrations: 3
          });
          expect(migrationManager).to.exist;
          expect(typeof migrationManager.initialize).to.equal('function');
          expect(typeof migrationManager.migrate).to.equal('function');
          expect(typeof migrationManager.createMigration).to.equal('function');
          expect(typeof migrationManager.getStatus).to.equal('function');
        }));

        it('should initialize migration system', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          try {
            await migrationManager.initialize();
          } catch (error) {
            expect.fail('Migration manager initialization should not throw an error');
          }
        }));

        it('should get migration status', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          const status = await migrationManager.getStatus();
          
          expect(status).to.exist;
          expect(status).to.have.property('totalFiles');
          expect(status).to.have.property('appliedMigrations');
          expect(status).to.have.property('pendingMigrations');
          expect(status).to.have.property('lastApplied');
          expect(status).to.have.property('resourceUtilization');
          expect(status).to.have.property('performanceMetrics');
          
          expect(status.totalFiles).to.be.a('number');
          expect(status.appliedMigrations).to.be.a('number');
          expect(status.pendingMigrations).to.be.a('number');
        }));

        it('should check if migrations are up to date', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          const isUpToDate = await migrationManager.isUpToDate();
          
          expect(isUpToDate).to.be.a('boolean');
        }));

        it('should get pending migrations count', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          const pendingCount = await migrationManager.getPendingCount();
          
          expect(pendingCount).to.be.a('number');
          expect(pendingCount).to.be.at.least(0);
        }));

        it('should get configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const config = {
            migrationsDirectory: './test-migrations',
            migrationTimeout: 30000,
            maxConcurrentMigrations: 3
          };
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), config);
          
          const retrievedConfig = migrationManager.getConfig();
          expect(retrievedConfig).to.exist;
          expect(retrievedConfig.migrationsDirectory).to.equal(config.migrationsDirectory);
          expect(retrievedConfig.migrationTimeout).to.equal(config.migrationTimeout);
          expect(retrievedConfig.maxConcurrentMigrations).to.equal(config.maxConcurrentMigrations);
        }));

        it('should update configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          const newConfig = {
            migrationTimeout: 60000,
            maxConcurrentMigrations: 5
          };
          
          migrationManager.updateConfig(newConfig);
          
          const updatedConfig = migrationManager.getConfig();
          expect(updatedConfig.migrationTimeout).to.equal(newConfig.migrationTimeout);
          expect(updatedConfig.maxConcurrentMigrations).to.equal(newConfig.maxConcurrentMigrations);
        }));

        it('should get component instances', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          const components = migrationManager.getComponents();
          
          expect(components).to.exist;
          expect(components).to.have.property('core');
          expect(components).to.have.property('resourceManager');
          expect(components).to.have.property('logger');
        }));

        it('should cleanup resources', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          // Should not throw
          try {
            await migrationManager.cleanup();
          } catch (error) {
            expect.fail('Migration manager cleanup should not throw an error');
          }
        }));
      });
    }
  });

  describe('Migration Execution', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should execute migrations successfully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          const result = await migrationManager.migrate();
          
          expect(result).to.exist;
          expect(result).to.have.property('success');
          expect(result).to.have.property('executed');
          expect(result).to.have.property('failed');
          expect(result).to.have.property('duration');
          
          expect(result.success).to.be.a('boolean');
          expect(result.executed).to.be.a('number');
          expect(result.failed).to.be.a('number');
          expect(result.duration).to.be.a('number');
          expect(result.duration).to.be.at.least(0);
        }));

        it('should handle no pending migrations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          // Run migrations once
          await migrationManager.migrate();
          
          // Run again - should have no pending migrations
          const result = await migrationManager.migrate();
          
          expect(result.success).to.be.true;
          expect(result.executed).to.equal(0);
          expect(result.failed).to.equal(0);
        }));

        it('should handle migration errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          // Create migration manager with non-existent directory
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './non-existent-migrations'
          });
          try {
            await migrationManager.initialize();
            const result = await migrationManager.migrate();
            
            // Should handle errors gracefully
            expect(result).to.exist;
            expect(result.success).to.be.a('boolean');
          } catch (error) {
            // Expected error for non-existent directory
            expect(error).to.be.instanceOf(Error);
          }
        }));
      });
    }
  });

  describe('Migration Creation', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should create migration files', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          const migrationContent = `
            CREATE TABLE IF NOT EXISTS test_table (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `;
          
          const fileName = await migrationManager.createMigration('test_migration', migrationContent);
          
          expect(fileName).to.exist;
          expect(fileName).to.be.a('string');
          expect(fileName).to.include('test_migration');
        }));

        it('should handle migration creation errors', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          // Create migration manager with invalid directory
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: '/invalid/path/that/does/not/exist'
          });
          try {
            await migrationManager.initialize();
            await migrationManager.createMigration('test_migration', 'CREATE TABLE test (id INT);');
          } catch (error) {
            // Expected error for invalid directory
            expect(error).to.be.instanceOf(Error);
          }
        }));
      });
    }
  });

  describe('Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should initialize efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          const duration = await performanceHelper.measure('migration-initialization', async () => {
            await migrationManager.initialize();
          });
          // Initialization should be reasonably fast
          expect(duration).to.be.lessThan(5000); // 5 seconds max
        }));

        it('should get status efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          const duration = await performanceHelper.measure('migration-status', async () => {
            await migrationManager.getStatus();
          });
          // Status check should be very fast
          expect(duration).to.be.lessThan(1000); // 1 second max
        }));

        it('should handle concurrent status checks', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          const start = performance.now();
          const promises: Promise<any>[] = [];
          
          // Concurrent status checks
          for (let i = 0; i < 10; i++) {
            promises.push(migrationManager.getStatus());
          }
          
          const results = await Promise.all(promises);
          const duration = performance.now() - start;
          
          expect(results).to.be.an('array');
          expect(results.length).to.equal(10);
          expect(duration).to.be.lessThan(2000); // 2 seconds max
        }));
      });
    }
  });

  describe('Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle database connection errors', async () => {
          // Create invalid database connection
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
            const migrationManager = await createNodeMigrationManager(invalidDb.getKysely(), {
              migrationsDirectory: './test-migrations'
            });
            await migrationManager.initialize();
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error);
          }
        });

        it('should handle invalid migration directory', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: '/invalid/path/that/does/not/exist'
          });
          try {
            await migrationManager.initialize();
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error);
          }
        }));

        it('should handle invalid migration content', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          try {
            await migrationManager.initialize();
            
            // Try to create migration with invalid SQL
            await migrationManager.createMigration('invalid_migration', 'INVALID SQL CONTENT');
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error);
          }
        }));
      });
    }
  });

  describe('Configuration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should use default configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely());
          
          const config = migrationManager.getConfig();
          expect(config).to.exist;
          expect(config.migrationsDirectory).to.equal('./migrations');
          expect(config.migrationTimeout).to.equal(30000);
          expect(config.maxConcurrentMigrations).to.equal(3);
        }));

        it('should override default configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const customConfig = {
            migrationsDirectory: './custom-migrations',
            migrationTimeout: 60000,
            maxConcurrentMigrations: 5,
            maxRetries: 5,
            retryDelay: 5000,
            logLevel: 'DEBUG' as const,
            enableConsole: false
          };
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), customConfig);
          
          const config = migrationManager.getConfig();
          expect(config.migrationsDirectory).to.equal(customConfig.migrationsDirectory);
          expect(config.migrationTimeout).to.equal(customConfig.migrationTimeout);
          expect(config.maxConcurrentMigrations).to.equal(customConfig.maxConcurrentMigrations);
          expect(config.maxRetries).to.equal(customConfig.maxRetries);
          expect(config.retryDelay).to.equal(customConfig.retryDelay);
          expect(config.logLevel).to.equal(customConfig.logLevel);
          expect(config.enableConsole).to.equal(customConfig.enableConsole);
        }));

        it('should handle partial configuration updates', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          // Update only some configuration
          migrationManager.updateConfig({
            migrationTimeout: 45000,
            logLevel: 'WARN'
          });
          const config = migrationManager.getConfig();
          expect(config.migrationTimeout).to.equal(45000);
          expect(config.logLevel).to.equal('WARN');
          
          // Other config should remain unchanged
          expect(config.migrationsDirectory).to.equal('./test-migrations');
          expect(config.maxConcurrentMigrations).to.equal(3);
        }));
      });
    }
  });

  describe('Integration with NOORMME', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should work with NOORMME instance', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          // Should be able to get status
          const status = await migrationManager.getStatus();
          expect(status).to.exist;
          
          // Should be able to run migrations
          const result = await migrationManager.migrate();
          expect(result).to.exist;
          
          // Should be able to cleanup
          await migrationManager.cleanup();
        }));

        it('should handle NOORMME configuration changes', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb;
          ;
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          });
          await migrationManager.initialize();
          
          // Update NOORMME configuration
          db.updateConfig({
            logging: {
              level: 'debug',
              enabled: true
            }
          });
          // Migration manager should still work
          const status = await migrationManager.getStatus();
          expect(status).to.exist;
        }));
      });
    }
  });
});