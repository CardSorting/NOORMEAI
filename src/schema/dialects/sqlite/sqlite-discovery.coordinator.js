"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteDiscoveryCoordinator = void 0;
const sqlite_introspector_js_1 = require("../../../dialect/sqlite/sqlite-introspector.js");
const table_metadata_discovery_js_1 = require("../../core/discovery/table-metadata-discovery.js");
const relationship_discovery_js_1 = require("../../core/discovery/relationship-discovery.js");
const view_discovery_js_1 = require("../../core/discovery/view-discovery.js");
const sqlite_index_discovery_js_1 = require("./discovery/sqlite-index-discovery.js");
const sqlite_constraint_discovery_js_1 = require("./discovery/sqlite-constraint-discovery.js");
/**
 * SQLite-specific schema discovery coordinator
 */
class SQLiteDiscoveryCoordinator {
    static instance;
    tableDiscovery;
    relationshipDiscovery;
    viewDiscovery;
    indexDiscovery;
    constraintDiscovery;
    constructor() {
        this.tableDiscovery = table_metadata_discovery_js_1.TableMetadataDiscovery.getInstance();
        this.relationshipDiscovery = relationship_discovery_js_1.RelationshipDiscovery.getInstance();
        this.viewDiscovery = view_discovery_js_1.ViewDiscovery.getInstance();
        this.indexDiscovery = sqlite_index_discovery_js_1.SQLiteIndexDiscovery.getInstance();
        this.constraintDiscovery = sqlite_constraint_discovery_js_1.SQLiteConstraintDiscovery.getInstance();
    }
    static getInstance() {
        if (!SQLiteDiscoveryCoordinator.instance) {
            SQLiteDiscoveryCoordinator.instance = new SQLiteDiscoveryCoordinator();
        }
        return SQLiteDiscoveryCoordinator.instance;
    }
    /**
     * Discover complete SQLite schema
     */
    async discoverSchema(db, config = {}) {
        const introspector = new sqlite_introspector_js_1.SqliteIntrospector(db);
        const discoveryConfig = {
            excludeTables: config.excludeTables,
            includeViews: config.includeViews,
            customTypeMappings: config.customTypeMappings
        };
        // Check if foreign keys are enabled
        let fkEnabled = false;
        try {
            fkEnabled = await this.constraintDiscovery.isForeignKeySupportEnabled(db);
        }
        catch (error) {
            console.warn('Failed to check foreign key support:', error);
            fkEnabled = false;
        }
        // Discover tables with SQLite-specific metadata
        let tables = [];
        try {
            tables = await this.tableDiscovery.discoverTables(introspector, discoveryConfig);
        }
        catch (error) {
            console.warn('Table discovery failed:', error);
            tables = [];
        }
        // Enhance tables with SQLite-specific index and constraint information
        const enhancedTables = await this.enhanceTablesWithSQLiteMetadata(db, tables, fkEnabled);
        // Discover relationships (only if foreign keys are enabled)
        let relationships = [];
        if (fkEnabled) {
            try {
                relationships = await this.relationshipDiscovery.discoverRelationships(enhancedTables);
            }
            catch (error) {
                console.warn('Relationship discovery failed:', error);
                relationships = [];
            }
        }
        // Discover views if requested
        let viewMetadata = [];
        if (discoveryConfig.includeViews) {
            try {
                viewMetadata = await this.viewDiscovery.discoverViews(introspector);
            }
            catch (error) {
                console.warn('View discovery failed:', error);
                viewMetadata = [];
            }
        }
        const views = viewMetadata.map(view => ({
            name: view.name,
            schema: view.schema,
            definition: view.definition || '',
            columns: view.columns || []
        }));
        return {
            tables: enhancedTables,
            relationships,
            views
        };
    }
    /**
     * Enhance table metadata with SQLite-specific information
     */
    async enhanceTablesWithSQLiteMetadata(db, tables, fkEnabled) {
        const enhancedTables = [];
        for (const table of tables) {
            try {
                // Get SQLite-specific index information
                const indexes = await this.indexDiscovery.discoverTableIndexes(db, table.name);
                // Get SQLite-specific constraint information from table definition
                const constraints = await this.constraintDiscovery.discoverTableConstraints(db, table.name);
                // Get foreign key information using PRAGMA (if enabled)
                const foreignKeys = fkEnabled
                    ? await this.constraintDiscovery.getForeignKeyInfo(db, table.name)
                    : [];
                // Get table size information
                const tableSize = await this.indexDiscovery.getTableSize(db, table.name);
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
                });
            }
            catch (error) {
                console.warn(`Failed to enhance SQLite metadata for table ${table.name}:`, error);
                enhancedTables.push({
                    ...table,
                    indexes: [],
                    constraints: [],
                    foreignKeys: [],
                    tableSize: undefined
                });
            }
        }
        return enhancedTables;
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
        };
    }
    /**
     * Get SQLite-specific recommendations
     */
    async getRecommendations(db, tables) {
        const recommendations = [];
        // Check foreign key support
        try {
            const fkEnabled = await this.constraintDiscovery.isForeignKeySupportEnabled(db);
            if (!fkEnabled) {
                recommendations.push('Consider enabling foreign key support with PRAGMA foreign_keys = ON for better data integrity');
            }
        }
        catch (error) {
            // If checking FK support fails, still provide the recommendation
            recommendations.push('Consider enabling foreign key support with PRAGMA foreign_keys = ON for better data integrity');
        }
        for (const table of tables) {
            try {
                // Analyze indexes
                const indexes = await this.indexDiscovery.discoverTableIndexes(db, table.name);
                const indexAnalysis = this.indexDiscovery.analyzeIndexEfficiency(indexes);
                recommendations.push(...indexAnalysis.recommendations);
                // Analyze constraints for compatibility
                const constraints = await this.constraintDiscovery.discoverTableConstraints(db, table.name);
                const constraintAnalysis = this.constraintDiscovery.analyzeConstraintCompatibility(constraints);
                recommendations.push(...constraintAnalysis.recommendations);
                // Check for table without primary key
                if (!table.primaryKey || table.primaryKey.length === 0) {
                    recommendations.push(`Table ${table.name} should have a primary key for better performance`);
                }
            }
            catch (error) {
                console.warn(`Failed to get recommendations for SQLite table ${table.name}:`, error);
            }
        }
        return recommendations;
    }
    /**
     * Get SQLite configuration recommendations
     */
    getConfigurationRecommendations() {
        return [
            'Enable foreign key constraints: PRAGMA foreign_keys = ON',
            'Use WAL mode for better concurrency: PRAGMA journal_mode = WAL',
            'Set appropriate cache size: PRAGMA cache_size = -64000',
            'Enable query optimization: PRAGMA optimize',
            'Consider using prepared statements for better performance'
        ];
    }
}
exports.SQLiteDiscoveryCoordinator = SQLiteDiscoveryCoordinator;
