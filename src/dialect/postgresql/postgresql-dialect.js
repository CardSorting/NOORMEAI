"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDialect = void 0;
const postgresql_driver_js_1 = require("./postgresql-driver.js");
const postgresql_query_compiler_js_1 = require("./postgresql-query-compiler.js");
const postgresql_introspector_js_1 = require("./postgresql-introspector.js");
const postgresql_adapter_js_1 = require("./postgresql-adapter.js");
const object_utils_js_1 = require("../../util/object-utils.js");
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
class PostgresDialect {
    #config;
    constructor(config) {
        this.#config = (0, object_utils_js_1.freeze)({ ...config });
    }
    createDriver() {
        return new postgresql_driver_js_1.PostgresDriver(this.#config);
    }
    createQueryCompiler() {
        return new postgresql_query_compiler_js_1.PostgresQueryCompiler();
    }
    createAdapter() {
        return new postgresql_adapter_js_1.PostgresAdapter();
    }
    createIntrospector(db) {
        return new postgresql_introspector_js_1.PostgresIntrospector(db);
    }
}
exports.PostgresDialect = PostgresDialect;
