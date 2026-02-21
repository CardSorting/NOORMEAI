import type { Kysely } from '../../../kysely.js'
import type { Dialect } from '../../../dialect/dialect.js'
import { TableMetadataDiscovery } from '../discovery/table-metadata-discovery.js'
import { RelationshipDiscovery } from '../discovery/relationship-discovery.js'
import { ViewDiscovery } from '../discovery/view-discovery.js'
import { SQLiteDiscoveryCoordinator } from '../../dialects/sqlite/sqlite-discovery.coordinator.js'
import { SQLiteIndexDiscovery } from '../../dialects/sqlite/discovery/sqlite-index-discovery.js'
import { SQLiteConstraintDiscovery } from '../../dialects/sqlite/discovery/sqlite-constraint-discovery.js'
import { PostgresDiscoveryCoordinator } from '../../dialects/postgresql/postgresql-discovery.coordinator.js'

/**
 * Factory for creating database-specific discovery services
 */
export class DiscoveryFactory {
  private static instance: DiscoveryFactory

  static getInstance(): DiscoveryFactory {
    if (!DiscoveryFactory.instance) {
      DiscoveryFactory.instance = new DiscoveryFactory()
    }
    return DiscoveryFactory.instance
  }

  /**
   * Create table discovery service
   */
  createTableDiscovery(): TableMetadataDiscovery {
    return TableMetadataDiscovery.getInstance()
  }

  /**
   * Create relationship discovery service
   */
  createRelationshipDiscovery(): RelationshipDiscovery {
    return RelationshipDiscovery.getInstance()
  }

  /**
   * Create view discovery service
   */
  createViewDiscovery(): ViewDiscovery {
    return ViewDiscovery.getInstance()
  }

  /**
   * Create index discovery service based on dialect
   */
  createIndexDiscovery(dialect: string): any {
    switch (dialect.trim().toLowerCase()) {
      case 'sqlite':
        return SQLiteIndexDiscovery.getInstance()
      case 'postgres':
      case 'postgresql':
        // PostgreSQL uses standard information_schema, no specialized service needed yet
        return null
      default:
        throw new Error(`Unsupported dialect for index discovery: ${dialect}`)
    }
  }

  /**
   * Create constraint discovery service based on dialect
   */
  createConstraintDiscovery(dialect: string): any {
    switch (dialect.trim().toLowerCase()) {
      case 'sqlite':
        return SQLiteConstraintDiscovery.getInstance()
      case 'postgres':
      case 'postgresql':
        // PostgreSQL uses standard information_schema, no specialized service needed yet
        return null
      default:
        throw new Error(`Unsupported dialect for constraint discovery: ${dialect}`)
    }
  }

  /**
   * Create dialect-specific discovery coordinator
   */
  createDiscoveryCoordinator(dialect: string): any {
    switch (dialect.trim().toLowerCase()) {
      case 'sqlite':
        return SQLiteDiscoveryCoordinator.getInstance()
      case 'postgres':
      case 'postgresql':
        return PostgresDiscoveryCoordinator.getInstance()
      default:
        throw new Error(`Unsupported dialect for discovery coordinator: ${dialect}`)
    }
  }

  /**
   * Create all discovery services for a specific dialect
   */
  createDiscoveryServices(dialect: string): {
    tableDiscovery: TableMetadataDiscovery
    relationshipDiscovery: RelationshipDiscovery
    viewDiscovery: ViewDiscovery
    indexDiscovery: any
    constraintDiscovery: any
  } {
    return {
      tableDiscovery: this.createTableDiscovery(),
      relationshipDiscovery: this.createRelationshipDiscovery(),
      viewDiscovery: this.createViewDiscovery(),
      indexDiscovery: this.createIndexDiscovery(dialect),
      constraintDiscovery: this.createConstraintDiscovery(dialect)
    }
  }

  /**
   * Get supported dialects
   */
  getSupportedDialects(): string[] {
    return ['sqlite', 'postgres', 'postgresql']
  }

  /**
   * Check if a dialect is supported
   */
  isDialectSupported(dialect: string): boolean {
    return this.getSupportedDialects().includes(dialect.trim().toLowerCase())
  }

  /**
   * Get dialect-specific capabilities
   */
  getDialectCapabilities(dialect: string): {
    supportsViews: boolean
    supportsIndexes: boolean
    supportsConstraints: boolean
    supportsForeignKeys: boolean
    supportsCheckConstraints: boolean
    supportsDeferredConstraints: boolean
  } {
    switch (dialect.trim().toLowerCase()) {
      case 'sqlite':
        return {
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: true,
          supportsCheckConstraints: true,
          supportsDeferredConstraints: false
        }
      case 'postgres':
      case 'postgresql':
        return {
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: true,
          supportsCheckConstraints: true,
          supportsDeferredConstraints: true
        }
      default:
        return {
          supportsViews: false,
          supportsIndexes: false,
          supportsConstraints: false,
          supportsForeignKeys: false,
          supportsCheckConstraints: false,
          supportsDeferredConstraints: false
        }
    }
  }
}
