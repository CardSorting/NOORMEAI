import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { SchemaDiscoveryCoordinator } from '../core/coordinators/schema-discovery.coordinator.js'
import { DiscoveryFactory } from '../core/factories/discovery-factory.js'
import { SQLiteDiscoveryCoordinator } from '../dialects/sqlite/sqlite-discovery.coordinator.js'
import type { SchemaInfo } from '../../types/index.js'

// Mock Kysely and related dependencies
const mockKysely = {
  selectFrom: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue([])
}

// Mock discovery services
jest.mock('../core/discovery/table-metadata-discovery.js', () => ({
  TableMetadataDiscovery: {
    getInstance: jest.fn().mockReturnValue({
      discoverTables: jest.fn().mockResolvedValue([])
    })
  }
}))

jest.mock('../core/discovery/relationship-discovery.js', () => ({
  RelationshipDiscovery: {
    getInstance: jest.fn().mockReturnValue({
      discoverRelationships: jest.fn().mockResolvedValue([])
    })
  }
}))

jest.mock('../core/discovery/view-discovery.js', () => ({
  ViewDiscovery: {
    getInstance: jest.fn().mockReturnValue({
      discoverViews: jest.fn().mockResolvedValue([])
    })
  }
}))

jest.mock('../dialects/sqlite/discovery/sqlite-index-discovery.js', () => ({
  SQLiteIndexDiscovery: {
    getInstance: jest.fn().mockReturnValue({
      discoverIndexes: jest.fn().mockResolvedValue([]),
      discoverTableIndexes: jest.fn().mockResolvedValue([]),
      getTableSize: jest.fn().mockResolvedValue({ pages: 0, size: 0, estimatedRows: 0 }),
      analyzeIndexEfficiency: jest.fn().mockReturnValue({ recommendations: [] })
    })
  }
}))

jest.mock('../dialects/sqlite/discovery/sqlite-constraint-discovery.js', () => ({
  SQLiteConstraintDiscovery: {
    getInstance: jest.fn().mockReturnValue({
      discoverConstraints: jest.fn().mockResolvedValue([]),
      isForeignKeySupportEnabled: jest.fn().mockResolvedValue(true),
      getForeignKeyInfo: jest.fn().mockResolvedValue([]),
      discoverTableConstraints: jest.fn().mockResolvedValue([]),
      analyzeConstraintCompatibility: jest.fn().mockReturnValue({ recommendations: [], compatibilityIssues: [] })
    })
  }
}))

describe('Schema Strategy Integration Tests', () => {
  let coordinator: SchemaDiscoveryCoordinator
  let factory: DiscoveryFactory
  let sqliteCoordinator: SQLiteDiscoveryCoordinator

  beforeEach(() => {
    // Reset singleton instances
    ;(SchemaDiscoveryCoordinator as any).instance = undefined
    ;(DiscoveryFactory as any).instance = undefined
    ;(SQLiteDiscoveryCoordinator as any).instance = undefined

    coordinator = SchemaDiscoveryCoordinator.getInstance()
    factory = DiscoveryFactory.getInstance()
    sqliteCoordinator = SQLiteDiscoveryCoordinator.getInstance()

    // Reset mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('SQLite Integration', () => {
    it('should discover complete SQLite schema', async () => {
      const schemaInfo = await sqliteCoordinator.discoverSchema(mockKysely as any, {})
      
      expect(schemaInfo).toBeDefined()
      expect(typeof schemaInfo).toBe('object')
    })

    it('should handle SQLite-specific features', async () => {
      const capabilities = sqliteCoordinator.getCapabilities()
      
      expect(capabilities.supportsViews).toBe(true)
      expect(capabilities.supportsIndexes).toBe(true)
      expect(capabilities.supportsConstraints).toBe(true)
      expect(capabilities.supportsDeferredConstraints).toBe(false)
    })

    it('should create SQLite discovery services', () => {
      const services = factory.createDiscoveryServices('sqlite')
      
      expect(services).toBeDefined()
      expect(services.tableDiscovery).toBeDefined()
      expect(services.relationshipDiscovery).toBeDefined()
      expect(services.viewDiscovery).toBeDefined()
      expect(services.indexDiscovery).toBeDefined()
      expect(services.constraintDiscovery).toBeDefined()
    })
  })

  describe('Factory Integration', () => {
    it('should create correct services for SQLite', () => {
      const indexDiscovery = factory.createIndexDiscovery('sqlite')
      const constraintDiscovery = factory.createConstraintDiscovery('sqlite')
      const discoveryCoordinator = factory.createDiscoveryCoordinator('sqlite')
      
      expect(indexDiscovery).toBeDefined()
      expect(constraintDiscovery).toBeDefined()
      expect(discoveryCoordinator).toBeDefined()
    })

    it('should return correct capabilities for SQLite', () => {
      const capabilities = factory.getDialectCapabilities('sqlite')
      
      expect(capabilities.supportsViews).toBe(true)
      expect(capabilities.supportsIndexes).toBe(true)
      expect(capabilities.supportsConstraints).toBe(true)
      expect(capabilities.supportsForeignKeys).toBe(true)
      expect(capabilities.supportsCheckConstraints).toBe(true)
      expect(capabilities.supportsDeferredConstraints).toBe(false)
    })

    it('should identify SQLite as supported', () => {
      expect(factory.isDialectSupported('sqlite')).toBe(true)
      expect(factory.isDialectSupported('SQLITE')).toBe(true)
    })

    it('should identify unsupported dialects', () => {
      expect(factory.isDialectSupported('unsupported')).toBe(false)
      expect(factory.isDialectSupported('mysql')).toBe(false)
      expect(factory.isDialectSupported('postgresql')).toBe(true)
    })
  })

  describe('Coordinator Integration', () => {
    it('should coordinate schema discovery', async () => {
      const schemaInfo = await coordinator.discoverSchema(mockKysely as any, {}, 'sqlite' as any)
      
      expect(schemaInfo).toBeDefined()
      expect(typeof schemaInfo).toBe('object')
    })

    it('should handle discovery errors gracefully', async () => {
      // Import the mocked module to override its behavior for this test
      const { TableMetadataDiscovery } = await import('../core/discovery/table-metadata-discovery.js')
      const mockTableDiscovery = (TableMetadataDiscovery as any).getInstance()
      
      // Make the mock throw an error for this test
      mockTableDiscovery.discoverTables.mockRejectedValueOnce(new Error('Database error'))
      
      const mockKyselyWithError = {
        selectFrom: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue([])
      }

      const result = await coordinator.discoverSchema(mockKyselyWithError as any, {}, 'sqlite' as any)
      expect(result).toBeDefined()
      expect(result.tables).toEqual([])
    })
  })
})