import { jest } from '@jest/globals'

// Mock console methods to avoid noise in tests
const originalConsole = { ...console }

beforeEach(() => {
  // Mock console methods
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  // Restore console methods
  jest.restoreAllMocks()
})

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit
beforeAll(() => {
  process.exit = jest.fn() as any
})

afterAll(() => {
  process.exit = originalExit
})

// Extend Jest matchers for better TypeScript support
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeCalledWith(...args: any[]): R
      toHaveBeenCalledWith(...args: any[]): R
      toHaveBeenCalledTimes(times: number): R
    }
  }
}

// Global test utilities
declare global {
  var createMockDatabase: () => string
  var createMockSchemaInfo: () => any
  var createMockNOORMME: () => any
}

// Test utilities
global.createMockDatabase = () => {
  return ':memory:' // Use in-memory SQLite for tests
}

global.createMockSchemaInfo = () => {
  return {
    tables: [
      {
        name: 'users',
        schema: 'main',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isAutoIncrement: true },
          { name: 'name', type: 'TEXT', nullable: false },
          { name: 'email', type: 'TEXT', nullable: false },
          { name: 'status', type: 'TEXT', nullable: true, defaultValue: 'active' },
          { name: 'created_at', type: 'DATETIME', nullable: false }
        ],
        primaryKey: ['id'],
        foreignKeys: [],
        indexes: [
          { name: 'idx_users_email', columns: ['email'], unique: true },
          { name: 'idx_users_status', columns: ['status'], unique: false }
        ]
      },
      {
        name: 'posts',
        schema: 'main',
        columns: [
          { name: 'id', type: 'INTEGER', nullable: false, isPrimaryKey: true, isAutoIncrement: true },
          { name: 'title', type: 'TEXT', nullable: false },
          { name: 'content', type: 'TEXT', nullable: true },
          { name: 'user_id', type: 'INTEGER', nullable: false },
          { name: 'status', type: 'TEXT', nullable: false, defaultValue: 'draft' },
          { name: 'created_at', type: 'DATETIME', nullable: false }
        ],
        primaryKey: ['id'],
        foreignKeys: [
          { column: 'user_id', referencedTable: 'users', referencedColumn: 'id', onDelete: 'CASCADE' }
        ],
        indexes: [
          { name: 'idx_posts_user_id', columns: ['user_id'], unique: false },
          { name: 'idx_posts_status', columns: ['status'], unique: false }
        ]
      }
    ],
    relationships: [
      {
        name: 'user_posts',
        fromTable: 'users',
        fromColumn: 'id',
        toTable: 'posts',
        toColumn: 'user_id',
        type: 'one-to-many'
      }
    ]
  }
}

global.createMockNOORMME = () => {
  const mockSchemaInfo = global.createMockSchemaInfo()
  
  return {
    initialize: jest.fn(() => Promise.resolve(undefined)),
    close: jest.fn(() => Promise.resolve(undefined)),
    getSchemaInfo: jest.fn(() => Promise.resolve(mockSchemaInfo)),
    getSQLiteOptimizations: jest.fn(() => Promise.resolve({
      appliedOptimizations: [
        'Enabled WAL mode',
        'Set cache size to 64MB',
        'Enabled foreign key constraints'
      ],
      warnings: [],
      walMode: true,
      foreignKeys: true,
      autoVacuum: 'INCREMENTAL',
      journalMode: 'WAL',
      synchronous: 'NORMAL',
      cacheSize: -64000
    })),
    getSQLiteIndexRecommendations: jest.fn(() => Promise.resolve({
      recommendations: [
        { table: 'users', column: 'created_at', reason: 'Frequently queried for sorting', impact: 'high' },
        { table: 'posts', column: 'created_at', reason: 'Used in date range queries', impact: 'medium' }
      ]
    })),
    getSQLitePerformanceMetrics: jest.fn(() => Promise.resolve({
      cacheHitRate: 0.85,
      averageQueryTime: 45.2,
      totalQueries: 1250,
      slowQueries: 5,
      databaseSize: 2048000, // 2MB
      pageCount: 500,
      freePages: 50,
      walMode: true,
      foreignKeys: true,
      autoVacuum: 'INCREMENTAL',
      journalMode: 'WAL',
      synchronous: 'NORMAL'
    })),
    applySQLiteOptimizations: jest.fn(() => Promise.resolve({
      appliedOptimizations: ['Enabled WAL mode', 'Set optimal cache size'],
      warnings: []
    })),
    applySQLiteIndexRecommendations: jest.fn(() => Promise.resolve([
      { table: 'users', column: 'created_at' },
      { table: 'posts', column: 'created_at' }
    ])),
    runSQLiteAnalyze: jest.fn(() => Promise.resolve(undefined)),
    enableSQLiteWALMode: jest.fn(() => Promise.resolve(undefined)),
    getQueryAnalyzer: jest.fn(() => ({
      getQueryPatterns: jest.fn(() => ({
        totalQueries: 100,
        uniquePatterns: 25,
        averageExecutionTime: 45.2,
        frequentQueries: [
          { sql: 'SELECT * FROM users WHERE email = ?', count: 50, avgTime: 12.5 },
          { sql: 'SELECT * FROM posts WHERE user_id = ?', count: 30, avgTime: 8.3 }
        ],
        slowQueries: [
          { sql: 'SELECT * FROM users ORDER BY created_at DESC', maxTime: 1500, avgTime: 850 }
        ],
        nPlusOneQueries: [
          { description: 'User posts query without join', occurrences: 5 }
        ]
      }))
    })),
    getSlowQueries: jest.fn(() => Promise.resolve([
      {
        sql: 'SELECT * FROM users ORDER BY created_at DESC',
        executionTime: 1500,
        suggestions: ['Add index on created_at column', 'Consider pagination']
      }
    ])),
    getKysely: jest.fn(() => ({
      selectFrom: jest.fn().mockReturnThis(),
      selectAll: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      execute: jest.fn(() => Promise.resolve([]))
    })),
    getRepository: jest.fn(() => ({
      findById: jest.fn(() => Promise.resolve({ id: 1, name: 'Test User' })),
      findAll: jest.fn(() => Promise.resolve([{ id: 1, name: 'Test User' }])),
      create: jest.fn(() => Promise.resolve({ id: 1, name: 'Test User' })),
      update: jest.fn(() => Promise.resolve({ id: 1, name: 'Updated User' })),
      delete: jest.fn(() => Promise.resolve(true)),
      count: jest.fn(() => Promise.resolve(1)),
      exists: jest.fn(() => Promise.resolve(true))
    })),
    getMigrationManager: jest.fn(() => ({
      getMigrationStatus: jest.fn(() => Promise.resolve({
        currentVersion: '001',
        appliedMigrations: [
          { version: '001', name: 'initial_schema', appliedAt: '2024-01-01T00:00:00Z' }
        ],
        pendingMigrations: [],
        availableMigrations: [
          { version: '001', name: 'initial_schema' }
        ]
      })),
      generateMigration: jest.fn(() => Promise.resolve({
        fileName: '001_initial_schema.ts',
        filePath: '/tmp/migrations/001_initial_schema.ts',
        description: 'Initial database schema',
        content: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);'
      })),
      migrateToLatest: jest.fn(() => Promise.resolve({
        migrationsApplied: [],
        migrationsRolledBack: [],
        currentVersion: '001'
      })),
      migrateToVersion: jest.fn(() => Promise.resolve({
        migrationsApplied: [],
        migrationsRolledBack: [],
        currentVersion: '001'
      })),
      rollbackLastMigration: jest.fn(() => Promise.resolve({
        success: false,
        migration: null,
        currentVersion: '001'
      }))
    }))
  }
}