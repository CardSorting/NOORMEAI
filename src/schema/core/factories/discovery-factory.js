"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryFactory = void 0;
const table_metadata_discovery_js_1 = require("../discovery/table-metadata-discovery.js");
const relationship_discovery_js_1 = require("../discovery/relationship-discovery.js");
const view_discovery_js_1 = require("../discovery/view-discovery.js");
const sqlite_discovery_coordinator_js_1 = require("../../dialects/sqlite/sqlite-discovery.coordinator.js");
const sqlite_index_discovery_js_1 = require("../../dialects/sqlite/discovery/sqlite-index-discovery.js");
const sqlite_constraint_discovery_js_1 = require("../../dialects/sqlite/discovery/sqlite-constraint-discovery.js");
const postgresql_discovery_coordinator_js_1 = require("../../dialects/postgresql/postgresql-discovery.coordinator.js");
/**
 * Factory for creating database-specific discovery services
 */
class DiscoveryFactory {
    static instance;
    static getInstance() {
        if (!DiscoveryFactory.instance) {
            DiscoveryFactory.instance = new DiscoveryFactory();
        }
        return DiscoveryFactory.instance;
    }
    /**
     * Create table discovery service
     */
    createTableDiscovery() {
        return table_metadata_discovery_js_1.TableMetadataDiscovery.getInstance();
    }
    /**
     * Create relationship discovery service
     */
    createRelationshipDiscovery() {
        return relationship_discovery_js_1.RelationshipDiscovery.getInstance();
    }
    /**
     * Create view discovery service
     */
    createViewDiscovery() {
        return view_discovery_js_1.ViewDiscovery.getInstance();
    }
    /**
     * Create index discovery service based on dialect
     */
    createIndexDiscovery(dialect) {
        switch (dialect.trim().toLowerCase()) {
            case 'sqlite':
                return sqlite_index_discovery_js_1.SQLiteIndexDiscovery.getInstance();
            case 'postgres':
            case 'postgresql':
                // PostgreSQL uses standard information_schema, no specialized service needed yet
                return null;
            default:
                throw new Error(`Unsupported dialect for index discovery: ${dialect}`);
        }
    }
    /**
     * Create constraint discovery service based on dialect
     */
    createConstraintDiscovery(dialect) {
        switch (dialect.trim().toLowerCase()) {
            case 'sqlite':
                return sqlite_constraint_discovery_js_1.SQLiteConstraintDiscovery.getInstance();
            case 'postgres':
            case 'postgresql':
                // PostgreSQL uses standard information_schema, no specialized service needed yet
                return null;
            default:
                throw new Error(`Unsupported dialect for constraint discovery: ${dialect}`);
        }
    }
    /**
     * Create dialect-specific discovery coordinator
     */
    createDiscoveryCoordinator(dialect) {
        switch (dialect.trim().toLowerCase()) {
            case 'sqlite':
                return sqlite_discovery_coordinator_js_1.SQLiteDiscoveryCoordinator.getInstance();
            case 'postgres':
            case 'postgresql':
                return postgresql_discovery_coordinator_js_1.PostgresDiscoveryCoordinator.getInstance();
            default:
                throw new Error(`Unsupported dialect for discovery coordinator: ${dialect}`);
        }
    }
    /**
     * Create all discovery services for a specific dialect
     */
    createDiscoveryServices(dialect) {
        return {
            tableDiscovery: this.createTableDiscovery(),
            relationshipDiscovery: this.createRelationshipDiscovery(),
            viewDiscovery: this.createViewDiscovery(),
            indexDiscovery: this.createIndexDiscovery(dialect),
            constraintDiscovery: this.createConstraintDiscovery(dialect)
        };
    }
    /**
     * Get supported dialects
     */
    getSupportedDialects() {
        return ['sqlite', 'postgres', 'postgresql'];
    }
    /**
     * Check if a dialect is supported
     */
    isDialectSupported(dialect) {
        return this.getSupportedDialects().includes(dialect.trim().toLowerCase());
    }
    /**
     * Get dialect-specific capabilities
     */
    getDialectCapabilities(dialect) {
        switch (dialect.trim().toLowerCase()) {
            case 'sqlite':
                return {
                    supportsViews: true,
                    supportsIndexes: true,
                    supportsConstraints: true,
                    supportsForeignKeys: true,
                    supportsCheckConstraints: true,
                    supportsDeferredConstraints: false
                };
            case 'postgres':
            case 'postgresql':
                return {
                    supportsViews: true,
                    supportsIndexes: true,
                    supportsConstraints: true,
                    supportsForeignKeys: true,
                    supportsCheckConstraints: true,
                    supportsDeferredConstraints: true
                };
            default:
                return {
                    supportsViews: false,
                    supportsIndexes: false,
                    supportsConstraints: false,
                    supportsForeignKeys: false,
                    supportsCheckConstraints: false,
                    supportsDeferredConstraints: false
                };
        }
    }
}
exports.DiscoveryFactory = DiscoveryFactory;
