import { describe, it, expect, beforeEach } from '@jest/globals'
import { DiscoveryFactory } from '../core/factories/discovery-factory.js'
import { SQLiteDiscoveryCoordinator } from '../dialects/sqlite/sqlite-discovery.coordinator.js'

describe('Dialect Capabilities', () => {
  let factory: DiscoveryFactory
  let sqliteCoordinator: SQLiteDiscoveryCoordinator

  beforeEach(() => {
    // Reset singleton instances
    ;(DiscoveryFactory as any).instance = undefined
    ;(SQLiteDiscoveryCoordinator as any).instance = undefined

    factory = DiscoveryFactory.getInstance()
    sqliteCoordinator = SQLiteDiscoveryCoordinator.getInstance()
  })

  describe('Factory Capability Detection', () => {
    describe('SQLite Capabilities', () => {
      it('should return correct capabilities for sqlite', () => {
        const capabilities = factory.getDialectCapabilities('sqlite')
        
        expect(capabilities).toEqual({
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: true,
          supportsCheckConstraints: true,
          supportsDeferredConstraints: false
        })
      })

      it('should handle case insensitive dialect names', () => {
        const capabilities = factory.getDialectCapabilities('SQLITE')
        
        expect(capabilities).toEqual({
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: true,
          supportsCheckConstraints: true,
          supportsDeferredConstraints: false
        })
      })
    })

    it('should return false capabilities for unsupported dialects', () => {
      const capabilities = factory.getDialectCapabilities('unsupported')
      
      expect(capabilities).toEqual({
        supportsViews: false,
        supportsIndexes: false,
        supportsConstraints: false,
        supportsForeignKeys: false,
        supportsCheckConstraints: false,
        supportsDeferredConstraints: false
      })
    })

    it('should handle dialect name with whitespace', () => {
      const capabilities = factory.getDialectCapabilities(' sqlite ')
      
      expect(capabilities).toEqual({
        supportsViews: true,
        supportsIndexes: true,
        supportsConstraints: true,
        supportsForeignKeys: true,
        supportsCheckConstraints: true,
        supportsDeferredConstraints: false
      })
    })

    it('should handle mixed case dialect names', () => {
      const capabilities = factory.getDialectCapabilities('Sqlite')
      
      expect(capabilities).toEqual({
        supportsViews: true,
        supportsIndexes: true,
        supportsConstraints: true,
        supportsForeignKeys: true,
        supportsCheckConstraints: true,
        supportsDeferredConstraints: false
      })
    })
  })

  describe('Coordinator-Specific Capabilities', () => {
    describe('SQLite Coordinator Capabilities', () => {
      it('should return extended SQLite capabilities', () => {
        const capabilities = sqliteCoordinator.getCapabilities()
        
        expect(capabilities).toEqual({
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: true,
          supportsCheckConstraints: true,
          supportsDeferredConstraints: false,
          supportsPartialIndexes: true,
          supportsExpressionIndexes: true,
          supportsConcurrentIndexCreation: false,
          supportsMaterializedViews: false,
          supportsCustomTypes: false,
          supportsExtensions: false,
          supportsPRAGMA: true,
          supportsAutoIncrement: true,
          supportsRowId: true,
          supportsTriggers: true,
          supportsFullTextSearch: true
        })
      })

      it('should support all SQLite features', () => {
        const capabilities = sqliteCoordinator.getCapabilities()
        
        expect(capabilities.supportsPartialIndexes).toBe(true)
        expect(capabilities.supportsExpressionIndexes).toBe(true)
        expect(capabilities.supportsMaterializedViews).toBe(false)
      })
    })
  })

  describe('Capability Consistency', () => {
    it('should have consistent capabilities between factory and coordinator for SQLite', () => {
      const factoryCapabilities = factory.getDialectCapabilities('sqlite')
      const coordinatorCapabilities = sqliteCoordinator.getCapabilities()
      
      // Basic capabilities should match
      expect(factoryCapabilities.supportsViews).toBe(coordinatorCapabilities.supportsViews)
      expect(factoryCapabilities.supportsIndexes).toBe(coordinatorCapabilities.supportsIndexes)
      expect(factoryCapabilities.supportsConstraints).toBe(coordinatorCapabilities.supportsConstraints)
      expect(factoryCapabilities.supportsForeignKeys).toBe(coordinatorCapabilities.supportsForeignKeys)
      expect(factoryCapabilities.supportsCheckConstraints).toBe(coordinatorCapabilities.supportsCheckConstraints)
      expect(factoryCapabilities.supportsDeferredConstraints).toBe(coordinatorCapabilities.supportsDeferredConstraints)
    })
  })

  describe('Feature Support Validation', () => {
    it('should correctly identify SQLite as supporting basic features', () => {
      const capabilities = sqliteCoordinator.getCapabilities()
      
      expect(capabilities.supportsViews).toBe(true)
      expect(capabilities.supportsIndexes).toBe(true)
      expect(capabilities.supportsConstraints).toBe(true)
      expect(capabilities.supportsForeignKeys).toBe(true)
      expect(capabilities.supportsCheckConstraints).toBe(true)
    })

    it('should correctly identify SQLite limitations', () => {
      const capabilities = sqliteCoordinator.getCapabilities()
      
      expect(capabilities.supportsDeferredConstraints).toBe(false)
      expect(capabilities.supportsMaterializedViews).toBe(false)
    })
  })

  describe('Capability Usage Examples', () => {
    it('should demonstrate how to check for specific features', () => {
      const sqliteCapabilities = sqliteCoordinator.getCapabilities()
      
      // Example usage patterns
      if (sqliteCapabilities.supportsViews) {
        expect(sqliteCapabilities.supportsViews).toBe(true)
      }
      
      if (sqliteCapabilities.supportsPartialIndexes) {
        expect(sqliteCapabilities.supportsPartialIndexes).toBe(true)
      }
    })

    it('should demonstrate conditional feature usage', () => {
      const capabilities = factory.getDialectCapabilities('sqlite')
      
      // Simulate conditional logic based on capabilities
      if (capabilities.supportsViews) {
        expect(capabilities.supportsViews).toBe(true)
      }
      
      if (capabilities.supportsDeferredConstraints) {
        // This should not execute for SQLite
        expect(false).toBe(true)
      }
    })
  })
})