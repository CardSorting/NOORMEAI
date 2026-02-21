import type { Kysely } from '../../../kysely.js'
import { PostgresIntrospector } from '../../../dialect/postgresql/postgresql-introspector.js'
import { SchemaInfo, IntrospectionConfig } from '../../../types/index.js'
import { SchemaDiscoveryConfig } from '../../core/types/schema-discovery-types.js'
import { TableMetadataDiscovery } from '../../core/discovery/table-metadata-discovery.js'
import { RelationshipDiscovery } from '../../core/discovery/relationship-discovery.js'
import { ViewDiscovery } from '../../core/discovery/view-discovery.js'

/**
 * PostgreSQL-specific schema discovery coordinator.
 * Leverages standard core discovery logic with PostgreSQL-specific introspector.
 */
export class PostgresDiscoveryCoordinator {
  private static instance: PostgresDiscoveryCoordinator
  private tableDiscovery: TableMetadataDiscovery
  private relationshipDiscovery: RelationshipDiscovery
  private viewDiscovery: ViewDiscovery

  private constructor() {
    this.tableDiscovery = TableMetadataDiscovery.getInstance()
    this.relationshipDiscovery = RelationshipDiscovery.getInstance()
    this.viewDiscovery = ViewDiscovery.getInstance()
  }

  static getInstance(): PostgresDiscoveryCoordinator {
    if (!PostgresDiscoveryCoordinator.instance) {
      PostgresDiscoveryCoordinator.instance = new PostgresDiscoveryCoordinator()
    }
    return PostgresDiscoveryCoordinator.instance
  }

  /**
   * Discover complete PostgreSQL schema
   */
  async discoverSchema(
    db: Kysely<any>,
    config: IntrospectionConfig = {}
  ): Promise<SchemaInfo> {
    const introspector = new PostgresIntrospector(db)
    const discoveryConfig: SchemaDiscoveryConfig = {
      excludeTables: config.excludeTables,
      includeViews: config.includeViews,
      customTypeMappings: config.customTypeMappings
    }

    // Discover tables
    let tables: any[] = []
    try {
      tables = await this.tableDiscovery.discoverTables(introspector, discoveryConfig)
    } catch (error) {
      console.warn('PostgreSQL table discovery failed:', error)
      tables = []
    }
    
    // Discover relationships
    let relationships: any[] = []
    try {
      relationships = await this.relationshipDiscovery.discoverRelationships(tables)
    } catch (error) {
      console.warn('PostgreSQL relationship discovery failed:', error)
      relationships = []
    }
    
    // Discover views if requested
    let views: any[] = []
    if (discoveryConfig.includeViews) {
      try {
        const viewMetadata = await this.viewDiscovery.discoverViews(introspector)
        views = viewMetadata.map(view => ({
          name: view.name,
          schema: view.schema,
          definition: view.definition || '',
          columns: view.columns || []
        }))
      } catch (error) {
        console.warn('PostgreSQL view discovery failed:', error)
        views = []
      }
    }

    return {
      tables,
      relationships,
      views
    }
  }

  /**
   * Get PostgreSQL-specific capabilities
   */
  getCapabilities() {
    return {
      supportsViews: true,
      supportsIndexes: true,
      supportsConstraints: true,
      supportsForeignKeys: true,
      supportsCheckConstraints: true,
      supportsDeferredConstraints: true,
      supportsPartialIndexes: true,
      supportsExpressionIndexes: true,
      supportsConcurrentIndexCreation: true,
      supportsMaterializedViews: true,
      supportsCustomTypes: true,
      supportsExtensions: true,
      supportsPRAGMA: false,
      supportsAutoIncrement: true, // via serial or identity
      supportsRowId: false,
      supportsTriggers: true,
      supportsFullTextSearch: true
    }
  }

  /**
   * Get PostgreSQL configuration recommendations
   */
  getConfigurationRecommendations(): string[] {
    return [
      'Use connection pooling for better performance',
      'Enable SSL for secure database connections',
      'Consider using JSONB for unstructured data',
      'Use appropriate isolation levels for transactions',
      'Monitor slow queries using pg_stat_statements'
    ]
  }
}
