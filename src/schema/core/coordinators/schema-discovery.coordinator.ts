import type { Kysely } from '../../../kysely.js'
import { SchemaInfo, IntrospectionConfig } from '../../../types/index.js'
import type { Dialect } from '../../../dialect/dialect.js'
import { SchemaDiscoveryConfig } from '../types/schema-discovery-types.js'
import { DiscoveryFactory } from '../factories/discovery-factory.js'

/**
 * Central coordinator for schema discovery operations
 * Uses factory pattern to create database-specific discovery services
 */
export class SchemaDiscoveryCoordinator {
  private static instance: SchemaDiscoveryCoordinator
  private factory: DiscoveryFactory
  private currentDialect: string = 'sqlite'

  private constructor() {
    this.factory = DiscoveryFactory.getInstance()
  }

  static getInstance(): SchemaDiscoveryCoordinator {
    if (!SchemaDiscoveryCoordinator.instance) {
      SchemaDiscoveryCoordinator.instance = new SchemaDiscoveryCoordinator()
    }
    return SchemaDiscoveryCoordinator.instance
  }

  /**
   * Discover the complete database schema using dialect-specific coordinator
   */
  async discoverSchema(
    db: Kysely<any>,
    config: IntrospectionConfig = {},
    dialect?: Dialect
  ): Promise<SchemaInfo> {
    // Determine the dialect - handle both string and dialect objects
    const dialectName = typeof dialect === 'string' 
      ? dialect 
      : (dialect as any)?.name || 'sqlite'
    this.currentDialect = dialectName

    // Check if dialect is supported
    if (!this.factory.isDialectSupported(dialectName)) {
      throw new Error(`Unsupported dialect: ${dialectName}`)
    }

    // Create dialect-specific discovery coordinator
    const coordinator = this.factory.createDiscoveryCoordinator(dialectName)
    
    // Delegate to dialect-specific coordinator
    return await coordinator.discoverSchema(db, config)
  }

  /**
   * Get the discovery factory instance
   */
  getFactory(): DiscoveryFactory {
    return this.factory
  }

  /**
   * Get current dialect
   */
  getCurrentDialect(): string {
    return this.currentDialect
  }

  /**
   * Get dialect capabilities
   */
  getDialectCapabilities(): ReturnType<DiscoveryFactory['getDialectCapabilities']> {
    return this.factory.getDialectCapabilities(this.currentDialect)
  }

  /**
   * Check if a dialect is supported
   */
  isDialectSupported(dialect: string): boolean {
    return this.factory.isDialectSupported(dialect)
  }
}
