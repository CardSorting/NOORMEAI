// SQLite Migration System - Focused on SQLite automation and optimization
export { SQLiteMigrationManager } from './sqlite-migration-manager.js'
export { SQLiteMigrationProvider } from './sqlite-migration-provider.js'

// Export types
export type {
  SQLiteMigrationConfig,
  SQLiteMigrationResult,
  SQLiteMigrationPlan
} from './sqlite-migration-manager.js'

export type {
  SQLiteMigrationFile,
  SQLiteMigrationProviderConfig
} from './sqlite-migration-provider.js'

// Factory function for easy initialization
export async function createSQLiteMigrationManager(
  db: any,
  config?: Partial<import('./sqlite-migration-manager.js').SQLiteMigrationConfig>,
  logger?: import('../logging/logger.js').Logger
): Promise<import('./sqlite-migration-manager.js').SQLiteMigrationManager> {
  const { SQLiteMigrationManager } = await import('./sqlite-migration-manager.js')
  return SQLiteMigrationManager.getInstance(db, config, logger)
}

// Factory function for migration provider
export async function createSQLiteMigrationProvider(
  config?: Partial<import('./sqlite-migration-provider.js').SQLiteMigrationProviderConfig>,
  logger?: import('../logging/logger.js').Logger
): Promise<import('./sqlite-migration-provider.js').SQLiteMigrationProvider> {
  const { SQLiteMigrationProvider } = await import('./sqlite-migration-provider.js')
  return SQLiteMigrationProvider.getInstance(config, logger)
}
