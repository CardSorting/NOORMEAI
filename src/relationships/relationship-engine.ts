import type { Kysely } from '../kysely.js'
import { RelationshipInfo, PerformanceConfig } from '../types'

/**
 * Relationship engine that handles foreign key relationships
 */
export class RelationshipEngine {
  private relationships: RelationshipInfo[] = []

  constructor(
    private db: Kysely<any>,
    private config: PerformanceConfig = {}
  ) {}

  /**
   * Initialize the relationship engine with schema relationships
   */
  initialize(relationships: RelationshipInfo[]): void {
    this.relationships = relationships
  }

  /**
   * Load relationships for entities
   */
  async loadRelationships<T>(
    entities: T[], 
    relations: string[]
  ): Promise<void> {
    if (!this.config.enableBatchLoading) {
      // Load relationships one by one
      for (const entity of entities) {
        await this.loadEntityRelationships(entity, relations)
      }
      return
    }

    // Batch load relationships for performance
    const batchSize = this.config.maxBatchSize || 100
    
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize)
      await this.batchLoadRelationships(batch, relations)
    }
  }

  /**
   * Load relationships for a single entity
   */
  private async loadEntityRelationships<T>(entity: T, relations: string[]): Promise<void> {
    for (const relationName of relations) {
      const relationship = this.relationships.find(r => r.name === relationName)
      if (!relationship) continue

      await this.loadSingleRelationship(entity, relationship)
    }
  }

  /**
   * Batch load relationships for multiple entities
   */
  private async batchLoadRelationships<T>(entities: T[], relations: string[]): Promise<void> {
    for (const relationName of relations) {
      const relationship = this.relationships.find(r => r.name === relationName)
      if (!relationship) continue

      await this.batchLoadSingleRelationship(entities, relationship)
    }
  }

  /**
   * Load a single relationship for an entity
   */
  private async loadSingleRelationship<T>(entity: T, relationship: RelationshipInfo): Promise<void> {
    const entityValue = (entity as any)[relationship.fromColumn]
    if (!entityValue) return

    let relatedData: any

    switch (relationship.type) {
      case 'many-to-one':
        relatedData = await this.db
          .selectFrom(relationship.toTable)
          .selectAll()
          .where(relationship.toColumn as any, '=', entityValue)
          .executeTakeFirst()
        break

      case 'one-to-many':
        relatedData = await this.db
          .selectFrom(relationship.toTable)
          .selectAll()
          .where(relationship.toColumn as any, '=', entityValue)
          .execute()
        break

      case 'many-to-many':
        relatedData = await this.loadManyToManyRelationship(entity, relationship)
        break
    }

    (entity as any)[relationship.name] = relatedData
  }

  /**
   * Batch load a single relationship for multiple entities
   */
  private async batchLoadSingleRelationship<T>(entities: T[], relationship: RelationshipInfo): Promise<void> {
    const entityValues = entities
      .map(e => (e as any)[relationship.fromColumn])
      .filter(v => v !== undefined && v !== null)

    if (entityValues.length === 0) return

    let relatedData: any[]

    switch (relationship.type) {
      case 'many-to-one':
        relatedData = await this.db
          .selectFrom(relationship.toTable)
          .selectAll()
          .where(relationship.toColumn as any, 'in', entityValues)
          .execute()
        break

      case 'one-to-many':
        relatedData = await this.db
          .selectFrom(relationship.toTable)
          .selectAll()
          .where(relationship.toColumn as any, 'in', entityValues)
          .execute()
        break

      case 'many-to-many':
        relatedData = await this.batchLoadManyToManyRelationship(entities, relationship)
        break

      default:
        relatedData = []
    }

    // Group related data by foreign key value
    const groupedData = new Map<any, any[]>()
    for (const item of relatedData) {
      const key = item[relationship.toColumn]
      if (!groupedData.has(key)) {
        groupedData.set(key, [])
      }
      groupedData.get(key)!.push(item)
    }

    // Assign related data to entities
    for (const entity of entities) {
      const entityValue = (entity as any)[relationship.fromColumn]
      if (entityValue) {
        let entityRelatedData: any
        if (relationship.type === 'many-to-one') {
          entityRelatedData = groupedData.get(entityValue)?.[0]
        } else {
          entityRelatedData = groupedData.get(entityValue) || []
        }
        (entity as any)[relationship.name] = entityRelatedData
      }
    }
  }

  /**
   * Load many-to-many relationship
   */
  private async loadManyToManyRelationship<T>(entity: T, relationship: RelationshipInfo): Promise<any[]> {
    if (!relationship.throughTable) {
      throw new Error('Many-to-many relationship requires throughTable')
    }

    const entityValue = (entity as any)[relationship.fromColumn]
    if (!entityValue) return []

    return await this.db
      .selectFrom(relationship.toTable)
      .innerJoin(
        relationship.throughTable,
        relationship.throughToColumn!,
        `${relationship.toTable}.${relationship.toColumn}`
      )
      .where(relationship.throughFromColumn as any, '=', entityValue)
      .selectAll(relationship.toTable)
      .execute()
  }

  /**
   * Batch load many-to-many relationships
   */
  private async batchLoadManyToManyRelationship<T>(entities: T[], relationship: RelationshipInfo): Promise<any[]> {
    if (!relationship.throughTable) {
      throw new Error('Many-to-many relationship requires throughTable')
    }

    const entityValues = entities
      .map(e => (e as any)[relationship.fromColumn])
      .filter(v => v !== undefined && v !== null)

    if (entityValues.length === 0) return []

    return await this.db
      .selectFrom(relationship.toTable)
      .innerJoin(
        relationship.throughTable,
        relationship.throughToColumn!,
        `${relationship.toTable}.${relationship.toColumn}`
      )
      .where(relationship.throughFromColumn as any, 'in', entityValues)
      .selectAll(relationship.toTable)
      .execute()
  }

  /**
   * Get relationships for a specific table
   */
  getRelationshipsForTable(tableName: string): RelationshipInfo[] {
    return this.relationships.filter(r => r.fromTable === tableName)
  }

  /**
   * Get all relationships
   */
  getAllRelationships(): RelationshipInfo[] {
    return [...this.relationships]
  }

  /**
   * Add a new relationship
   */
  addRelationship(relationship: RelationshipInfo): void {
    this.relationships.push(relationship)
  }

  /**
   * Remove a relationship
   */
  removeRelationship(relationshipName: string): void {
    this.relationships = this.relationships.filter(r => r.name !== relationshipName)
  }
}
