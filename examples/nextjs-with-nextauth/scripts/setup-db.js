const { NOORMME } = require('noormme')
const { join } = require('path')
const { mkdirSync } = require('fs')

async function setupDatabase() {
  console.log('🚀 Setting up NOORMME database...')
  
  // Ensure data directory exists
  const dataDir = join(process.cwd(), 'data')
  try {
    mkdirSync(dataDir, { recursive: true })
    console.log('✅ Created data directory')
  } catch (error) {
    // Directory already exists
  }

  const db = new NOORMME({
    dialect: 'sqlite',
    connection: {
      database: join(dataDir, 'app.db')
    },
    optimization: {
      enableWALMode: true,
      enableForeignKeys: true,
      cacheSize: -64000, // 64MB cache
      synchronous: 'NORMAL'
    },
    logging: {
      level: 'info',
      enabled: true
    }
  })

  try {
    await db.initialize()
    console.log('✅ Database initialized')

    // Create NextAuth required tables
    const kysely = db.getKysely()
    
    console.log('📋 Creating NextAuth tables...')

    // Users table
    await kysely.schema
      .createTable('users')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('name', 'text')
      .addColumn('email', 'text', (col) => col.unique().notNull())
      .addColumn('email_verified', 'text')
      .addColumn('image', 'text')
      .addColumn('password', 'text') // For credentials provider
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .execute()

    console.log('✅ Created users table')

    // Accounts table (for OAuth)
    await kysely.schema
      .createTable('accounts')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('user_id', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) => col.notNull())
      .addColumn('provider', 'text', (col) => col.notNull())
      .addColumn('provider_account_id', 'text', (col) => col.notNull())
      .addColumn('refresh_token', 'text')
      .addColumn('access_token', 'text')
      .addColumn('expires_at', 'integer')
      .addColumn('token_type', 'text')
      .addColumn('scope', 'text')
      .addColumn('id_token', 'text')
      .addColumn('session_state', 'text')
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .addForeignKeyConstraint('accounts_user_id_fkey', ['user_id'], 'users', ['id'], (cb) => cb.onDelete('cascade'))
      .execute()

    console.log('✅ Created accounts table')

    // Sessions table
    await kysely.schema
      .createTable('sessions')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('session_token', 'text', (col) => col.unique().notNull())
      .addColumn('user_id', 'text', (col) => col.notNull())
      .addColumn('expires', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .addForeignKeyConstraint('sessions_user_id_fkey', ['user_id'], 'users', ['id'], (cb) => cb.onDelete('cascade'))
      .execute()

    console.log('✅ Created sessions table')

    // Verification tokens table
    await kysely.schema
      .createTable('verification_tokens')
      .ifNotExists()
      .addColumn('identifier', 'text', (col) => col.notNull())
      .addColumn('token', 'text', (col) => col.notNull())
      .addColumn('expires', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.notNull())
      .addPrimaryKeyConstraint('verification_tokens_pkey', ['identifier', 'token'])
      .execute()

    console.log('✅ Created verification_tokens table')

    // Create indexes for better performance
    await kysely.schema
      .createIndex('accounts_user_id_idx')
      .ifNotExists()
      .on('accounts')
      .column('user_id')
      .execute()

    await kysely.schema
      .createIndex('sessions_user_id_idx')
      .ifNotExists()
      .on('sessions')
      .column('user_id')
      .execute()

    await kysely.schema
      .createIndex('sessions_session_token_idx')
      .ifNotExists()
      .on('sessions')
      .column('session_token')
      .execute()

    console.log('✅ Created performance indexes')

    console.log('🎉 Database setup complete!')
    console.log('')
    console.log('Next steps:')
    console.log('1. Add your OAuth provider credentials to .env.local')
    console.log('2. Run: npm run dev')
    console.log('3. Visit: http://localhost:3000')

  } catch (error) {
    console.error('❌ Database setup failed:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

setupDatabase().catch(console.error)
