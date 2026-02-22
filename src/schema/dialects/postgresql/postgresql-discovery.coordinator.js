"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDiscoveryCoordinator = void 0;
const postgresql_introspector_js_1 = require("../../../dialect/postgresql/postgresql-introspector.js");
const table_metadata_discovery_js_1 = require("../../core/discovery/table-metadata-discovery.js");
const relationship_discovery_js_1 = require("../../core/discovery/relationship-discovery.js");
const view_discovery_js_1 = require("../../core/discovery/view-discovery.js");
/**
 * PostgreSQL-specific schema discovery coordinator.
 * Leverages standard core discovery logic with PostgreSQL-specific introspector.
 */
class PostgresDiscoveryCoordinator {
    static instance;
    tableDiscovery;
    relationshipDiscovery;
    viewDiscovery;
    constructor() {
        this.tableDiscovery = table_metadata_discovery_js_1.TableMetadataDiscovery.getInstance();
        this.relationshipDiscovery = relationship_discovery_js_1.RelationshipDiscovery.getInstance();
        this.viewDiscovery = view_discovery_js_1.ViewDiscovery.getInstance();
    }
    static getInstance() {
        if (!PostgresDiscoveryCoordinator.instance) {
            PostgresDiscoveryCoordinator.instance = new PostgresDiscoveryCoordinator();
        }
        return PostgresDiscoveryCoordinator.instance;
    }
    /**
     * Discover complete PostgreSQL schema
     */
    async discoverSchema(db, config = {}) {
        const introspector = new postgresql_introspector_js_1.PostgresIntrospector(db);
        const discoveryConfig = {
            excludeTables: config.excludeTables,
            includeViews: config.includeViews,
            customTypeMappings: config.customTypeMappings
        };
        // Discover tables
        let tables = [];
        try {
            tables = await this.tableDiscovery.discoverTables(introspector, discoveryConfig);
        }
        catch (error) {
            console.warn('PostgreSQL table discovery failed:', error);
            tables = [];
        }
        // Discover relationships
        let relationships = [];
        try {
            relationships = await this.relationshipDiscovery.discoverRelationships(tables);
        }
        catch (error) {
            console.warn('PostgreSQL relationship discovery failed:', error);
            relationships = [];
        }
        // Discover views if requested
        let views = [];
        if (discoveryConfig.includeViews) {
            try {
                const viewMetadata = await this.viewDiscovery.discoverViews(introspector);
                views = viewMetadata.map(view => ({
                    name: view.name,
                    schema: view.schema,
                    definition: view.definition || '',
                    columns: view.columns || []
                }));
            }
            catch (error) {
                console.warn('PostgreSQL view discovery failed:', error);
                views = [];
            }
        }
        return {
            tables,
            relationships,
            views
        };
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
        };
    }
    /**
     * Get PostgreSQL configuration recommendations
     */
    getConfigurationRecommendations() {
        return [
            'Use connection pooling for better performance',
            'Enable SSL for secure database connections',
            'Consider using JSONB for unstructured data',
            'Use appropriate isolation levels for transactions',
            'Monitor slow queries using pg_stat_statements'
        ];
    }
}
exports.PostgresDiscoveryCoordinator = PostgresDiscoveryCoordinator;
