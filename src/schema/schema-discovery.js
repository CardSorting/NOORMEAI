"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaDiscovery = void 0;
const schema_discovery_coordinator_js_1 = require("./core/coordinators/schema-discovery.coordinator.js");
/**
 * Schema discovery engine that introspects database structure
 * This is now a thin wrapper around the SchemaDiscoveryCoordinator
 */
class SchemaDiscovery {
    db;
    config;
    dialect;
    coordinator;
    constructor(db, config = {}, dialect) {
        this.db = db;
        this.config = config;
        this.dialect = dialect;
        this.coordinator = schema_discovery_coordinator_js_1.SchemaDiscoveryCoordinator.getInstance();
    }
    /**
     * Discover the complete database schema
     */
    async discoverSchema() {
        return await this.coordinator.discoverSchema(this.db, this.config, this.dialect);
    }
    /**
     * Get the coordinator instance for advanced operations
     */
    getCoordinator() {
        return this.coordinator;
    }
}
exports.SchemaDiscovery = SchemaDiscovery;
