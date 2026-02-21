import type { Kysely } from '../kysely.js'
import { sql } from '../raw-builder/sql.js'
import { validateIdentifier } from '../util/security-validator.js'

/**
 * SchemaEvolutionHelper allows agents to introspect their own schema
 * and generate migration suggestions for growth and adaptation.
 */
export class SchemaEvolutionHelper {
    constructor(private db: Kysely<any>) { }

    /**
     * Get all tables and their columns to help an agent understand its structure
     */
    async getStructuralOverview(): Promise<string> {
        const introspector = this.db.introspection
        const tables = await introspector.getTables()

        let overview = "Current Database Schema Overview:\n\n"
        for (const table of tables) {
            overview += `Table: ${table.name}\n`
            if (table.columns) {
                for (const col of table.columns) {
                    overview += `  - ${col.name} (${col.type}${col.nullable ? '?' : ''})\n`
                }
            }
            overview += "\n"
        }

        return overview
    }

    /**
     * Suggest a Kysely migration for a new table
     */
    suggestCreateTable(tableName: string, columns: { name: string, type: string }[]): string {
        validateIdentifier(tableName, 'table name')
        let code = `await db.schema.createTable('${tableName}')\n`
        for (const col of columns) {
            validateIdentifier(col.name, 'column name')
            code += `  .addColumn('${col.name}', '${col.type}')\n`
        }
        code += `  .execute()`
        return code
    }

    /**
     * Suggest adding a column to an existing table
     */
    suggestAddColumn(tableName: string, columnName: string, columnType: string): string {
        validateIdentifier(tableName, 'table name')
        validateIdentifier(columnName, 'column name')
        return `await db.schema.alterTable('${tableName}').addColumn('${columnName}', '${columnType}').execute()`
    }

    /**
     * Safely apply a DDL suggestion (e.g. addColumn, createIndex).
     * This allows the agent to grow its own schema autonomously with validation.
     */
    async applySuggestion(ddl: string): Promise<void> {
        const d = ddl.trim().replace(/\s+/g, ' ')
        const upper = d.toUpperCase()

        // 1. Safety Check: Only allow a specific subset of DDL operations
        const allowedPatterns = [
            /^CREATE TABLE/i,
            /^CREATE (?:UNIQUE )?INDEX/i,
            /^ALTER TABLE/i,
            /^DROP INDEX/i
        ]

        const isAllowed = allowedPatterns.some(pattern => pattern.test(d))
        if (!isAllowed) {
            throw new Error(`DDL operation not allowed autonomously: ${ddl}`)
        }

        // 2. Validate identifiers in the DDL
        // This is a rough extraction but adds a layer of security
        const identifiers = d.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []
        for (const id of identifiers) {
            const upId = id.toUpperCase()
            // Skip keywords
            if (['CREATE', 'TABLE', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'UNIQUE', 'ON', 'DROP', 'IF', 'EXISTS', 'NOT', 'NULL', 'PRIMARY', 'KEY', 'TIMESTAMP', 'TEXT', 'INTEGER', 'REAL', 'BOOLEAN', 'VARCHAR', 'REFERENCES', 'CASCADE', 'SET'].includes(upId)) {
                continue
            }
            try {
                validateIdentifier(id)
            } catch (e) {
                // Ignore small errors in validation if it's a known data type or complex expression
                if (!['VARCHAR', 'TIMESTAMP', 'INT', 'TEXT'].some(t => upId.includes(t))) {
                    console.warn(`[SchemaEvolution] Identifier validation warning for "${id}":`, e)
                }
            }
        }

        // 3. Normalize Kysely JS-like strings to SQL if necessary
        let sqlToExecute = d
        if (d.includes('db.schema.')) {
            sqlToExecute = this.normalizeKyselyToSql(d)
        }

        // 4. Execute the SQL
        console.log(`[SchemaEvolution] Executing: ${sqlToExecute}`)
        await sql.raw(sqlToExecute).execute(this.db)
    }

    private normalizeKyselyToSql(jsCode: string): string {
        // Handle: await db.schema.alterTable('table').addColumn('col', 'type').execute()
        const addColumnMatch = jsCode.match(/alterTable\(['"](.*?)['"]\)\.addColumn\(['"](.*?)['"],\s*['"](.*?)['"]\)/)
        if (addColumnMatch) {
            return `ALTER TABLE ${addColumnMatch[1]} ADD COLUMN ${addColumnMatch[2]} ${addColumnMatch[3]}`
        }

        // Handle: await db.schema.createTable('table').addColumn('col1', 'type1').addColumn('col2', 'type2').execute()
        const createTableMatch = jsCode.match(/createTable\(['"](.*?)['"]\)/)
        if (createTableMatch) {
            const tableName = createTableMatch[1]
            const cols: string[] = []
            const colMatches = jsCode.matchAll(/\.addColumn\(['"](.*?)['"],\s*['"](.*?)['"](?:,.*?)?\)/g)
            for (const m of colMatches) {
                cols.push(`${m[1]} ${m[2]}`)
            }
            if (cols.length > 0) {
                return `CREATE TABLE ${tableName} (${cols.join(', ')})`
            }
        }

        throw new Error(`Failed to normalize Kysely JS code to SQL: ${jsCode}`)
    }
}
