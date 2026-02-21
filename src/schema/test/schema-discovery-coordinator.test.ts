import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { SchemaDiscoveryCoordinator } from '../core/coordinators/schema-discovery.coordinator.js'
import { DiscoveryFactory } from '../core/factories/discovery-factory.js'
import { SQLiteDiscoveryCoordinator } from '../dialects/sqlite/sqlite-discovery.coordinator.js'

// Mock Kysely and related types
const mockKysely = {
  selectFrom: jest.fn(),
  select: jest.fn(),
  where: jest.fn(),
  execute: jest.fn()
}

// Mock DiscoveryFactory
const mockFactory = {
  createTableDiscovery: jest.fn(),
  createRelationshipDiscovery: jest.fn(),
  createViewDiscovery: jest.fn(),
  createIndexDiscovery: jest.fn(),
  createConstraintDiscovery: jest.fn(),
  createDiscoveryCoordinator: jest.fn(),
  createDiscoveryServices: jest.fn(),
  getDialectCapabilities: jest.fn(),
  isDialectSupported: jest.fn(),
  getSupportedDialects: jest.fn()
} as jest.Mocked<DiscoveryFactory>

// Mock SQLite coordinator
const mockSQLiteCoordinator = {
  discoverSchema: jest.fn(),
  getCapabilities: jest.fn(),
  getRecommendations: jest.fn(),
  getConfigurationRecommendations: jest.fn(),
  tableDiscovery: {} as any,
  relationshipDiscovery: {} as any,
  viewDiscovery: {} as any,
  indexDiscovery: {} as any,
  constraintDiscovery: {} as any,
  enhanceTablesWithSQLiteMetadata: jest.fn()
} as unknown as jest.Mocked<SQLiteDiscoveryCoordinator>

describe('SchemaDiscoveryCoordinator', () => {
  let coordinator: SchemaDiscoveryCoordinator

  beforeEach(() => {
    // Reset singleton instance
    ; (SchemaDiscoveryCoordinator as any).instance = undefined

    // Setup mocks
    mockFactory.createDiscoveryCoordinator.mockReturnValue(mockSQLiteCoordinator)
    mockFactory.createDiscoveryServices.mockReturnValue({
      tableDiscovery: {} as any,
      relationshipDiscovery: {} as any,
      viewDiscovery: {} as any,
      indexDiscovery: {} as any,
      constraintDiscovery: {} as any
    })
    mockFactory.getDialectCapabilities.mockReturnValue({
      supportsViews: true,
      supportsIndexes: true,
      supportsConstraints: true,
      supportsForeignKeys: true,
      supportsCheckConstraints: true,
      supportsDeferredConstraints: false
    })
    mockFactory.isDialectSupported.mockReturnValue(true)

    coordinator = SchemaDiscoveryCoordinator.getInstance()

      // Mock the factory property
      ; (coordinator as any).factory = mockFactory
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SchemaDiscoveryCoordinator.getInstance()
      const instance2 = SchemaDiscoveryCoordinator.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Schema Discovery', () => {
    it('should discover schema for SQLite', async () => {
      const mockSchemaInfo = {
        tables: [],
        views: [],
        indexes: [],
        constraints: [],
        relationships: []
      }

      mockSQLiteCoordinator.discoverSchema.mockResolvedValue(mockSchemaInfo as any)

      const result = await coordinator.discoverSchema(mockKysely as any, {}, 'sqlite' as any)

      expect(mockFactory.createDiscoveryCoordinator).toHaveBeenCalledWith('sqlite')
      expect(mockSQLiteCoordinator.discoverSchema).toHaveBeenCalledWith(mockKysely as any, {})
      expect(result).toEqual(mockSchemaInfo)
    })

    it('should handle unsupported dialects', async () => {
      mockFactory.isDialectSupported.mockReturnValue(false)

      await expect(
        coordinator.discoverSchema(mockKysely as any, {}, 'unsupported' as any)
      ).rejects.toThrow('Unsupported dialect: unsupported')

      expect(mockFactory.isDialectSupported).toHaveBeenCalledWith('unsupported')
    })

    it('should handle discovery errors', async () => {
      const error = new Error('Discovery failed')
      mockSQLiteCoordinator.discoverSchema.mockRejectedValue(error)

      await expect(
        coordinator.discoverSchema(mockKysely as any, {}, 'sqlite' as any)
      ).rejects.toThrow('Discovery failed')
    })
  })

  describe('Dialect Support', () => {
    it('should check if dialect is supported', () => {
      const isSupported = coordinator.isDialectSupported('sqlite')
      expect(mockFactory.isDialectSupported).toHaveBeenCalledWith('sqlite')
      expect(isSupported).toBe(true)
    })

    it('should get dialect capabilities', () => {
      const capabilities = coordinator.getDialectCapabilities()
      expect(mockFactory.getDialectCapabilities).toHaveBeenCalledWith('sqlite')
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

  describe('Configuration', () => {
    it('should handle introspection configuration', async () => {
      const config = {
        excludeTables: ['migrations'],
        includeViews: true,
        customTypeMappings: { 'jsonb': 'Record<string, any>' }
      }

      const mockSchemaInfo = {
        tables: [],
        views: [],
        indexes: [],
        constraints: [],
        relationships: []
      }

      mockSQLiteCoordinator.discoverSchema.mockResolvedValue(mockSchemaInfo as any)

      await coordinator.discoverSchema(mockKysely as any, config, 'sqlite' as any)

      expect(mockSQLiteCoordinator.discoverSchema).toHaveBeenCalledWith(mockKysely as any, config)
    })
  })
})