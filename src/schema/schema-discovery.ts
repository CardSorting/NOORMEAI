import type { Kysely } from '../kysely.js'
import { SchemaInfo, TableInfo, RelationshipInfo, ViewInfo, IntrospectionConfig } from '../types/index.js'
import type { Dialect } from '../dialect/dialect.js'
import { TypeMapper } from './core/utils/type-mapper.js'
import { NameGenerator } from './core/utils/name-generator.js'

/**
 * Lightweight Schema Discovery Engine.
 * Introspects DB schema without deep nested factories.
 */
export class SchemaDiscovery {
  constructor(
    private db: Kysely<any>,
    private config: IntrospectionConfig = {},
    private dialect?: Dialect,
  ) { }

  /**
   * Discover the complete database schema
   */
  async discoverSchema(): Promise<SchemaInfo> {
    const introspector = this.dialect ? this.dialect.createIntrospector(this.db) : this.db.introspection

    // 1. Discover Tables
    const dbTables = await introspector.getTables()
    const tables: TableInfo[] = []

    for (const dbTable of dbTables) {
      if (this.config.excludeTables?.includes(dbTable.name)) {
        continue
      }

      const columns = await introspector.getColumns(dbTable.name).catch(() => [])
      const indexes = await introspector.getIndexes(dbTable.name).catch(() => [])
      const foreignKeys = await introspector.getForeignKeys(dbTable.name).catch(() => [])

      const primaryKeyColumns = columns
        .filter((col: any) => col.isPrimaryKey)
        .map((col: any) => col.name)

      tables.push({
        name: dbTable.name,
        schema: dbTable.schema,
        columns: columns.map((col: any) => TypeMapper.mapColumnInfo(col, this.config.customTypeMappings)),
        primaryKey: primaryKeyColumns.length > 0 ? primaryKeyColumns : undefined,
        indexes: indexes.map((idx: any) => ({
          name: idx.name,
          columns: idx.columns,
          unique: idx.unique,
        })),
        foreignKeys: foreignKeys.map((fk: any) => ({
          name: fk.name,
          column: fk.column,
          referencedTable: fk.referencedTable,
          referencedColumn: fk.referencedColumn,
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate,
        })),
      })
    }

    // 2. Discover Relationships
    const relationships: RelationshipInfo[] = []

    // Pass 1: standard 1:1 and 1:N
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        const referencedTable = tables.find((t) => t.name === fk.referencedTable)
        if (!referencedTable) continue

        const relationshipName = NameGenerator.generateRelationshipName(fk.column, fk.referencedTable)
        const isUnique = referencedTable.primaryKey?.includes(fk.referencedColumn) || false
        const relationshipType = isUnique ? 'many-to-one' : 'one-to-many'

        relationships.push({
          name: relationshipName,
          type: relationshipType,
          fromTable: table.name,
          fromColumn: fk.column,
          toTable: fk.referencedTable,
          toColumn: fk.referencedColumn,
        })

        const reverseName = NameGenerator.generateReverseRelationshipName(table.name, fk.column)
        relationships.push({
          name: reverseName,
          type: relationshipType === 'many-to-one' ? 'one-to-many' : 'many-to-one',
          fromTable: fk.referencedTable,
          fromColumn: fk.referencedColumn,
          toTable: table.name,
          toColumn: fk.column,
        })
      }
    }

    // Pass 2: junction tables
    for (const table of tables) {
      if (table.foreignKeys.length === 2) {
        const fkColumns = new Set(table.foreignKeys.map((fk) => fk.column))
        const pkColumns = new Set(table.primaryKey || [])
        const otherColumns = table.columns.filter((col) => !fkColumns.has(col.name) && !pkColumns.has(col.name))

        if (otherColumns.length <= 2) {
          const fk1 = table.foreignKeys[0]
          const fk2 = table.foreignKeys[1]

          if (fk1.referencedTable !== fk2.referencedTable) {
            relationships.push({
              name: NameGenerator.generateRelationshipName(table.name, fk2.referencedTable),
              type: 'many-to-many',
              fromTable: fk1.referencedTable,
              fromColumn: fk1.referencedColumn,
              toTable: fk2.referencedTable,
              toColumn: fk2.referencedColumn,
              throughTable: table.name,
              throughFromColumn: fk1.column,
              throughToColumn: fk2.column,
            })

            relationships.push({
              name: NameGenerator.generateRelationshipName(table.name, fk1.referencedTable),
              type: 'many-to-many',
              fromTable: fk2.referencedTable,
              fromColumn: fk2.referencedColumn,
              toTable: fk1.referencedTable,
              toColumn: fk1.referencedColumn,
              throughTable: table.name,
              throughFromColumn: fk2.column,
              throughToColumn: fk1.column,
            })
          }
        }
      }
    }

    // 3. Discover Views
    let views: ViewInfo[] = []
    if (this.config.includeViews && typeof (introspector as any).getViews === 'function') {
      try {
        const introspectedViews = await (introspector as any).getViews() || []
        views = introspectedViews.map((v: any) => ({
          name: v.name,
          schema: v.schema,
          definition: v.definition || '',
          columns: v.columns || []
        }))
      } catch (err) {
        console.warn('View discovery failed or not supported by this dialect.')
      }
    }

    return {
      tables,
      relationships,
      views,
    }
  }
}
