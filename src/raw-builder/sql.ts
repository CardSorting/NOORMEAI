import { IdentifierNode } from '../operation-node/identifier-node.js'
import { isOperationNodeSource } from '../operation-node/operation-node-source.js'
import { OperationNode } from '../operation-node/operation-node.js'
import { RawNode } from '../operation-node/raw-node.js'
import { ValueNode } from '../operation-node/value-node.js'
import { parseStringReference } from '../parser/reference-parser.js'
import { parseTable } from '../parser/table-parser.js'
import { parseValueExpression } from '../parser/value-parser.js'
import { createQueryId } from '../util/query-id.js'
import { RawBuilder, createRawBuilder } from './raw-builder.js'
import { validateColumnReference, validateTableReference, validateIdentifier } from '../util/security-validator.js'

export interface Sql {
  /**
   * Template tag for creating raw SQL snippets and queries.
   *
   * ```ts
   * import { sql } from 'kysely'
   * import type { Person } from 'type-editor' // imaginary module
   *
   * const id = 123
   * const snippet = sql<Person[]>`select * from person where id = ${id}`
   * ```
   *
   * Substitutions (the things inside `${}`) are automatically passed to the database
   * as parameters and are never interpolated to the SQL string. There's no need to worry
   * about SQL injection vulnerabilities. Substitutions can be values, other `sql`
   * expressions, queries and almost anything else Kysely can produce and they get
   * handled correctly. See the examples below.
   *
   * If you need your substitutions to be interpreted as identifiers, value literals or
   * lists of things, see the {@link Sql.ref}, {@link Sql.table}, {@link Sql.id},
   * {@link Sql.lit}, {@link Sql.raw} and {@link Sql.join} functions.
   *
   * You can pass sql snippets returned by the `sql` tag pretty much anywhere. Whenever
   * something can't be done using the Kysely API, you should be able to drop down to
   * raw SQL using the `sql` tag. Here's an example query that uses raw sql in a bunch
   * of methods:
   *
   * ```ts
   * import { sql } from 'kysely'
   *
   * const nicknames = ['johnny', 'john', 'jon']
   * const date1 = new Date('2000-01-01')
   * const date2 = new Date('2001-01-01')
   *
   * const persons = await db
   *   .selectFrom('person')
   *   .select(
   *     // If you use `sql` in a select statement, remember to call the `as`
   *     // method to give it an alias.
   *     sql<string>`concat(first_name, ' ', last_name)`.as('full_name')
   *   )
   *   .where(sql<boolean>`birthdate between ${date1} and ${date2}`)
   *   // Here we assume we have list of nicknames for the person
   *   // (a list of strings) and we use the PostgreSQL `@>` operator
   *   // to test if all of them are valid nicknames for the user.
   *   .where('nicknames', '@>', sql<string[]>`ARRAY[${sql.join(nicknames)}]`)
   *   .orderBy(sql<string>`concat(first_name, ' ', last_name)`)
   *   .execute()
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select concat(first_name, ' ', last_name) as "full_name"
   * from "person"
   * where birthdate between $1 and $2
   * and "nicknames" @> ARRAY[$3, $4, $5, $6, $7, $8, $9, $10]
   * order by concat(first_name, ' ', last_name)
   * ```
   *
   * SQL snippets can be executed by calling the `execute` method and passing a `Kysely`
   * instance as the only argument:
   *
   * ```ts
   * import { sql } from 'kysely'
   * import type { Person } from 'type-editor'
   *
   * const { rows: results } = await sql<Person[]>`select * from person`.execute(db)
   * ```
   *
   * You can merge other `sql` expressions and queries using substitutions:
   *
   * ```ts
   * import { sql } from 'kysely'
   *
   * const petName = db.selectFrom('pet').select('name').limit(1)
   * const fullName = sql<string>`concat(first_name, ' ', last_name)`
   *
   * sql<{ full_name: string; pet_name: string }[]>`
   *   select ${fullName} as full_name, ${petName} as pet_name
   *   from person
   * `.execute(db)
   * ```
   *
   * Substitutions also handle {@link ExpressionBuilder.ref},
   * {@link DynamicModule.ref} and pretty much anything else you
   * throw at it. Here's an example of calling a function in a
   * type-safe way:
   *
   * ```ts
   * db.selectFrom('person')
   *   .select([
   *     'first_name',
   *     'last_name',
   *     (eb) => {
   *       // The `eb.ref` method is type-safe and only accepts
   *       // column references that are possible.
   *       const firstName = eb.ref('first_name')
   *       const lastName = eb.ref('last_name')
   *
   *       const fullName = sql<string>`concat(${firstName}, ' ', ${lastName})`
   *       return fullName.as('full_name')
   *     }
   *   ])
   * ```
   *
   * don't know if that amount of ceremony is worth the small increase in
   * type-safety though... But it's possible.
   */
  <T = unknown>(
    sqlFragments: TemplateStringsArray,
    ...parameters: unknown[]
  ): RawBuilder<T>

  /**
   * `sql.val(value)` is a shortcut for:
   *
   * ```ts
   * import { sql } from 'kysely'
   *
   * const value = 123
   * type ValueType = typeof value
   *
   * sql<ValueType>`${value}`
   * ```
   */
  val<V>(value: V): RawBuilder<V>

  /**
   * @deprecated Use {@link Sql.val} instead.
   */
  value<V>(value: V): RawBuilder<V>

  /**
   * This can be used to add runtime column references to SQL snippets.
   *
   * By default `${}` substitutions in {@link sql} template strings get
   * transformed into parameters. You can use this function to tell
   * Kysely to interpret them as column references instead.
   *
   * WARNING! Using this with unchecked inputs WILL lead to SQL injection
   * vulnerabilities. The input is not checked or escaped by Kysely in any way.
   *
   * SECURITY: This method now includes built-in validation to prevent SQL injection.
   * You should still validate that references come from trusted sources or a whitelist.
   *
   * ```ts
   * const columnRef = 'first_name'
   *
   * sql`select ${sql.ref(columnRef)} from person`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select "first_name" from person
   * ```
   *
   * The references can also include a table name:
   *
   * ```ts
   * const columnRef = 'person.first_name'
   *
   * sql`select ${sql.ref(columnRef)}} from person`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select "person"."first_name" from person
   * ```
   *
   * The references can also include a schema on supported databases:
   *
   * ```ts
   * const columnRef = 'public.person.first_name'
   *
   * sql`select ${sql.ref(columnRef)}} from person`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select "public"."person"."first_name" from person
   * ```
   */
  ref<R = unknown>(columnReference: string): RawBuilder<R>

  /**
   * This can be used to add runtime table references to SQL snippets.
   *
   * By default `${}` substitutions in {@link sql} template strings get
   * transformed into parameters. You can use this function to tell
   * Kysely to interpret them as table references instead.
   *
   * SECURITY: This method validates all inputs to prevent SQL injection.
   * You should still ensure table names come from trusted sources or use
   * a whitelist approach for additional safety.
   *
   * ```ts
   * const table = 'person'
   *
   * sql`select first_name from ${sql.table(table)}`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select first_name from "person"
   * ```
   *
   * The references can also include a schema on supported databases:
   *
   * ```ts
   * const table = 'public.person'
   *
   * sql`select first_name from ${sql.table(table)}`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select first_name from "public"."person"
   * ```
   */
  table<T = unknown>(tableReference: string): RawBuilder<T>

  /**
   * This can be used to add arbitrary identifiers to SQL snippets.
   *
   * Does the same thing as {@link Sql.ref | ref} and {@link Sql.table | table}
   * but can also be used for any other identifiers like index names.
   *
   * You should use {@link Sql.ref | ref} and {@link Sql.table | table}
   * instead of this whenever possible as they produce a more semantic
   * operation node tree.
   *
   * SECURITY: This method validates all identifiers to prevent SQL injection.
   * Each identifier is checked for dangerous patterns before use.
   *
   * ```ts
   * const indexName = 'person_first_name_index'
   *
   * sql`create index ${sql.id(indexName)} on person`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * create index "person_first_name_index" on person
   * ```
   *
   * Multiple identifiers get separated by dots:
   *
   * ```ts
   * const schema = 'public'
   * const columnName = 'first_name'
   * const table = 'person'
   *
   * sql`select ${sql.id(schema, table, columnName)} from ${sql.id(schema, table)}`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select "public"."person"."first_name" from "public"."person"
   * ```
   */
  id<T = unknown>(...ids: readonly string[]): RawBuilder<T>

  /**
   * This can be used to add literal values to SQL snippets.
   *
   * @deprecated EXTREMELY DANGEROUS - This method bypasses all SQL injection protections.
   * Use parameterized queries instead (normal ${} substitutions).
   *
   * ⚠️ CRITICAL SECURITY WARNING: This method is UNSAFE and should ONLY be used with
   * trusted, hardcoded values. It does NOT escape or validate input. Using this with
   * user input WILL lead to SQL injection vulnerabilities.
   *
   * 🚨 SECURITY POLICY: This method is marked as LEGACY and DANGEROUS.
   * - NEVER use with user input or any untrusted data
   * - NEVER use with dynamically constructed strings
   * - ONLY use with compile-time constants if absolutely necessary
   *
   * You almost ALWAYS want to use normal substitutions (parameterized queries)
   * instead of this method. Use this ONLY when something absolutely cannot be
   * sent as a parameter.
   *
   * ```ts
   * // ❌ NEVER do this with user input:
   * const userInput = req.body.value
   * sql`select * from person where name = ${sql.lit(userInput)}`  // VULNERABLE!
   *
   * // ✅ Use parameterized queries instead:
   * const userInput = req.body.value
   * sql`select * from person where name = ${userInput}`  // Safe - parameterized
   *
   * // ✅ Only use lit() for hardcoded constants:
   * sql`select * from person where status = ${sql.lit('active')}`  // Safe
   * ```
   *
   * As you can see from the example above, the value was added directly to
   * the SQL string instead of as a parameter. Only use this function when
   * something can't be sent as a parameter.
   */
  lit<V>(value: V): RawBuilder<V>

  /**
   * @deprecated Use {@link lit} instead.
   */
  literal<V>(value: V): RawBuilder<V>

  /**
   * This can be used to add arbitrary runtime SQL to SQL snippets.
   *
   * @deprecated CATASTROPHICALLY DANGEROUS - This method completely bypasses all security.
   * Use safe alternatives from 'noormme/util/safe-sql-helpers' instead.
   *
   * 🚨 CRITICAL SECURITY WARNING: This method is EXTREMELY UNSAFE and should NEVER be
   * used with any user input. It does NOT escape, validate, or sanitize input.
   * The input is directly concatenated into the SQL string.
   *
   * Using this with user input WILL lead to SQL injection vulnerabilities.
   *
   * 🚨 SECURITY POLICY: This method is marked as LEGACY and EXTREMELY DANGEROUS.
   * - NEVER use with user input or any untrusted data
   * - NEVER use with data from external sources (requests, files, etc.)
   * - NEVER use with dynamically constructed strings
   * - Use safe alternatives instead: safeOrderDirection(), safeLimit(), etc.
   *
   * This method should ONLY be used for:
   * - Hardcoded SQL fragments (compile-time constants only)
   * - SQL generated by other trusted parts of your application
   * - Database-specific syntax that cannot be expressed otherwise
   *
   * ✅ RECOMMENDED ALTERNATIVES:
   * - For order direction: use safeOrderDirection() from 'noormme/util/safe-sql-helpers'
   * - For limits/offsets: use safeLimit() or safeOffset()
   * - For keywords: use safeKeyword() with a whitelist
   * - For identifiers: use sql.ref(), sql.table(), or sql.id() (they're validated)
   *
   * ```ts
   * // ❌ NEVER EVER do this:
   * const userInput = req.body.sql
   * sql`${sql.raw(userInput)}`  // CATASTROPHIC VULNERABILITY!
   *
   * // ✅ Use safe alternatives instead:
   * import { safeOrderDirection } from 'noormme/util/safe-sql-helpers'
   * const direction = req.query.dir
   * sql`select * from person order by name ${safeOrderDirection(direction)}`
   *
   * // ✅ Only use raw() with hardcoded SQL:
   * sql`select * from person ${sql.raw('FOR UPDATE')}`  // Safe - hardcoded
   * ```
   *
   * Note that the difference to `sql.lit` is that this function
   * doesn't assume the inputs are values. The input to this function
   * can be any SQL and it's simply glued to the parent string as-is.
   *
   * If you're considering using this method, ask yourself:
   * - Can I use a parameterized query instead?
   * - Can I use sql.ref(), sql.table(), or sql.id() instead? (They're validated!)
   * - Can I use a safe helper from 'noormme/util/safe-sql-helpers'?
   * - Is this input from a 100% trusted, hardcoded source?
   */
  raw<R = unknown>(anySql: string): RawBuilder<R>

  /**
   * This can be used to add lists of things to SQL snippets.
   *
   * ### Examples
   *
   * ```ts
   * import type { Person } from 'type-editor' // imaginary module
   *
   * function findByNicknames(nicknames: string[]): Promise<Person[]> {
   *   return db
   *     .selectFrom('person')
   *     .selectAll()
   *     .where('nicknames', '@>', sql<string[]>`ARRAY[${sql.join(nicknames)}]`)
   *     .execute()
   * }
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * select * from "person"
   * where "nicknames" @> ARRAY[$1, $2, $3, $4, $5, $6, $7, $8]
   * ```
   *
   * The second argument is the joining SQL expression that defaults
   * to
   *
   * ```ts
   * sql`, `
   * ```
   *
   * In addition to values, items in the list can be also {@link sql}
   * expressions, queries or anything else the normal substitutions
   * support:
   *
   * ```ts
   * const things = [
   *   123,
   *   sql`(1 == 1)`,
   *   db.selectFrom('person').selectAll(),
   *   sql.lit(false),
   *   sql.id('first_name')
   * ]
   *
   * sql`BEFORE ${sql.join(things, sql`::varchar, `)} AFTER`
   * ```
   *
   * The generated SQL (PostgreSQL):
   *
   * ```sql
   * BEFORE $1::varchar, (1 == 1)::varchar, (select * from "person")::varchar, false::varchar, "first_name" AFTER
   * ```
   */
  join<T = unknown>(
    array: readonly unknown[],
    separator?: RawBuilder<any>,
  ): RawBuilder<T>
}

export const sql: Sql = Object.assign(
  <T = unknown>(
    sqlFragments: TemplateStringsArray,
    ...parameters: unknown[]
  ): RawBuilder<T> => {
    return createRawBuilder({
      queryId: createQueryId(),
      rawNode: RawNode.create(
        sqlFragments,
        parameters?.map(parseParameter) ?? [],
      ),
    })
  },
  {
    ref<R = unknown>(columnReference: string): RawBuilder<R> {
      // Security validation to prevent SQL injection
      validateColumnReference(columnReference)
      return createRawBuilder({
        queryId: createQueryId(),
        rawNode: RawNode.createWithChild(parseStringReference(columnReference)),
      })
    },

    val<V>(value: V): RawBuilder<V> {
      return createRawBuilder({
        queryId: createQueryId(),
        rawNode: RawNode.createWithChild(parseValueExpression(value)),
      })
    },

    value<V>(value: V): RawBuilder<V> {
      return this.val(value)
    },

    table<T = unknown>(tableReference: string): RawBuilder<T> {
      // Security validation to prevent SQL injection
      validateTableReference(tableReference)
      return createRawBuilder({
        queryId: createQueryId(),
        rawNode: RawNode.createWithChild(parseTable(tableReference)),
      })
    },

    id<T = unknown>(...ids: readonly string[]): RawBuilder<T> {
      // Security validation for each identifier
      ids.forEach((id, index) => {
        validateIdentifier(id, `identifier[${index}]`)
      })

      const fragments = new Array<string>(ids.length + 1).fill('.')

      fragments[0] = ''
      fragments[fragments.length - 1] = ''

      return createRawBuilder({
        queryId: createQueryId(),
        rawNode: RawNode.create(fragments, ids.map(IdentifierNode.create)),
      })
    },

    lit<V>(value: V): RawBuilder<V> {
      return createRawBuilder({
        queryId: createQueryId(),
        rawNode: RawNode.createWithChild(ValueNode.createImmediate(value)),
      })
    },

    literal<V>(value: V): RawBuilder<V> {
      return this.lit(value)
    },

    raw<R = unknown>(sql: string): RawBuilder<R> {
      return createRawBuilder({
        queryId: createQueryId(),
        rawNode: RawNode.createWithSql(sql),
      })
    },

    join<T = unknown>(
      array: readonly unknown[],
      separator: RawBuilder<any> = sql`, `,
    ): RawBuilder<T> {
      const nodes = new Array<OperationNode>(Math.max(2 * array.length - 1, 0))
      const sep = separator.toOperationNode()

      for (let i = 0; i < array.length; ++i) {
        nodes[2 * i] = parseParameter(array[i])

        if (i !== array.length - 1) {
          nodes[2 * i + 1] = sep
        }
      }

      return createRawBuilder({
        queryId: createQueryId(),
        rawNode: RawNode.createWithChildren(nodes),
      })
    },
  },
)

function parseParameter(param: unknown): OperationNode {
  if (isOperationNodeSource(param)) {
    return param.toOperationNode()
  }

  return parseValueExpression(param)
}
