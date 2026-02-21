import { Driver } from '../../driver/driver.js'
import { Kysely } from '../../kysely.js'
import { QueryCompiler } from '../../query-compiler/query-compiler.js'
import { Dialect } from '../dialect.js'
import { DatabaseIntrospector } from '../database-introspector.js'
import { PostgresDriver } from './postgresql-driver.js'
import { PostgresQueryCompiler } from './postgresql-query-compiler.js'
import { PostgresIntrospector } from './postgresql-introspector.js'
import { DialectAdapter } from '../dialect-adapter.js'
import { PostgresAdapter } from './postgresql-adapter.js'
import { PostgresDialectConfig } from './postgresql-dialect-config.js'
import { freeze } from '../../util/object-utils.js'

/**
 * PostgreSQL dialect that uses the [pg](https://github.com/brianc/node-postgres) library.
 *
 * The constructor takes an instance of {@link PostgresDialectConfig}.
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: new Pool({
 *     host: 'localhost',
 *     database: 'my_database',
 *     user: 'postgres',
 *     password: 'postgres',
 *     port: 5432,
 *     max: 10,
 *   })
 * })
 * ```
 *
 * Alternatively, you can use poolConfig:
 *
 * ```ts
 * new PostgresDialect({
 *   poolConfig: {
 *     host: 'localhost',
 *     database: 'my_database',
 *     user: 'postgres',
 *     password: 'postgres',
 *     port: 5432,
 *     max: 10,
 *   }
 * })
 * ```
 *
 * If you want the pool to only be created once it's first used, `pool`
 * can be a function:
 *
 * ```ts
 * import { Pool } from 'pg'
 *
 * new PostgresDialect({
 *   pool: async () => new Pool({
 *     host: 'localhost',
 *     database: 'my_database',
 *   })
 * })
 * ```
 */
export class PostgresDialect implements Dialect {
  readonly #config: PostgresDialectConfig

  constructor(config: PostgresDialectConfig) {
    this.#config = freeze({ ...config })
  }

  createDriver(): Driver {
    return new PostgresDriver(this.#config)
  }

  createQueryCompiler(): QueryCompiler {
    return new PostgresQueryCompiler()
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter()
  }

  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new PostgresIntrospector(db)
  }
}

