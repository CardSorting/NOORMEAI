"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDriver = void 0;
const compiled_query_js_1 = require("../../query-compiler/compiled-query.js");
const object_utils_js_1 = require("../../util/object-utils.js");
const PRIVATE_RELEASE_METHOD = Symbol();
class PostgresDriver {
    #config;
    #connections = new WeakMap();
    #pool;
    constructor(config) {
        this.#config = (0, object_utils_js_1.freeze)({ ...config });
    }
    async init() {
        this.#pool = (0, object_utils_js_1.isFunction)(this.#config.pool)
            ? await this.#config.pool()
            : this.#config.pool;
        if (!this.#pool && this.#config.poolConfig) {
            // Create pool from config if not provided
            const { Pool } = await Promise.resolve().then(() => __importStar(require('pg')));
            this.#pool = new Pool(this.#config.poolConfig);
        }
        if (!this.#pool) {
            throw new Error('PostgreSQL pool not configured. Please provide either a pool instance or poolConfig.');
        }
    }
    async acquireConnection() {
        const client = await this.#pool.connect();
        let connection = this.#connections.get(client);
        if (!connection) {
            connection = new PostgresConnection(client, {
                cursor: this.#config.cursor,
            });
            this.#connections.set(client, connection);
            // The connection needs to be released by calling `releaseConnection`
            await this.#config.onCreateConnection?.(connection);
        }
        return connection;
    }
    async beginTransaction(connection, settings) {
        if (settings.isolationLevel) {
            await connection.executeQuery(compiled_query_js_1.CompiledQuery.raw(`begin transaction isolation level ${settings.isolationLevel}`));
        }
        else {
            await connection.executeQuery(compiled_query_js_1.CompiledQuery.raw('begin'));
        }
    }
    async commitTransaction(connection) {
        await connection.executeQuery(compiled_query_js_1.CompiledQuery.raw('commit'));
    }
    async rollbackTransaction(connection) {
        await connection.executeQuery(compiled_query_js_1.CompiledQuery.raw('rollback'));
    }
    async releaseConnection(connection) {
        connection[PRIVATE_RELEASE_METHOD]();
    }
    async destroy() {
        if (this.#pool) {
            const pool = this.#pool;
            this.#pool = undefined;
            await pool.end();
        }
    }
}
exports.PostgresDriver = PostgresDriver;
class PostgresConnection {
    #client;
    #options;
    constructor(client, options) {
        this.#client = client;
        this.#options = (0, object_utils_js_1.freeze)({ ...options });
    }
    async executeQuery(compiledQuery) {
        const result = await this.#client.query(compiledQuery.sql, compiledQuery.parameters);
        if (result.command === 'INSERT' ||
            result.command === 'UPDATE' ||
            result.command === 'DELETE') {
            const numAffectedRows = BigInt(result.rowCount ?? 0);
            // Attempt to extract insertId from rows if RETURNING was used
            let insertId;
            if (result.command === 'INSERT' && result.rows.length > 0) {
                const firstRow = result.rows[0];
                const idValue = firstRow.id ?? firstRow.ID ?? Object.values(firstRow)[0];
                if (typeof idValue === 'number' || typeof idValue === 'bigint' || typeof idValue === 'string') {
                    try {
                        insertId = BigInt(idValue);
                    }
                    catch {
                        // Not a valid bigint representation, ignore
                    }
                }
            }
            return {
                insertId,
                rows: result.rows ?? [],
                numAffectedRows,
            };
        }
        return {
            rows: result.rows ?? [],
        };
    }
    async *streamQuery(compiledQuery, chunkSize) {
        if (!this.#options.cursor) {
            throw new Error('Cursor is not configured. To use streaming queries, please provide a cursor constructor in the dialect config.');
        }
        const cursor = new this.#options.cursor(compiledQuery.sql, compiledQuery.parameters);
        try {
            while (true) {
                const rows = await cursor.read(chunkSize);
                if (rows.length === 0) {
                    break;
                }
                yield {
                    rows,
                };
            }
        }
        finally {
            await cursor.close();
        }
    }
    [PRIVATE_RELEASE_METHOD]() {
        this.#client.release();
    }
}
