import { describe, it, expect, beforeEach } from '@jest/globals'
import { DiscoveryFactory } from '../core/factories/discovery-factory.js'
import { SQLiteDiscoveryCoordinator } from '../dialects/sqlite/sqlite-discovery.coordinator.js'
import { SQLiteIndexDiscovery } from '../dialects/sqlite/discovery/sqlite-index-discovery.js'
import { SQLiteConstraintDiscovery } from '../dialects/sqlite/discovery/sqlite-constraint-discovery.js'
import { TableMetadataDiscovery } from '../core/discovery/table-metadata-discovery.js'
import { RelationshipDiscovery } from '../core/discovery/relationship-discovery.js'
import { ViewDiscovery } from '../core/discovery/view-discovery.js'

describe('DiscoveryFactory', () => {
  let factory: DiscoveryFactory

  beforeEach(() => {
    // Reset singleton instance for each test
    ;(DiscoveryFactory as any).instance = undefined
    factory = DiscoveryFactory.getInstance()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DiscoveryFactory.getInstance()
      const instance2 = DiscoveryFactory.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should maintain state across multiple calls', () => {
      const instance1 = DiscoveryFactory.getInstance()
      const instance2 = DiscoveryFactory.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Discovery Service Creation', () => {
    describe('createTableDiscovery', () => {
      it('should create TableMetadataDiscovery instance', () => {
        const discovery = factory.createTableDiscovery()
        expect(discovery).toBeInstanceOf(TableMetadataDiscovery)
      })

      it('should return singleton instance', () => {
        const discovery1 = factory.createTableDiscovery()
        const discovery2 = factory.createTableDiscovery()
        expect(discovery1).toBe(discovery2)
      })
    })

    describe('createRelationshipDiscovery', () => {
      it('should create RelationshipDiscovery instance', () => {
        const discovery = factory.createRelationshipDiscovery()
        expect(discovery).toBeInstanceOf(RelationshipDiscovery)
      })

      it('should return singleton instance', () => {
        const discovery1 = factory.createRelationshipDiscovery()
        const discovery2 = factory.createRelationshipDiscovery()
        expect(discovery1).toBe(discovery2)
      })
    })

    describe('createViewDiscovery', () => {
      it('should create ViewDiscovery instance', () => {
        const discovery = factory.createViewDiscovery()
        expect(discovery).toBeInstanceOf(ViewDiscovery)
      })

      it('should return singleton instance', () => {
        const discovery1 = factory.createViewDiscovery()
        const discovery2 = factory.createViewDiscovery()
        expect(discovery1).toBe(discovery2)
      })
    })

    describe('createIndexDiscovery', () => {
      it('should create SQLiteIndexDiscovery for sqlite dialect', () => {
        const discovery = factory.createIndexDiscovery('sqlite')
        expect(discovery).toBeInstanceOf(SQLiteIndexDiscovery)
      })

      it('should handle case insensitive dialect names', () => {
        const discovery = factory.createIndexDiscovery('SQLITE')
        expect(discovery).toBeInstanceOf(SQLiteIndexDiscovery)
      })

      it('should throw error for unsupported dialects', () => {
        expect(() => factory.createIndexDiscovery('unsupported')).toThrow('Unsupported dialect for index discovery: unsupported')
      })
    })

    describe('createConstraintDiscovery', () => {
      it('should create SQLiteConstraintDiscovery for sqlite dialect', () => {
        const discovery = factory.createConstraintDiscovery('sqlite')
        expect(discovery).toBeInstanceOf(SQLiteConstraintDiscovery)
      })

      it('should handle case insensitive dialect names', () => {
        const discovery = factory.createConstraintDiscovery('SQLITE')
        expect(discovery).toBeInstanceOf(SQLiteConstraintDiscovery)
      })

      it('should throw error for unsupported dialects', () => {
        expect(() => factory.createConstraintDiscovery('unsupported')).toThrow('Unsupported dialect for constraint discovery: unsupported')
      })
    })

    describe('createDiscoveryCoordinator', () => {
      it('should create SQLiteDiscoveryCoordinator for sqlite dialect', () => {
        const coordinator = factory.createDiscoveryCoordinator('sqlite')
        expect(coordinator).toBeInstanceOf(SQLiteDiscoveryCoordinator)
      })

      it('should handle case insensitive dialect names', () => {
        const coordinator = factory.createDiscoveryCoordinator('SQLITE')
        expect(coordinator).toBeInstanceOf(SQLiteDiscoveryCoordinator)
      })

      it('should throw error for unsupported dialects', () => {
        expect(() => factory.createDiscoveryCoordinator('unsupported')).toThrow('Unsupported dialect for discovery coordinator: unsupported')
      })
    })

    describe('createDiscoveryServices', () => {
      it('should create all discovery services for sqlite', () => {
        const services = factory.createDiscoveryServices('sqlite')
        
        expect(services.tableDiscovery).toBeInstanceOf(TableMetadataDiscovery)
        expect(services.relationshipDiscovery).toBeInstanceOf(RelationshipDiscovery)
        expect(services.viewDiscovery).toBeInstanceOf(ViewDiscovery)
        expect(services.indexDiscovery).toBeInstanceOf(SQLiteIndexDiscovery)
        expect(services.constraintDiscovery).toBeInstanceOf(SQLiteConstraintDiscovery)
      })

      it('should throw error for unsupported dialects', () => {
        expect(() => factory.createDiscoveryServices('unsupported')).toThrow('Unsupported dialect for index discovery: unsupported')
      })
    })
  })

  describe('Dialect Support', () => {
    it('should return supported dialects', () => {
      const dialects = factory.getSupportedDialects()
      expect(dialects).toEqual(['sqlite', 'postgres', 'postgresql'])
    })

    it('should check if dialect is supported', () => {
      expect(factory.isDialectSupported('sqlite')).toBe(true)
      expect(factory.isDialectSupported('SQLITE')).toBe(true)
      expect(factory.isDialectSupported('unsupported')).toBe(false)
    })

    it('should get dialect capabilities', () => {
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
  })
})