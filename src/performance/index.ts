/**
 * Performance module exports
 * Clean, focused services, utilities, and classes
 */

// Utilities
export * from './utils/query-parser'

// Services
export * from './services/cache-service'
export * from './services/metrics-collector'
export * from './services/connection-factory'

// Main optimizer
export * from './query-optimizer'

/**
 * Default performance configuration
 */
export const defaultPerformanceConfig = {
  cache: {
    maxSize: 1000,
    defaultTtl: 300000, // 5 minutes
    cleanupInterval: 60000, // 1 minute
    enableMetrics: true
  },
  
  metrics: {
    enabled: true,
    slowQueryThreshold: 1000,
    nPlusOneDetection: true,
    missingIndexDetection: true,
    largeResultSetThreshold: 1000,
    maxHistorySize: 10000,
    warningRetentionDays: 7
  },
  
  connectionPool: {
    minConnections: 2,
    maxConnections: 10,
    acquireTimeout: 30000,
    idleTimeout: 300000,
    validationInterval: 60000
  },
  
  optimizer: {
    enableQueryCache: true,
    enableIndexRecommendations: true,
    enableQueryRewriting: true,
    slowQueryThreshold: 1000,
    cacheSize: 1000,
    maxCacheAge: 300000
  }
}
