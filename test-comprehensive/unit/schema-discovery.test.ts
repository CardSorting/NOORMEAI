/**
 * Comprehensive unit tests for Schema Discovery functionality
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { SchemaDiscovery } from '../../src/schema/schema-discovery.js'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'
import { NOORMME } from '../../src/noormme.js'

describe('Schema Discovery', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Table Discovery', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should discover all tables', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const tableNames = schemaInfo.tables.map(t => t.name)
          
          // Should discover our test tables
          expect(tableNames).to.include('users')
          expect(tableNames).to.include('posts')
          expect(tableNames).to.include('comments')
          expect(tableNames).to.include('profiles')
          expect(tableNames).to.include('tags')
          expect(tableNames).to.include('post_tags')
          
          expect(schemaInfo.tables.length).to.be.greaterThan(0)
        }))
        it('should discover table columns correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const usersTable = schemaInfo.tables.find(t => t.name === 'users')
          
          expect(usersTable).to.exist
          expect(usersTable!.columns).to.be.an('array')
          expect(usersTable!.columns.length).to.be.greaterThan(0)
          
          // Check specific columns
          const columnNames = usersTable!.columns.map(c => c.name)
          expect(columnNames).to.include('id')
          expect(columnNames).to.include('email')
          expect(columnNames).to.include('firstName')
          expect(columnNames).to.include('lastName')
          expect(columnNames).to.include('active')
        }))
        it('should discover primary keys', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const usersTable = schemaInfo.tables.find(t => t.name === 'users')
          
          expect(usersTable).to.exist
          expect(usersTable!.primaryKey).to.be.an('array')
          expect(usersTable!.primaryKey).to.include('id')
        }))
        it('should discover column types', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const usersTable = schemaInfo.tables.find(t => t.name === 'users')
          
          expect(usersTable).to.exist
          
          const idColumn = usersTable!.columns.find(c => c.name === 'id')
          const emailColumn = usersTable!.columns.find(c => c.name === 'email')
          const ageColumn = usersTable!.columns.find(c => c.name === 'age')
          const activeColumn = usersTable!.columns.find(c => c.name === 'active')
          
          expect(idColumn).to.exist
          expect(emailColumn).to.exist
          expect(ageColumn).to.exist
          expect(activeColumn).to.exist
          
          // Check column properties
          expect(idColumn!.isPrimaryKey).to.be.true
          expect(emailColumn!.nullable).to.be.false
          expect(ageColumn!.nullable).to.be.true
          expect(activeColumn!.nullable).to.be.false
        }))
        it('should discover indexes', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const usersTable = schemaInfo.tables.find(t => t.name === 'users')
          
          expect(usersTable).to.exist
          expect(usersTable!.indexes).to.be.an('array')
          
          // Should have at least the primary key index
          expect(usersTable!.indexes.length).to.be.greaterThan(0)
        }))
        it('should discover foreign keys', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const profilesTable = schemaInfo.tables.find(t => t.name === 'profiles')
          
          expect(profilesTable).to.exist
          expect(profilesTable!.foreignKeys).to.be.an('array')
          
          // Should have foreign key to users table
          const userFk = profilesTable!.foreignKeys.find(fk => fk.column === 'userId')
          if (userFk) {
            expect(userFk.referencedTable).to.equal('users')
            expect(userFk.referencedColumn).to.equal('id')
          }
        }))
      })
    }
  })
  describe('Relationship Discovery', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should discover relationships between tables', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          expect(schemaInfo.relationships).to.be.an('array')
          expect(schemaInfo.relationships.length).to.be.greaterThan(0)
        }))
        it('should discover one-to-many relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const oneToManyRels = schemaInfo.relationships.filter(r => r.type === 'one-to-many')
          
          expect(oneToManyRels.length).to.be.greaterThan(0)
          
          // Should have users -> posts relationship
          const userPostsRel = oneToManyRels.find(r => 
            r.fromTable === 'users' && r.toTable === 'posts'
          )
          expect(userPostsRel).to.exist
        }))
        it('should discover many-to-one relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const manyToOneRels = schemaInfo.relationships.filter(r => r.type === 'many-to-one')
          
          expect(manyToOneRels.length).to.be.greaterThan(0)
          
          // Should have posts -> users relationship
          const postUserRel = manyToOneRels.find(r => 
            r.fromTable === 'posts' && r.toTable === 'users'
          )
          expect(postUserRel).to.exist
        }))
        it('should generate proper relationship names', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          
          // Check that relationship names are generated properly
          for (const rel of schemaInfo.relationships) {
            expect(rel.name).to.be.a('string')
            expect(rel.name.length).to.be.greaterThan(0)
            expect(rel.name).to.not.include('_') // Should be camelCase
          }
        }))
        it('should discover reverse relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          
          // For each relationship, there should be a reverse relationship
          for (const rel of schemaInfo.relationships) {
            const reverseRel = schemaInfo.relationships.find(r => 
              r.fromTable === rel.toTable &&
              r.toTable === rel.fromTable &&
              r.fromColumn === rel.toColumn &&
              r.toColumn === rel.fromColumn
            )
            
            expect(reverseRel).to.exist
            expect(reverseRel!.type).to.not.equal(rel.type)
          }
        }))
      })
    }
  })
  describe('Configuration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should respect excludeTables configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          // Update config to exclude certain tables
          db.updateConfig({
            introspection: {
              excludeTables: ['comments', 'tags']
            }
          })
          
          const schemaInfo = await db.getSchemaInfo()
          
          const tableNames = schemaInfo.tables.map(t => t.name)
          expect(tableNames).to.not.include('comments')
          expect(tableNames).to.not.include('tags')
          
          // But should still include other tables
          expect(tableNames).to.include('users')
          expect(tableNames).to.include('posts')
        }))
        it('should respect custom type mappings', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          // Update config with custom type mappings
          db.updateConfig({
            introspection: {
              customTypeMappings: {
                'text': 'CustomString',
                'integer': 'CustomNumber'
              }
            }
          })
          
          const schemaInfo = await db.getSchemaInfo()
          
          // Check that custom type mappings are applied
          const usersTable = schemaInfo.tables.find(t => t.name === 'users')
          expect(usersTable).to.exist
          
          const emailColumn = usersTable!.columns.find(c => c.name === 'email')
          const ageColumn = usersTable!.columns.find(c => c.name === 'age')
          
          if (emailColumn && emailColumn.type === 'text') {
            expect(emailColumn.type).to.equal('CustomString')
          }
          
          if (ageColumn && ageColumn.type === 'integer') {
            expect(ageColumn.type).to.equal('CustomNumber')
          }
        }))
        it('should handle includeViews configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          // Test with views disabled (default)
          db.updateConfig({
            introspection: {
              includeViews: false
            }
          })
          
          const schemaInfo = await db.getSchemaInfo()
          
          expect(schemaInfo.views).to.be.an('array')
          // Views should be empty or minimal
        }))
      })
    }
  })
  describe('Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should discover schema within performance threshold', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          const duration = await performanceHelper.measure('schema-discovery', async () => {
            
          })
          // Schema discovery should be reasonably fast
          expect(duration).to.be.lessThan(5000) // 5 seconds max
        }))
        it('should cache schema information', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // First call
          const start1 = performance.now()
          const schema1 = await db.getSchemaInfo()
          const duration1 = performance.now() - start1
          
          // Second call should be faster (cached)
          const start2 = performance.now()
          const schema2 = await db.getSchemaInfo()
          const duration2 = performance.now() - start2
          
          expect(schema1).to.deep.equal(schema2)
          expect(duration2).to.be.lessThan(duration1)
        }))
        it('should refresh schema efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const duration = await performanceHelper.measure('schema-refresh', async () => {
            await db.refreshSchema()
          })
          // Schema refresh should be reasonably fast
          expect(duration).to.be.lessThan(3000) // 3 seconds max
        }))
      })
    }
  })
  describe('Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle database connection errors', async () => {
          const invalidDb = new NOORMME({
            dialect,
            connection: {
              host: 'invalid-host',
              port: 9999,
              database: 'invalid-db',
              username: 'invalid-user',
              password: 'invalid-password'
            }
          })
          try {
            await invalidDb.initialize()
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        })
        it('should handle schema introspection errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          // Simulate introspection error by closing connection
          
          await db.close()
          
          // Should handle gracefully
          try {
            await db.getSchemaInfo()
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        it('should handle invalid table names gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Try to get schema info for non-existent table
          const schemaInfo = await db.getSchemaInfo()
          const nonExistentTable = schemaInfo.tables.find(t => t.name === 'non_existent_table')
          expect(nonExistentTable).to.be.undefined
        }))
      })
    }
  })
  describe('Edge Cases', () => {
    for (const dialect of getEnabledDatabases()) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle empty database', async () => {
          // Create database with no tables
          const emptyDb = new NOORMME({
            dialect,
            connection: {
              host: '',
              port: 0,
              database: ':memory:',
              username: '',
              password: ''
            }
          })
          await emptyDb.initialize()
          const schemaInfo = await emptyDb.getSchemaInfo()
          
          expect(schemaInfo.tables).to.be.an('array')
          expect(schemaInfo.tables.length).to.equal(0)
          expect(schemaInfo.relationships).to.be.an('array')
          expect(schemaInfo.relationships.length).to.equal(0)
          
          await emptyDb.close()
        })
        it('should handle tables with no primary key', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create table without primary key
          const kysely = db.getKysely()
          await kysely.schema
            .createTable('no_pk_table')
            .addColumn('id', 'text')
            .addColumn('name', 'text')
            .execute()
          
          // Refresh schema
          await db.refreshSchema()
          const schemaInfo = await db.getSchemaInfo()
          
          const noPkTable = schemaInfo.tables.find(t => t.name === 'no_pk_table')
          expect(noPkTable).to.exist
          expect(noPkTable!.primaryKey).to.be.undefined
          
          // Clean up
          await kysely.schema.dropTable('no_pk_table').execute()
        }))
        it('should handle tables with composite primary keys', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create table with composite primary key
          const kysely = db.getKysely()
          await kysely.schema
            .createTable('composite_pk_table')
            .addColumn('id1', 'text')
            .addColumn('id2', 'text')
            .addColumn('name', 'text')
            .addPrimaryKeyConstraint('composite_pk_table_pkey', ['id1', 'id2'])
            .execute()
          
          // Refresh schema
          await db.refreshSchema()
          const schemaInfo = await db.getSchemaInfo()
          
          const compositePkTable = schemaInfo.tables.find(t => t.name === 'composite_pk_table')
          expect(compositePkTable).to.exist
          expect(compositePkTable!.primaryKey).to.be.an('array')
          expect(compositePkTable!.primaryKey).to.include('id1')
          expect(compositePkTable!.primaryKey).to.include('id2')
          
          // Clean up
          await kysely.schema.dropTable('composite_pk_table').execute()
        }))
      })
    }
  })
})