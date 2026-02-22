"use strict";
/**
 * Database Migration Tools
 *
 * Comprehensive migration tools for NOORMME:
 * - Automated SQLite to PostgreSQL migration
 * - Schema diff and sync tools
 * - Data migration utilities
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSTGRES_TO_SQLITE_TYPES = exports.SQLITE_TO_POSTGRES_TYPES = exports.areTypesCompatible = exports.getValueTransformation = exports.mapType = exports.truncateTable = exports.verifyDataMigration = exports.migrateAllTablesData = exports.migrateTableData = exports.applySchemaSyncronization = exports.generateSyncSQL = exports.compareSchemas = exports.introspectPostgreSQLSchema = exports.introspectSQLiteSchema = exports.createMigrationManager = exports.DatabaseMigrationManager = void 0;
__exportStar(require("./migration-types.js"), exports);
__exportStar(require("./type_mapper.js"), exports);
__exportStar(require("./schema_introspector.js"), exports);
__exportStar(require("./schema_differ.js"), exports);
__exportStar(require("./data_migrator.js"), exports);
__exportStar(require("./database_migration_manager.js"), exports);
// Re-export main classes and functions for convenience
var database_migration_manager_js_1 = require("./database_migration_manager.js");
Object.defineProperty(exports, "DatabaseMigrationManager", { enumerable: true, get: function () { return database_migration_manager_js_1.DatabaseMigrationManager; } });
Object.defineProperty(exports, "createMigrationManager", { enumerable: true, get: function () { return database_migration_manager_js_1.createMigrationManager; } });
var schema_introspector_js_1 = require("./schema_introspector.js");
Object.defineProperty(exports, "introspectSQLiteSchema", { enumerable: true, get: function () { return schema_introspector_js_1.introspectSQLiteSchema; } });
Object.defineProperty(exports, "introspectPostgreSQLSchema", { enumerable: true, get: function () { return schema_introspector_js_1.introspectPostgreSQLSchema; } });
var schema_differ_js_1 = require("./schema_differ.js");
Object.defineProperty(exports, "compareSchemas", { enumerable: true, get: function () { return schema_differ_js_1.compareSchemas; } });
Object.defineProperty(exports, "generateSyncSQL", { enumerable: true, get: function () { return schema_differ_js_1.generateSyncSQL; } });
Object.defineProperty(exports, "applySchemaSyncronization", { enumerable: true, get: function () { return schema_differ_js_1.applySchemaSyncronization; } });
var data_migrator_js_1 = require("./data_migrator.js");
Object.defineProperty(exports, "migrateTableData", { enumerable: true, get: function () { return data_migrator_js_1.migrateTableData; } });
Object.defineProperty(exports, "migrateAllTablesData", { enumerable: true, get: function () { return data_migrator_js_1.migrateAllTablesData; } });
Object.defineProperty(exports, "verifyDataMigration", { enumerable: true, get: function () { return data_migrator_js_1.verifyDataMigration; } });
Object.defineProperty(exports, "truncateTable", { enumerable: true, get: function () { return data_migrator_js_1.truncateTable; } });
var type_mapper_js_1 = require("./type_mapper.js");
Object.defineProperty(exports, "mapType", { enumerable: true, get: function () { return type_mapper_js_1.mapType; } });
Object.defineProperty(exports, "getValueTransformation", { enumerable: true, get: function () { return type_mapper_js_1.getValueTransformation; } });
Object.defineProperty(exports, "areTypesCompatible", { enumerable: true, get: function () { return type_mapper_js_1.areTypesCompatible; } });
Object.defineProperty(exports, "SQLITE_TO_POSTGRES_TYPES", { enumerable: true, get: function () { return type_mapper_js_1.SQLITE_TO_POSTGRES_TYPES; } });
Object.defineProperty(exports, "POSTGRES_TO_SQLITE_TYPES", { enumerable: true, get: function () { return type_mapper_js_1.POSTGRES_TO_SQLITE_TYPES; } });
