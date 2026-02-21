import { Kysely } from '../../kysely.js'
import { DialectAdapterBase } from '../dialect-adapter-base.js'
import { MigrationLockOptions } from '../dialect-adapter.js'

// Random id for our migration lock
const MIGRATION_LOCK_ID = '0.0.1'

export class PostgresAdapter extends DialectAdapterBase {
  override get supportsTransactionalDdl(): boolean {
    return true
  }

  override get supportsReturning(): boolean {
    return true
  }

  override async acquireMigrationLock(
    db: Kysely<any>,
    opt: MigrationLockOptions,
  ): Promise<void> {
    const lockTable = opt.lockTable ?? 'kysely_migration_lock'

    // Postgres uses advisory locks. We need to create a unique lock id
    // from the lock table name. We use a simple hash function for that.
    const lockId = this.#hashString(lockTable)

    await db
      .selectFrom(lockTable as any)
      .selectAll()
      .where('id' as any, '=', MIGRATION_LOCK_ID)
      .forUpdate()
      .execute()
  }

  override async releaseMigrationLock(
    _db: Kysely<any>,
    _opt: MigrationLockOptions,
  ): Promise<void> {
    // Nothing to do here. The migration lock is automatically released
    // when the transaction is committed/rolled back.
  }

  #hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i)
      hash = (hash << 5) - hash + chr
      hash |= 0 // Convert to 32bit integer
    }
    return hash
  }
}

