"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaDiscoveryCoordinator = void 0;
const discovery_factory_js_1 = require("../factories/discovery-factory.js");
/**
 * Central coordinator for schema discovery operations
 * Uses factory pattern to create database-specific discovery services
 */
class SchemaDiscoveryCoordinator {
    static instance;
    factory;
    currentDialect = 'sqlite';
    constructor() {
        this.factory = discovery_factory_js_1.DiscoveryFactory.getInstance();
    }
    static getInstance() {
        if (!SchemaDiscoveryCoordinator.instance) {
            SchemaDiscoveryCoordinator.instance = new SchemaDiscoveryCoordinator();
        }
        return SchemaDiscoveryCoordinator.instance;
    }
    /**
     * Discover the complete database schema using dialect-specific coordinator
     */
    async discoverSchema(db, config = {}, dialect) {
        // Determine the dialect - handle both string and dialect objects
        const dialectName = typeof dialect === 'string'
            ? dialect
            : dialect?.name || 'sqlite';
        this.currentDialect = dialectName;
        // Check if dialect is supported
        if (!this.factory.isDialectSupported(dialectName)) {
            throw new Error(`Unsupported dialect: ${dialectName}`);
        }
        // Create dialect-specific discovery coordinator
        const coordinator = this.factory.createDiscoveryCoordinator(dialectName);
        // Delegate to dialect-specific coordinator
        return await coordinator.discoverSchema(db, config);
    }
    /**
     * Get the discovery factory instance
     */
    getFactory() {
        return this.factory;
    }
    /**
     * Get current dialect
     */
    getCurrentDialect() {
        return this.currentDialect;
    }
    /**
     * Get dialect capabilities
     */
    getDialectCapabilities() {
        return this.factory.getDialectCapabilities(this.currentDialect);
    }
    /**
     * Check if a dialect is supported
     */
    isDialectSupported(dialect) {
        return this.factory.isDialectSupported(dialect);
    }
}
exports.SchemaDiscoveryCoordinator = SchemaDiscoveryCoordinator;
