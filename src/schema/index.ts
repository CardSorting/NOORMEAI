// Main schema discovery class
export { SchemaDiscovery } from './schema-discovery.js'

// Core Components
export { SchemaDiscoveryCoordinator } from './core/coordinators/schema-discovery.coordinator.js'
export { DiscoveryFactory } from './core/factories/discovery-factory.js'

// Core Discovery Services
export { TableMetadataDiscovery } from './core/discovery/table-metadata-discovery.js'
export { RelationshipDiscovery } from './core/discovery/relationship-discovery.js'
export { ViewDiscovery } from './core/discovery/view-discovery.js'

// Core Utilities and Types
export { TypeMapper } from './core/utils/type-mapper.js'
export { NameGenerator } from './core/utils/name-generator.js'
export * from './core/types/schema-discovery-types.js'

// SQLite Dialect
export { SQLiteDiscoveryCoordinator } from './dialects/sqlite/sqlite-discovery.coordinator.js'
export { SQLiteIndexDiscovery } from './dialects/sqlite/discovery/sqlite-index-discovery.js'
export { SQLiteConstraintDiscovery } from './dialects/sqlite/discovery/sqlite-constraint-discovery.js'
export { SQLiteSchemaIntrospector } from './dialects/sqlite/introspection/sqlite-schema-introspector.js'

// Schema Builders
export * from './builders/index.js'
