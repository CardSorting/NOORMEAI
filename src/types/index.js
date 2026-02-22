"use strict";
/**
 * Core type definitions for NOORMME
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNOORMConfig = validateNOORMConfig;
// Configuration validation function type
function validateNOORMConfig(config) {
    if (!config.dialect) {
        throw new Error('Dialect is required');
    }
    if (!config.connection?.database) {
        throw new Error('Database path is required');
    }
    // Validate dialect-specific requirements
    if (config.dialect === 'sqlite') {
        if (!config.connection.database.endsWith('.db') && !config.connection.database.endsWith('.sqlite')) {
            console.warn('SQLite database path should typically end with .db or .sqlite');
        }
    }
    // Validate performance settings
    if (config.performance?.maxBatchSize && config.performance.maxBatchSize <= 0) {
        throw new Error('maxBatchSize must be greater than 0');
    }
    if (config.performance?.maxCacheSize && config.performance.maxCacheSize <= 0) {
        throw new Error('maxCacheSize must be greater than 0');
    }
}
