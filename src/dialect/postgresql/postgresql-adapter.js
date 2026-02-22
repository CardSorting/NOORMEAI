"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresAdapter = void 0;
const dialect_adapter_base_js_1 = require("../dialect-adapter-base.js");
// Random id for our migration lock
const MIGRATION_LOCK_ID = '0.0.1';
class PostgresAdapter extends dialect_adapter_base_js_1.DialectAdapterBase {
    get supportsTransactionalDdl() {
        return true;
    }
    get supportsReturning() {
        return true;
    }
    async acquireMigrationLock(db, opt) {
        const lockTable = opt.lockTable ?? 'kysely_migration_lock';
        // Postgres uses advisory locks. We need to create a unique lock id
        // from the lock table name. We use a simple hash function for that.
        const lockId = this.#hashString(lockTable);
        await db
            .selectFrom(lockTable)
            .selectAll()
            .where('id', '=', MIGRATION_LOCK_ID)
            .forUpdate()
            .execute();
    }
    async releaseMigrationLock(_db, _opt) {
        // Nothing to do here. The migration lock is automatically released
        // when the transaction is committed/rolled back.
    }
    #hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const chr = str.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
}
exports.PostgresAdapter = PostgresAdapter;
