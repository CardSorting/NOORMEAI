// NOORMME Automation Configuration
// This file contains recommended automation settings for your database

import type { NOORMConfig } from 'noormme'

export const automationConfig: Partial<NOORMConfig> = {
  dialect: 'sqlite',
  
  // Performance optimizations
  performance: {
    enableAutoOptimization: true,
    enableQueryOptimization: true,
    enableCaching: true,
    enableBatchOperations: true,
    maxCacheSize: 1000
  },

  // SQLite-specific optimizations
  sqlite: {
    enableWALMode: true,
    enableForeignKeys: true,
    cacheSize: -64000, // 64MB
    synchronous: 'NORMAL',
    tempStore: 'MEMORY',
    autoVacuumMode: 'INCREMENTAL'
  },

  // Schema discovery settings
  introspection: {
    excludeTables: ['migrations', 'temp_*'],
    includeViews: true,
    customTypeMappings: {
      // Add custom type mappings here
    }
  },

  // Logging configuration
  logging: {
    enabled: true,
    level: 'info',
    includeQueryTime: true,
    includeQueryResults: false
  },

  // Cache configuration
  cache: {
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    enableCompression: true
  }
}

// Table-specific automation settings
export const tableAutomationSettings = {

}

// Usage example:
// import { NOORMME } from 'noormme'
// import { automationConfig } from './automation.config'
// 
// const db = new NOORMME(automationConfig)
// await db.initialize()
