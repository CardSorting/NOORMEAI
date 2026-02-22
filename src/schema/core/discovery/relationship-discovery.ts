import { TableInfo, RelationshipInfo } from '../../../types/index.js'
import { NameGenerator } from '../utils/name-generator.js'

/**
 * Specialized service for discovering relationships between tables
 */
export class RelationshipDiscovery {
  private static instance: RelationshipDiscovery

  static getInstance(): RelationshipDiscovery {
    if (!RelationshipDiscovery.instance) {
      RelationshipDiscovery.instance = new RelationshipDiscovery()
    }
    return RelationshipDiscovery.instance
  }

  /**
   * Discover relationships between tables
   */
  async discoverRelationships(
    tables: TableInfo[],
  ): Promise<RelationshipInfo[]> {
    const relationships: RelationshipInfo[] = []

    // 1. Discover basic 1:1 and 1:N relationships from foreign keys
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        // Find the referenced table
        const referencedTable = tables.find(
          (t) => t.name === fk.referencedTable,
        )
        if (!referencedTable) continue

        // Create relationship name based on column name
        const relationshipName = NameGenerator.generateRelationshipName(
          fk.column,
          fk.referencedTable,
        )

        // Determine relationship type
        const isUnique =
          referencedTable.primaryKey?.includes(fk.referencedColumn) || false
        const relationshipType = isUnique ? 'many-to-one' : 'one-to-many'

        relationships.push({
          name: relationshipName,
          type: relationshipType,
          fromTable: table.name,
          fromColumn: fk.column,
          toTable: fk.referencedTable,
          toColumn: fk.referencedColumn,
        })

        // Add reverse relationship
        const reverseName = NameGenerator.generateReverseRelationshipName(
          table.name,
          fk.column,
        )
        relationships.push({
          name: reverseName,
          type:
            relationshipType === 'many-to-one' ? 'one-to-many' : 'many-to-one',
          fromTable: fk.referencedTable,
          fromColumn: fk.referencedColumn,
          toTable: table.name,
          toColumn: fk.column,
        })
      }
    }

    // 2. Discover many-to-many relationships through junction tables
    for (const table of tables) {
      if (this.isJunctionTable(table)) {
        const fk1 = table.foreignKeys[0]
        const fk2 = table.foreignKeys[1]

        if (fk1.referencedTable !== fk2.referencedTable) {
          // A -> B via Table
          relationships.push({
            name: NameGenerator.generateRelationshipName(
              table.name,
              fk2.referencedTable,
            ),
            type: 'many-to-many',
            fromTable: fk1.referencedTable,
            fromColumn: fk1.referencedColumn,
            toTable: fk2.referencedTable,
            toColumn: fk2.referencedColumn,
            throughTable: table.name,
            throughFromColumn: fk1.column,
            throughToColumn: fk2.column,
          })

          // B -> A via Table
          relationships.push({
            name: NameGenerator.generateRelationshipName(
              table.name,
              fk1.referencedTable,
            ),
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

    return relationships
  }

  /**
   * Analyze relationship patterns
   */
  analyzeRelationshipPatterns(tables: TableInfo[]): {
    oneToMany: number
    manyToMany: number
    selfReferencing: number
    circularReferences: string[]
  } {
    const patterns = {
      oneToMany: 0,
      manyToMany: 0,
      selfReferencing: 0,
      circularReferences: [] as string[],
    }

    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        // Check for self-referencing relationships
        if (fk.referencedTable === table.name) {
          patterns.selfReferencing++
        }

        // Check for many-to-many (junction tables)
        const referencedTable = tables.find(
          (t) => t.name === fk.referencedTable,
        )
        if (referencedTable && this.isJunctionTable(table)) {
          patterns.manyToMany++
        } else {
          patterns.oneToMany++
        }
      }
    }

    // Detect circular references
    patterns.circularReferences = this.detectCircularReferences(tables)

    return patterns
  }

  /**
   * Check if a table is a junction table (many-to-many)
   */
  private isJunctionTable(table: TableInfo): boolean {
    // Junction tables typically have:
    // 1. Exactly 2 foreign keys pointing to different tables
    if (table.foreignKeys.length !== 2) return false

    // 2. Mostly columns that are either PK or part of FKs
    const fkColumns = new Set(table.foreignKeys.map((fk) => fk.column))
    const pkColumns = new Set(table.primaryKey || [])

    const otherColumns = table.columns.filter(
      (col) => !fkColumns.has(col.name) && !pkColumns.has(col.name),
    )

    // If it has too many "data" columns, it might not be a pure junction table,
    // but we can still treat it as one for M2M navigation if it has 2 FKs.
    // Pure junction tables usually have 0-1 extra columns (like 'created_at').
    return otherColumns.length <= 2
  }

  /**
   * Detect circular references in the relationship graph
   */
  private detectCircularReferences(tables: TableInfo[]): string[] {
    const circularRefs: string[] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (tableName: string, path: string[]): void => {
      if (recursionStack.has(tableName)) {
        const cycleStart = path.indexOf(tableName)
        const cycle = path.slice(cycleStart).join(' -> ') + ` -> ${tableName}`
        circularRefs.push(cycle)
        return
      }

      if (visited.has(tableName)) return

      visited.add(tableName)
      recursionStack.add(tableName)

      const table = tables.find((t) => t.name === tableName)
      if (table) {
        for (const fk of table.foreignKeys) {
          dfs(fk.referencedTable, [...path, tableName])
        }
      }

      recursionStack.delete(tableName)
    }

    for (const table of tables) {
      if (!visited.has(table.name)) {
        dfs(table.name, [])
      }
    }

    return circularRefs
  }

  /**
   * Validate relationships
   */
  validateRelationships(tables: TableInfo[]): {
    isValid: boolean
    issues: string[]
  } {
    const issues: string[] = []
    const tableNames = new Set(tables.map((t) => t.name))

    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        // Check if referenced table exists
        if (!tableNames.has(fk.referencedTable)) {
          issues.push(
            `Foreign key '${fk.name}' in table '${table.name}' references non-existent table '${fk.referencedTable}'`,
          )
        }

        // Check if referenced column exists in referenced table
        const referencedTable = tables.find(
          (t) => t.name === fk.referencedTable,
        )
        if (referencedTable) {
          const referencedColumnExists = referencedTable.columns.some(
            (col) => col.name === fk.referencedColumn,
          )
          if (!referencedColumnExists) {
            issues.push(
              `Foreign key '${fk.name}' in table '${table.name}' references non-existent column '${fk.referencedColumn}' in table '${fk.referencedTable}'`,
            )
          }
        }

        // Check if foreign key column exists
        const fkColumnExists = table.columns.some(
          (col) => col.name === fk.column,
        )
        if (!fkColumnExists) {
          issues.push(
            `Foreign key '${fk.name}' in table '${table.name}' references non-existent column '${fk.column}'`,
          )
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    }
  }
}
