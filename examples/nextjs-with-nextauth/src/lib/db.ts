import { NOORMME } from 'noormme'
import { join } from 'path'

// Singleton database instance
let db: NOORMME | null = null

export async function getDB(): Promise<NOORMME> {
  if (!db) {
    db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        database: process.env.DATABASE_URL || './data/app.db'
      },
      optimization: {
        enableWALMode: true,
        enableForeignKeys: true,
        cacheSize: -64000, // 64MB cache
        synchronous: 'NORMAL'
      },
      logging: {
        level: 'info',
        enabled: process.env.NODE_ENV === 'development'
      }
    })

    await db.initialize()
  }

  return db
}

// For NextAuth adapter
export function getDBForNextAuth(): NOORMME {
  if (!db) {
    throw new Error('Database not initialized. Call getDB() first.')
  }
  return db
}
