import type { Kysely } from '../../../kysely.js'
import { SqliteIntrospector } from '../../../dialect/sqlite/sqlite-introspector.js'
import { SchemaInfo, IntrospectionConfig } from '../../../types/index.js'
import { SchemaDiscoveryConfig } from '../../core/types/schema-discovery-types.js'
import { TableMetadataDiscovery } from '../../core/discovery/table-metadata-discovery.js'
import { RelationshipDiscovery } from '../../core/discovery/relationship-discovery.js'
import { ViewDiscovery } from '../../core/discovery/view-discovery.js'
import { SQLiteIndexDiscovery } from './discovery/sqlite-index-discovery.js'
import { SQLiteConstraintDiscovery } from './discovery/sqlite-constraint-discovery.js'

/**
 * SQLite-specific schema discovery coordinator
 */
export class SQLiteDiscoveryCoordinator {
  private static instance: SQLiteDiscoveryCoordinator
  private tableDiscovery: TableMetadataDiscovery
  private relationshipDiscovery: RelationshipDiscovery
  private viewDiscovery: ViewDiscovery
  private indexDiscovery: SQLiteIndexDiscovery
  private constraintDiscovery: SQLiteConstraintDiscovery

  private constructor() {
    this.tableDiscovery = TableMetadataDiscovery.getInstance()
    this.relationshipDiscovery = RelationshipDiscovery.getInstance()
    this.viewDiscovery = ViewDiscovery.getInstance()
    this.indexDiscovery = SQLiteIndexDiscovery.getInstance()
    this.constraintDiscovery = SQLiteConstraintDiscovery.getInstance()
  }

  static getInstance(): SQLiteDiscoveryCoordinator {
    if (!SQLiteDiscoveryCoordinator.instance) {
      SQLiteDiscoveryCoordinator.instance = new SQLiteDiscoveryCoordinator()
    }
    return SQLiteDiscoveryCoordinator.instance
  }

  /**
   * Discover complete SQLite schema
   */
  async discoverSchema(
    db: Kysely<any>,
    config: IntrospectionConfig = {}
  ): Promise<SchemaInfo> {
    const introspector = new SqliteIntrospector(db)
    const discoveryConfig: SchemaDiscoveryConfig = {
      excludeTables: config.excludeTables,
      includeViews: config.includeViews,
      customTypeMappings: config.customTypeMappings
    }

    // Check if foreign keys are enabled
    let fkEnabled = false
    try {
      fkEnabled = await this.constraintDiscovery.isForeignKeySupportEnabled(db)
    } catch (error) {
      console.warn('Failed to check foreign key support:', error)
      fkEnabled = false
    }

    // Discover tables with SQLite-specific metadata
    let tables: any[] = []
    try {
      tables = await this.tableDiscovery.discoverTables(introspector, discoveryConfig)
    } catch (error) {
      console.warn('Table discovery failed:', error)
      tables = []
    }
    
    // Enhance tables with SQLite-specific index and constraint information
    const enhancedTables = await this.enhanceTablesWithSQLiteMetadata(db, tables, fkEnabled)
    
    // Discover relationships (only if foreign keys are enabled)
    let relationships: any[] = []
    if (fkEnabled) {
      try {
        relationships = await this.relationshipDiscovery.discoverRelationships(enhancedTables)
      } catch (error) {
        console.warn('Relationship discovery failed:', error)
        relationships = []
      }
    }
    
    // Discover views if requested
    let viewMetadata: any[] = []
    if (discoveryConfig.includeViews) {
      try {
        viewMetadata = await this.viewDiscovery.discoverViews(introspector)
      } catch (error) {
        console.warn('View discovery failed:', error)
        viewMetadata = []
      }
    }
    
    const views = viewMetadata.map(view => ({
      name: view.name,
      schema: view.schema,
      definition: view.definition || '',
      columns: view.columns || []
    }))

    return {
      tables: enhancedTables,
      relationships,
      views
    }
  }

  /**
   * Enhance table metadata with SQLite-specific information
   */
  private async enhanceTablesWithSQLiteMetadata(
    db: Kysely<any>,
    tables: any[],
    fkEnabled: boolean
  ): Promise<any[]> {
    const enhancedTables = []

    for (const table of tables) {
      try {
        // Get SQLite-specific index information
        const indexes = await this.indexDiscovery.discoverTableIndexes(db, table.name)
        
        // Get SQLite-specific constraint information from table definition
        const constraints = await this.constraintDiscovery.discoverTableConstraints(db, table.name)
        
        // Get foreign key information using PRAGMA (if enabled)
        const foreignKeys = fkEnabled 
          ? await this.constraintDiscovery.getForeignKeyInfo(db, table.name)
          : []

        // Get table size information
        const tableSize = await this.indexDiscovery.getTableSize(db, table.name)

        enhancedTables.push({
          ...table,
          indexes: indexes.map(idx => ({
            name: idx.name,
            columns: idx.columns,
            unique: idx.unique,
            isPrimary: idx.isPrimary,
            definition: idx.definition
          })),
          constraints: constraints,
          foreignKeys: foreignKeys.map(fk => ({
            name: fk.name,
            column: fk.column,
            referencedTable: fk.referencedTable,
            referencedColumn: fk.referencedColumn,
            onDelete: fk.onDelete,
            onUpdate: fk.onUpdate
          })),
          tableSize: tableSize
        })
      } catch (error) {
        console.warn(`Failed to enhance SQLite metadata for table ${table.name}:`, error)
        enhancedTables.push({
          ...table,
          indexes: [],
          constraints: [],
          foreignKeys: [],
          tableSize: undefined
        })
      }
    }

    return enhancedTables
  }

  /**
   * Get SQLite-specific capabilities
   */
  getCapabilities() {
    return {
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
    }
  }

  /**
   * Get SQLite-specific recommendations
   */
  async getRecommendations(db: Kysely<any>, tables: any[]): Promise<string[]> {
    const recommendations: string[] = []

    // Check foreign key support
    try {
      const fkEnabled = await this.constraintDiscovery.isForeignKeySupportEnabled(db)
      if (!fkEnabled) {
        recommendations.push('Consider enabling foreign key support with PRAGMA foreign_keys = ON for better data integrity')
      }
    } catch (error) {
      // If checking FK support fails, still provide the recommendation
      recommendations.push('Consider enabling foreign key support with PRAGMA foreign_keys = ON for better data integrity')
    }

    for (const table of tables) {
      try {
        // Analyze indexes
        const indexes = await this.indexDiscovery.discoverTableIndexes(db, table.name)
        const indexAnalysis = this.indexDiscovery.analyzeIndexEfficiency(indexes)
        
        recommendations.push(...indexAnalysis.recommendations)

        // Analyze constraints for compatibility
        const constraints = await this.constraintDiscovery.discoverTableConstraints(db, table.name)
        const constraintAnalysis = this.constraintDiscovery.analyzeConstraintCompatibility(constraints)
        
        recommendations.push(...constraintAnalysis.recommendations)

        // Check for table without primary key
        if (!table.primaryKey || table.primaryKey.length === 0) {
          recommendations.push(`Table ${table.name} should have a primary key for better performance`)
        }
      } catch (error) {
        console.warn(`Failed to get recommendations for SQLite table ${table.name}:`, error)
      }
    }

    return recommendations
  }

  /**
   * Get SQLite configuration recommendations
   */
  getConfigurationRecommendations(): string[] {
    return [
      'Enable foreign key constraints: PRAGMA foreign_keys = ON',
      'Use WAL mode for better concurrency: PRAGMA journal_mode = WAL',
      'Set appropriate cache size: PRAGMA cache_size = -64000',
      'Enable query optimization: PRAGMA optimize',
      'Consider using prepared statements for better performance'
    ]
  }
}
