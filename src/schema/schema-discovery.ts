import type { Kysely } from '../kysely.js'
import { SchemaInfo, IntrospectionConfig } from '../types'
import type { Dialect } from '../dialect/dialect.js'
import { SchemaDiscoveryCoordinator } from './core/coordinators/schema-discovery.coordinator.js'

/**
 * Schema discovery engine that introspects database structure
 * This is now a thin wrapper around the SchemaDiscoveryCoordinator
 */
export class SchemaDiscovery {
  private coordinator: SchemaDiscoveryCoordinator

  constructor(
    private db: Kysely<any>,
    private config: IntrospectionConfig = {},
    private dialect?: Dialect
  ) {
    this.coordinator = SchemaDiscoveryCoordinator.getInstance()
  }

  /**
   * Discover the complete database schema
   */
  async discoverSchema(): Promise<SchemaInfo> {
    return await this.coordinator.discoverSchema(this.db, this.config, this.dialect)
  }

  /**
   * Get the coordinator instance for advanced operations
   */
  getCoordinator(): SchemaDiscoveryCoordinator {
    return this.coordinator
  }
}
