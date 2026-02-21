/**
 * Comprehensive unit tests for Type Generation functionality
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { TypeGenerator } from '../../src/types/type-generator.js'
import { withTestDatabase } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

describe('Type Generation', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Entity Type Generation', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should generate entity types for all tables', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          expect(generatedTypes).to.have.property('entities')
          expect(generatedTypes).to.have.property('interfaces')
          expect(generatedTypes).to.have.property('types')
          
          expect(generatedTypes.entities).to.be.an('array')
          expect(generatedTypes.entities.length).to.be.greaterThan(0)
          
          // Should generate types for our test tables
          const entityNames = generatedTypes.entities.map(e => e.name)
          expect(entityNames).to.include('Users')
          expect(entityNames).to.include('Posts')
          expect(entityNames).to.include('Comments')
        }))
        
        it('should generate correct entity interfaces', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const usersEntity = generatedTypes.entities.find(e => e.name === 'Users')
          expect(usersEntity).to.exist
          
          const interfaceCode = usersEntity!.interface
          expect(interfaceCode).to.include('export interface Users')
          expect(interfaceCode).to.include('id:')
          expect(interfaceCode).to.include('email:')
          expect(interfaceCode).to.include('firstName:')
          expect(interfaceCode).to.include('lastName:')
          expect(interfaceCode).to.include('active:')
        }))
        
        it('should generate insert types correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const usersEntity = generatedTypes.entities.find(e => e.name === 'Users')
          expect(usersEntity).to.exist
          
          const insertType = usersEntity!.insertType
          expect(insertType).to.include('export type UsersInsert')
          expect(insertType).to.include('email:')
          expect(insertType).to.include('firstName:')
          expect(insertType).to.include('lastName:')
          
          // Should not include auto-generated fields
          expect(insertType).to.not.include('id:') // Assuming id is auto-generated
        }))
        
        it('should generate update types correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const usersEntity = generatedTypes.entities.find(e => e.name === 'Users')
          expect(usersEntity).to.exist
          
          const updateType = usersEntity!.updateType
          expect(updateType).to.include('export type UsersUpdate')
          expect(updateType).to.include('id:') // Primary key should be required
          expect(updateType).to.include('email?:') // Other fields should be optional
          expect(updateType).to.include('firstName?:')
          expect(updateType).to.include('lastName?:')
        }))
        
        it('should generate select types correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const usersEntity = generatedTypes.entities.find(e => e.name === 'Users')
          expect(usersEntity).to.exist
          
          const selectType = usersEntity!.selectType
          expect(selectType).to.include('export type UsersSelect')
          expect(selectType).to.include('id:')
          expect(selectType).to.include('email:')
          expect(selectType).to.include('firstName:')
          expect(selectType).to.include('lastName:')
          expect(selectType).to.include('active:')
        }))
        
        it('should handle nullable columns correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const usersEntity = generatedTypes.entities.find(e => e.name === 'Users')
          expect(usersEntity).to.exist
          
          const interfaceCode = usersEntity!.interface
          
          // Required fields should not have ?
          expect(interfaceCode).to.include('id:')
          expect(interfaceCode).to.include('email:')
          expect(interfaceCode).to.include('firstName:')
          expect(interfaceCode).to.include('lastName:')
          
          // Optional fields should have ?
          expect(interfaceCode).to.include('age?:')
        }))
        
        it('should handle different column types correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const usersEntity = generatedTypes.entities.find(e => e.name === 'Users')
          expect(usersEntity).to.exist
          
          const interfaceCode = usersEntity!.interface
          
          // Check type mappings
          expect(interfaceCode).to.include('email: string')
          expect(interfaceCode).to.include('firstName: string')
          expect(interfaceCode).to.include('lastName: string')
          expect(interfaceCode).to.include('active: boolean')
          expect(interfaceCode).to.include('age?: number')
        }))
      })
    }
  })
  
  describe('Relationship Type Generation', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should generate relationship types', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          expect(generatedTypes.interfaces).to.include('// Relationship types')
          
          // Should generate relationship types for users
          expect(generatedTypes.interfaces).to.include('UsersPosts')
          expect(generatedTypes.interfaces).to.include('UsersProfiles')
          
          // Should generate relationship types for posts
          expect(generatedTypes.interfaces).to.include('PostsUsers')
          expect(generatedTypes.interfaces).to.include('PostsComments')
        }))
        
        it('should generate correct relationship type structures', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const interfaceCode = generatedTypes.interfaces
          
          // One-to-many relationships should be arrays
          expect(interfaceCode).to.include('Posts[]')
          expect(interfaceCode).to.include('Comments[]')
          
          // Many-to-one relationships should be single objects
          expect(interfaceCode).to.include(': Users')
          expect(interfaceCode).to.include(': Profiles')
        }))
        
        it('should handle many-to-many relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const interfaceCode = generatedTypes.interfaces
          
          // Many-to-many relationships should be arrays
          expect(interfaceCode).to.include('Tags[]')
        }))
      })
    }
  })
  
  describe('Type Mapping', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should map common database types correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const interfaceCode = generatedTypes.interfaces
          
          // String types
          expect(interfaceCode).to.include(': string')
          
          // Number types
          expect(interfaceCode).to.include(': number')
          
          // Boolean types
          expect(interfaceCode).to.include(': boolean')
          
          // Date types
          expect(interfaceCode).to.include(': Date')
        }))
        
        it('should handle custom type mappings', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator({
            customTypeMappings: {
              'text': 'CustomString',
              'integer': 'CustomNumber',
              'boolean': 'CustomBoolean'
            }
          })
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          const interfaceCode = generatedTypes.interfaces
          
          // Should use custom mappings
          expect(interfaceCode).to.include(': CustomString')
          expect(interfaceCode).to.include(': CustomNumber')
          expect(interfaceCode).to.include(': CustomBoolean')
        }))
        
        it('should handle parameterized types', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const interfaceCode = generatedTypes.interfaces
          
          // Should handle types like varchar(255), decimal(10,2)
          // The exact mapping depends on the database dialect
          expect(interfaceCode).to.include(': string') // varchar should map to string
          expect(interfaceCode).to.include(': number') // decimal should map to number
        }))
        
        it('should default unknown types to any', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          
          const interfaceCode = generatedTypes.interfaces
          
          // Should not have any 'any' types for our known test schema
          // This test ensures we're not falling back to 'any' unnecessarily
          expect(interfaceCode).to.not.include(': any')
        }))
      })
    }
  })
  
  describe('Configuration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should respect custom type mappings configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator({
            customTypeMappings: {
              'text': 'MyCustomString',
              'integer': 'MyCustomNumber'
            }
          })
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          const interfaceCode = generatedTypes.interfaces
          
          expect(interfaceCode).to.include(': MyCustomString')
          expect(interfaceCode).to.include(': MyCustomNumber')
        }))
        
        it('should handle empty custom type mappings', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator({
            customTypeMappings: {}
          })
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          expect(generatedTypes).to.exist
          expect(generatedTypes.entities).to.be.an('array')
          expect(generatedTypes.entities.length).to.be.greaterThan(0)
        }))
        
        it('should handle undefined custom type mappings', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          expect(generatedTypes).to.exist
          expect(generatedTypes.entities).to.be.an('array')
          expect(generatedTypes.entities.length).to.be.greaterThan(0)
        }))
      })
    }
  })
  
  describe('Edge Cases', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle empty schema', async () => {
          const typeGenerator = new TypeGenerator()
          const emptySchema = {
            tables: [],
            relationships: [],
            views: []
          }
          
          const generatedTypes = typeGenerator.generateTypes(emptySchema)
          
          expect(generatedTypes).to.exist
          expect(generatedTypes.entities).to.be.an('array')
          expect(generatedTypes.entities.length).to.equal(0)
          expect(generatedTypes.interfaces).to.be.a('string')
          expect(generatedTypes.types).to.be.a('string')
        })
        
        it('should handle schema with no relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const schemaWithoutRelationships = {
            ...schemaInfo,
            relationships: []
          }
          
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(schemaWithoutRelationships)
          
          expect(generatedTypes).to.exist
          expect(generatedTypes.entities).to.be.an('array')
          expect(generatedTypes.entities.length).to.be.greaterThan(0)
          
          // Should still generate relationship types section
          expect(generatedTypes.interfaces).to.include('// Relationship types')
        }))
        
        it('should handle tables with no columns', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const tableWithNoColumns = {
            ...schemaInfo,
            tables: [
              {
                name: 'empty_table',
                schema: 'public',
                columns: [],
                primaryKey: undefined,
                indexes: [],
                foreignKeys: []
              }
            ]
          }
          
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(tableWithNoColumns)
          
          expect(generatedTypes).to.exist
          expect(generatedTypes.entities).to.be.an('array')
          expect(generatedTypes.entities.length).to.be.greaterThan(0)
          
          const emptyTableEntity = generatedTypes.entities.find(e => e.name === 'EmptyTable')
          expect(emptyTableEntity).to.exist
          expect(emptyTableEntity!.interface).to.include('export interface EmptyTable')
        }))
        
        it('should handle tables with special characters in names', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const tableWithSpecialChars = {
            ...schemaInfo,
            tables: [
              {
                name: 'user_profiles',
                schema: 'public',
                columns: [
                  {
                    name: 'user_id',
                    type: 'text',
                    nullable: false,
                    defaultValue: null,
                    isPrimaryKey: true,
                    isAutoIncrement: false,
                    maxLength: undefined,
                    precision: undefined,
                    scale: undefined
                  }
                ],
                primaryKey: ['user_id'],
                indexes: [],
                foreignKeys: []
              }
            ]
          }
          
          const typeGenerator = new TypeGenerator()
          const generatedTypes = typeGenerator.generateTypes(tableWithSpecialChars)
          
          expect(generatedTypes).to.exist
          expect(generatedTypes.entities).to.be.an('array')
          expect(generatedTypes.entities.length).to.be.greaterThan(0)
          
          const specialTableEntity = generatedTypes.entities.find(e => e.name === 'UserProfiles')
          expect(specialTableEntity).to.exist
          expect(specialTableEntity!.interface).to.include('export interface UserProfiles')
          expect(specialTableEntity!.interface).to.include('userId:')
        }))
      })
    }
  })
  
  describe('Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should generate types efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const typeGenerator = new TypeGenerator()
          
          const start = performance.now()
          const generatedTypes = typeGenerator.generateTypes(schemaInfo)
          const duration = performance.now() - start
          
          expect(generatedTypes).to.exist
          expect(duration).to.be.lessThan(1000) // Should complete within 1 second
        }))
        
        it('should handle large schemas efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          
          // Simulate large schema by duplicating tables
          const largeSchema = {
            ...schemaInfo,
            tables: [
              ...schemaInfo.tables,
              ...schemaInfo.tables.map(t => ({ ...t, name: t.name + '_copy' })),
              ...schemaInfo.tables.map(t => ({ ...t, name: t.name + '_copy2' }))
            ]
          }
          
          const typeGenerator = new TypeGenerator()
          
          const start = performance.now()
          const generatedTypes = typeGenerator.generateTypes(largeSchema)
          const duration = performance.now() - start
          
          expect(generatedTypes).to.exist
          expect(generatedTypes.entities.length).to.equal(largeSchema.tables.length)
          expect(duration).to.be.lessThan(2000) // Should complete within 2 seconds
        }))
      })
    }
  })
})