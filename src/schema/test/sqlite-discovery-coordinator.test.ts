import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { SQLiteDiscoveryCoordinator } from '../dialects/sqlite/sqlite-discovery.coordinator.js'
import { TableMetadataDiscovery } from '../core/discovery/table-metadata-discovery.js'
import { RelationshipDiscovery } from '../core/discovery/relationship-discovery.js'
import { ViewDiscovery } from '../core/discovery/view-discovery.js'
import { SQLiteIndexDiscovery } from '../dialects/sqlite/discovery/sqlite-index-discovery.js'
import { SQLiteConstraintDiscovery } from '../dialects/sqlite/discovery/sqlite-constraint-discovery.js'

// Mock Kysely
const mockKysely = {
  selectFrom: jest.fn(),
  select: jest.fn(),
  execute: jest.fn()
} as any

// Mock DatabaseIntrospector
jest.mock('../../dialect/database-introspector.js', () => ({
  DatabaseIntrospector: jest.fn().mockImplementation(() => ({
    getTables: jest.fn(),
    getTableMetadata: jest.fn(),
    getViews: jest.fn()
  }))
}))

const mockTableData = [
  {
    name: 'users',
    columns: [
      { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
      { name: 'email', type: 'TEXT', isNullable: false },
      { name: 'created_at', type: 'DATETIME', isNullable: false }
    ],
    primaryKey: ['id']
  },
  {
    name: 'posts',
    columns: [
      { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false },
      { name: 'user_id', type: 'INTEGER', isNullable: false },
      { name: 'title', type: 'TEXT', isNullable: false }
    ],
    primaryKey: ['id']
  }
]

const mockIndexData = [
  {
    name: 'users_email_idx',
    columns: ['email'],
    unique: true,
    isPrimary: false,
    definition: 'CREATE UNIQUE INDEX users_email_idx ON users(email)'
  },
  {
    name: 'posts_user_id_idx',
    columns: ['user_id'],
    unique: false,
    isPrimary: false,
    definition: 'CREATE INDEX posts_user_id_idx ON posts(user_id)'
  }
]

const mockConstraintData = [
  {
    name: 'users_email_check',
    type: 'CHECK',
    definition: "email LIKE '%@%'",
    valid: true
  }
]

const mockForeignKeyData = [
  {
    name: 'posts_user_id_fkey',
    column: 'user_id',
    referencedTable: 'users',
    referencedColumn: 'id',
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION'
  }
]

const mockViewData = [
  {
    name: 'user_posts_view',
    definition: 'SELECT u.email, p.title FROM users u JOIN posts p ON u.id = p.user_id',
    columns: [
      { name: 'email', type: 'TEXT' },
      { name: 'title', type: 'TEXT' }
    ]
  }
]

const mockRelationshipData = [
  {
    fromTable: 'posts',
    fromColumn: 'user_id',
    toTable: 'users',
    toColumn: 'id',
    type: 'many-to-one'
  }
]

const mockTableSize = {
  pages: 10,
  size: 40960,
  estimatedRows: 100
}

describe('SQLiteDiscoveryCoordinator', () => {
  let coordinator: SQLiteDiscoveryCoordinator
  let mockTableDiscovery: jest.Mocked<TableMetadataDiscovery>
  let mockRelationshipDiscovery: jest.Mocked<RelationshipDiscovery>
  let mockViewDiscovery: jest.Mocked<ViewDiscovery>
  let mockIndexDiscovery: jest.Mocked<SQLiteIndexDiscovery>
  let mockConstraintDiscovery: jest.Mocked<SQLiteConstraintDiscovery>

  beforeEach(() => {
    // Reset singleton instance
    ;(SQLiteDiscoveryCoordinator as any).instance = undefined

    // Create mocks
    mockTableDiscovery = {
      discoverTables: jest.fn().mockResolvedValue(mockTableData)
    } as any

    mockRelationshipDiscovery = {
      discoverRelationships: jest.fn().mockResolvedValue(mockRelationshipData)
    } as any

    mockViewDiscovery = {
      discoverViews: jest.fn().mockResolvedValue(mockViewData)
    } as any

    mockIndexDiscovery = {
      discoverTableIndexes: jest.fn().mockResolvedValue(mockIndexData),
      getTableSize: jest.fn().mockResolvedValue(mockTableSize),
      analyzeIndexEfficiency: jest.fn().mockReturnValue({
        recommendations: ['Consider using covering indexes for better performance']
      })
    } as any

    mockConstraintDiscovery = {
      isForeignKeySupportEnabled: jest.fn().mockResolvedValue(true),
      discoverTableConstraints: jest.fn().mockResolvedValue(mockConstraintData),
      getForeignKeyInfo: jest.fn().mockResolvedValue(mockForeignKeyData),
      analyzeConstraintCompatibility: jest.fn().mockReturnValue({
        recommendations: ['Consider optimizing constraint definitions']
      })
    } as any

    // Mock static methods
    jest.spyOn(TableMetadataDiscovery, 'getInstance').mockReturnValue(mockTableDiscovery)
    jest.spyOn(RelationshipDiscovery, 'getInstance').mockReturnValue(mockRelationshipDiscovery)
    jest.spyOn(ViewDiscovery, 'getInstance').mockReturnValue(mockViewDiscovery)
    jest.spyOn(SQLiteIndexDiscovery, 'getInstance').mockReturnValue(mockIndexDiscovery)
    jest.spyOn(SQLiteConstraintDiscovery, 'getInstance').mockReturnValue(mockConstraintDiscovery)

    coordinator = SQLiteDiscoveryCoordinator.getInstance()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SQLiteDiscoveryCoordinator.getInstance()
      const instance2 = SQLiteDiscoveryCoordinator.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should maintain state across multiple calls', () => {
      const instance1 = SQLiteDiscoveryCoordinator.getInstance()
      const instance2 = SQLiteDiscoveryCoordinator.getInstance()
      expect(instance1.getCapabilities()).toEqual(instance2.getCapabilities())
    })
  })

  describe('Schema Discovery', () => {
    it('should discover complete SQLite schema with foreign keys enabled', async () => {
      const config = { includeViews: true, excludeTables: ['temp_*'] }

      const result = await coordinator.discoverSchema(mockKysely, config)

      expect(mockConstraintDiscovery.isForeignKeySupportEnabled).toHaveBeenCalledWith(mockKysely)
      expect(mockTableDiscovery.discoverTables).toHaveBeenCalled()
      expect(mockIndexDiscovery.discoverTableIndexes).toHaveBeenCalledTimes(2)
      expect(mockIndexDiscovery.getTableSize).toHaveBeenCalledTimes(2)
      expect(mockConstraintDiscovery.discoverTableConstraints).toHaveBeenCalledTimes(2)
      expect(mockConstraintDiscovery.getForeignKeyInfo).toHaveBeenCalledTimes(2)
      expect(mockRelationshipDiscovery.discoverRelationships).toHaveBeenCalled()
      expect(mockViewDiscovery.discoverViews).toHaveBeenCalled()

      expect(result.tables).toHaveLength(2)
      expect(result.relationships).toEqual(mockRelationshipData)
      expect(result.views).toHaveLength(1)
    })

    it('should handle foreign keys disabled', async () => {
      mockConstraintDiscovery.isForeignKeySupportEnabled.mockResolvedValue(false)

      const result = await coordinator.discoverSchema(mockKysely, {})

      expect(mockConstraintDiscovery.getForeignKeyInfo).not.toHaveBeenCalled()
      expect(mockRelationshipDiscovery.discoverRelationships).not.toHaveBeenCalled()
      expect(result.relationships).toEqual([])
    })

    it('should enhance tables with SQLite-specific metadata', async () => {
      const result = await coordinator.discoverSchema(mockKysely, {})

      expect(result.tables[0]).toMatchObject({
        name: 'users',
        indexes: expect.arrayContaining([
          expect.objectContaining({
            name: 'users_email_idx',
            columns: ['email'],
            unique: true,
            definition: 'CREATE UNIQUE INDEX users_email_idx ON users(email)'
          })
        ]),
        constraints: mockConstraintData,
        foreignKeys: expect.arrayContaining([
          expect.objectContaining({
            name: 'posts_user_id_fkey',
            column: 'user_id',
            referencedTable: 'users',
            referencedColumn: 'id',
            onDelete: 'CASCADE'
          })
        ]),
        tableSize: mockTableSize
      })
    })

    it('should skip views when includeViews is false', async () => {
      const config = { includeViews: false }

      await coordinator.discoverSchema(mockKysely, config)

      expect(mockViewDiscovery.discoverViews).not.toHaveBeenCalled()
    })

    it('should handle table discovery errors gracefully', async () => {
      mockIndexDiscovery.discoverTableIndexes.mockRejectedValue(new Error('Index discovery failed'))

      const result = await coordinator.discoverSchema(mockKysely, {})

      expect(result.tables).toHaveLength(2)
      expect(result.tables[0]).toMatchObject({
        name: 'users',
        indexes: [],
        foreignKeys: [],
        tableSize: undefined
      })
    })

    it('should handle constraint discovery errors gracefully', async () => {
      mockConstraintDiscovery.discoverTableConstraints.mockRejectedValue(new Error('Constraint discovery failed'))

      const result = await coordinator.discoverSchema(mockKysely, {})

      expect(result.tables).toHaveLength(2)
      expect(result.tables[0].foreignKeys).toEqual([])
    })
  })

  describe('Capabilities', () => {
    it('should return SQLite-specific capabilities', () => {
      const capabilities = coordinator.getCapabilities()

      expect(capabilities).toEqual({
        supportsViews: true,
        supportsIndexes: true,
        supportsConstraints: true,
        supportsForeignKeys: true, // SQLite supports FK (requires PRAGMA foreign_keys = ON)
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
  })

  describe('Recommendations', () => {
    it('should provide SQLite-specific recommendations', async () => {
      mockConstraintDiscovery.isForeignKeySupportEnabled.mockResolvedValue(false)
      const tables = [
        { name: 'users', primaryKey: ['id'], indexes: [], foreignKeys: [] },
        { name: 'posts', primaryKey: ['id'], indexes: [], foreignKeys: [] }
      ]

      const recommendations = await coordinator.getRecommendations(mockKysely, tables)

      expect(mockConstraintDiscovery.isForeignKeySupportEnabled).toHaveBeenCalled()
      expect(mockIndexDiscovery.discoverTableIndexes).toHaveBeenCalledTimes(2)
      expect(mockIndexDiscovery.analyzeIndexEfficiency).toHaveBeenCalledTimes(2)
      expect(mockConstraintDiscovery.discoverTableConstraints).toHaveBeenCalledTimes(2)
      expect(mockConstraintDiscovery.analyzeConstraintCompatibility).toHaveBeenCalledTimes(2)

      expect(recommendations).toContain('Consider enabling foreign key support with PRAGMA foreign_keys = ON for better data integrity')
      expect(recommendations).toContain('Consider using covering indexes for better performance')
      expect(recommendations).toContain('Consider optimizing constraint definitions')
    })

    it('should recommend enabling foreign keys when disabled', async () => {
      mockConstraintDiscovery.isForeignKeySupportEnabled.mockResolvedValue(false)
      const tables = [{ name: 'users', primaryKey: ['id'], indexes: [], foreignKeys: [] }]

      const recommendations = await coordinator.getRecommendations(mockKysely, tables)

      expect(recommendations).toContain('Consider enabling foreign key support with PRAGMA foreign_keys = ON for better data integrity')
    })

    it('should recommend primary key for tables without one', async () => {
      const tables = [
        { name: 'users', primaryKey: [], indexes: [], foreignKeys: [] },
        { name: 'posts', primaryKey: ['id'], indexes: [], foreignKeys: [] }
      ]

      const recommendations = await coordinator.getRecommendations(mockKysely, tables)

      expect(recommendations).toContain('Table users should have a primary key for better performance')
    })

    it('should handle recommendation errors gracefully', async () => {
      mockConstraintDiscovery.isForeignKeySupportEnabled.mockResolvedValue(false)
      mockIndexDiscovery.discoverTableIndexes.mockRejectedValue(new Error('Index analysis failed'))
      const tables = [{ name: 'users', primaryKey: ['id'], indexes: [], foreignKeys: [] }]

      const recommendations = await coordinator.getRecommendations(mockKysely, tables)

      expect(recommendations).toEqual(['Consider enabling foreign key support with PRAGMA foreign_keys = ON for better data integrity'])
    })

    it('should handle empty tables array', async () => {
      const recommendations = await coordinator.getRecommendations(mockKysely, [])

      expect(recommendations).toEqual([])
      expect(mockIndexDiscovery.discoverTableIndexes).not.toHaveBeenCalled()
    })
  })

  describe('Configuration Recommendations', () => {
    it('should provide SQLite configuration recommendations', () => {
      const recommendations = coordinator.getConfigurationRecommendations()

      expect(recommendations).toEqual([
        'Enable foreign key constraints: PRAGMA foreign_keys = ON',
        'Use WAL mode for better concurrency: PRAGMA journal_mode = WAL',
        'Set appropriate cache size: PRAGMA cache_size = -64000',
        'Enable query optimization: PRAGMA optimize',
        'Consider using prepared statements for better performance'
      ])
    })
  })

  describe('Error Handling', () => {
    it('should handle table discovery failures', async () => {
      mockTableDiscovery.discoverTables.mockRejectedValue(new Error('Table discovery failed'))

      const result = await coordinator.discoverSchema(mockKysely, {})
      
      expect(result.tables).toEqual([])
    })

    it('should handle relationship discovery failures', async () => {
      mockRelationshipDiscovery.discoverRelationships.mockRejectedValue(new Error('Relationship discovery failed'))

      const result = await coordinator.discoverSchema(mockKysely, {})
      
      expect(result.tables).toHaveLength(2)
      expect(result.relationships).toEqual([])
    })

    it('should handle view discovery failures when views are requested', async () => {
      mockViewDiscovery.discoverViews.mockRejectedValue(new Error('View discovery failed'))
      const config = { includeViews: true }

      const result = await coordinator.discoverSchema(mockKysely, config)
      
      expect(result.tables).toHaveLength(2)
      expect(result.views).toEqual([])
    })

    it('should handle foreign key support check failures', async () => {
      mockConstraintDiscovery.isForeignKeySupportEnabled.mockRejectedValue(new Error('PRAGMA check failed'))

      const result = await coordinator.discoverSchema(mockKysely, {})
      
      expect(result.tables).toHaveLength(2)
      expect(mockConstraintDiscovery.getForeignKeyInfo).not.toHaveBeenCalled()
      expect(mockRelationshipDiscovery.discoverRelationships).not.toHaveBeenCalled()
    })

    it('should handle partial enhancement failures', async () => {
      // Mock successful table discovery but failed index discovery for one table
      mockIndexDiscovery.discoverTableIndexes
        .mockResolvedValueOnce(mockIndexData) // First call succeeds
        .mockRejectedValueOnce(new Error('Index discovery failed')) // Second call fails

      const result = await coordinator.discoverSchema(mockKysely, {})

      expect(result.tables).toHaveLength(2)
      expect(result.tables[0].indexes).toEqual(mockIndexData) // First table enhanced
      expect(result.tables[1].indexes).toEqual([]) // Second table not enhanced due to error
    })
  })

  describe('Configuration Handling', () => {
    it('should pass configuration to table discovery', async () => {
      const config = { 
        excludeTables: ['temp_*'], 
        includeViews: true,
        customTypeMappings: { 'INTEGER': 'number' }
      }

      await coordinator.discoverSchema(mockKysely, config)

      expect(mockTableDiscovery.discoverTables).toHaveBeenCalledWith(
        expect.any(Object), // DatabaseIntrospector
        {
          excludeTables: ['temp_*'],
          includeViews: true,
          customTypeMappings: { 'INTEGER': 'number' }
        }
      )
    })

    it('should use default configuration when none provided', async () => {
      await coordinator.discoverSchema(mockKysely)

      expect(mockTableDiscovery.discoverTables).toHaveBeenCalledWith(
        expect.any(Object),
        {
          excludeTables: undefined,
          includeViews: undefined,
          customTypeMappings: undefined
        }
      )
    })
  })

  describe('Foreign Key Handling', () => {
    it('should check foreign key support before discovering relationships', async () => {
      await coordinator.discoverSchema(mockKysely, {})

      expect(mockConstraintDiscovery.isForeignKeySupportEnabled).toHaveBeenCalledWith(mockKysely)
      expect(mockConstraintDiscovery.getForeignKeyInfo).toHaveBeenCalledTimes(2)
      expect(mockRelationshipDiscovery.discoverRelationships).toHaveBeenCalled()
    })

    it('should skip foreign key discovery when support is disabled', async () => {
      mockConstraintDiscovery.isForeignKeySupportEnabled.mockResolvedValue(false)

      const result = await coordinator.discoverSchema(mockKysely, {})

      expect(mockConstraintDiscovery.getForeignKeyInfo).not.toHaveBeenCalled()
      expect(mockRelationshipDiscovery.discoverRelationships).not.toHaveBeenCalled()
      expect(result.relationships).toEqual([])
      expect(result.tables[0].foreignKeys).toEqual([])
    })
  })
})
