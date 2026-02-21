# 11 - Data Migration Scripts

This guide covers creating scripts to migrate data from PostgreSQL to SQLite using Noormme.

## Overview

We'll create comprehensive migration scripts that:
- Extract data from PostgreSQL
- Transform data types to SQLite-compatible formats
- Load data into SQLite using Noormme
- Handle foreign key relationships
- Provide rollback capabilities

## Step 1: Create the Migration Script

Create `scripts/migrate-to-sqlite.ts`:

```typescript
import { Pool } from 'pg';
import { NOORMME } from 'noormme';
import fs from 'fs';
import path from 'path';

// PostgreSQL connection
const pgPool = new Pool({
  connectionString: process.env.POSTGRES_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// SQLite connection with Noormme
const sqliteDb = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/dreambeesart.db'
  } as any, // Type assertion for SQLite connection
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: true
  }
});

// Table migration order (respecting foreign key constraints)
const MIGRATION_ORDER = [
  'roles',
  'permissions', 
  'role_permissions',
  'users',
  'user_roles',
  'accounts',
  'sessions',
  'verification_tokens',
  'generation_history',
  'user_preferences',
  'api_keys',
  'ai_models'
];

// Data type mappings from PostgreSQL to SQLite
const TYPE_MAPPINGS: Record<string, string> = {
  'uuid': 'TEXT',
  'text': 'TEXT',
  'varchar': 'TEXT',
  'character varying': 'TEXT',
  'integer': 'INTEGER',
  'bigint': 'INTEGER',
  'boolean': 'INTEGER', // SQLite uses 0/1 for boolean
  'timestamp with time zone': 'TEXT', // Store as ISO string
  'timestamp without time zone': 'TEXT',
  'json': 'TEXT', // Store as JSON string
  'jsonb': 'TEXT'
};

async function getTableSchema(tableName: string): Promise<any[]> {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length
    FROM information_schema.columns 
    WHERE table_name = $1 
    ORDER BY ordinal_position
  `;
  
  const result = await pgPool.query(query, [tableName]);
  return result.rows;
}

async function createSQLiteTable(tableName: string, schema: any[]): Promise<void> {
  const kysely = sqliteDb.getKysely();
  
  const columns = schema.map(col => {
    const sqliteType = TYPE_MAPPINGS[col.data_type] || 'TEXT';
    const nullable = col.is_nullable === 'YES' ? '' : ' NOT NULL';
    const defaultValue = col.column_default ? ` DEFAULT ${col.column_default}` : '';
    
    return `${col.column_name} ${sqliteType}${nullable}${defaultValue}`;
  }).join(', ');
  
  const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
  
  try {
    await kysely.executeQuery({ sql: createTableSQL, parameters: [] });
    console.log(`✅ Created table: ${tableName}`);
  } catch (error) {
    console.error(`❌ Failed to create table ${tableName}:`, error);
    throw error;
  }
}

async function migrateTableData(tableName: string): Promise<void> {
  const kysely = sqliteDb.getKysely();
  
  try {
    // Get data from PostgreSQL
    console.log(`📥 Fetching data from ${tableName}...`);
    const pgResult = await pgPool.query(`SELECT * FROM ${tableName}`);
    
    if (pgResult.rows.length === 0) {
      console.log(`ℹ️  No data in ${tableName}`);
      return;
    }
    
    console.log(`📊 Found ${pgResult.rows.length} rows in ${tableName}`);
    
    // Transform data for SQLite
    const transformedData = pgResult.rows.map(row => {
      const transformed: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(row)) {
        if (value === null) {
          transformed[key] = null;
        } else if (value instanceof Date) {
          transformed[key] = value.toISOString();
        } else if (typeof value === 'boolean') {
          transformed[key] = value ? 1 : 0;
        } else if (typeof value === 'object') {
          transformed[key] = JSON.stringify(value);
        } else {
          transformed[key] = value;
        }
      }
      
      return transformed;
    });
    
    // Insert data in batches
    const batchSize = 100;
    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      
      // Use raw SQL for batch insert
      const columns = Object.keys(batch[0]);
      const placeholders = batch.map(() => 
        `(${columns.map(() => '?').join(', ')})`
      ).join(', ');
      
      const values = batch.flatMap(row => columns.map(col => row[col]));
      const insertSQL = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
      
      await kysely.executeQuery({ 
        sql: insertSQL, 
        parameters: values 
      });
      
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transformedData.length / batchSize)} for ${tableName}`);
    }
    
    console.log(`✅ Completed migration for ${tableName}`);
  } catch (error) {
    console.error(`❌ Failed to migrate ${tableName}:`, error);
    throw error;
  }
}

async function createIndexes(): Promise<void> {
  const kysely = sqliteDb.getKysely();
  
  const indexes = [
    { table: 'users', column: 'email', unique: true },
    { table: 'accounts', columns: ['provider', 'provider_account_id'], unique: true },
    { table: 'sessions', column: 'session_token', unique: true },
    { table: 'verification_tokens', columns: ['identifier', 'token'], unique: true },
    { table: 'user_roles', columns: ['user_id', 'role_id'], unique: true },
    { table: 'role_permissions', columns: ['role_id', 'permission_id'], unique: true },
    { table: 'generation_history', column: 'user_id' },
    { table: 'user_preferences', column: 'user_id' },
    { table: 'api_keys', column: 'user_id' }
  ];
  
  for (const index of indexes) {
    try {
      const indexName = `${index.table}_${Array.isArray(index.column) ? index.columns.join('_') : index.column}_idx`;
      const columns = Array.isArray(index.column) ? index.columns.join(', ') : index.column;
      const unique = index.unique ? 'UNIQUE ' : '';
      
      const createIndexSQL = `CREATE ${unique}INDEX IF NOT EXISTS ${indexName} ON ${index.table} (${columns})`;
      await kysely.executeQuery({ sql: createIndexSQL, parameters: [] });
      
      console.log(`✅ Created index: ${indexName}`);
    } catch (error) {
      console.error(`❌ Failed to create index for ${index.table}:`, error);
    }
  }
}

async function verifyMigration(): Promise<void> {
  const kysely = sqliteDb.getKysely();
  
  console.log('🔍 Verifying migration...');
  
  for (const tableName of MIGRATION_ORDER) {
    try {
      // Count rows in PostgreSQL
      const pgResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      
      // Count rows in SQLite
      const sqliteResult = await kysely
        .selectFrom(tableName as any)
        .select(kysely.fn.count('*').as('count'))
        .executeTakeFirst();
      const sqliteCount = Number(sqliteResult?.count || 0);
      
      if (pgCount === sqliteCount) {
        console.log(`✅ ${tableName}: ${sqliteCount} rows migrated successfully`);
      } else {
        console.warn(`⚠️  ${tableName}: Expected ${pgCount}, got ${sqliteCount} rows`);
      }
    } catch (error) {
      console.error(`❌ Verification failed for ${tableName}:`, error);
    }
  }
}

async function createBackup(): Promise<void> {
  const backupPath = `./data/dreambeesart_backup_${new Date().toISOString().split('T')[0]}.db`;
  
  try {
    if (fs.existsSync('./data/dreambeesart.db')) {
      fs.copyFileSync('./data/dreambeesart.db', backupPath);
      console.log(`✅ Created backup: ${backupPath}`);
    }
  } catch (error) {
    console.error('❌ Failed to create backup:', error);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting PostgreSQL to SQLite migration...');
  
  try {
    // Create backup
    await createBackup();
    
    // Initialize SQLite database
    await sqliteDb.initialize();
    console.log('✅ SQLite database initialized');
    
    // Test PostgreSQL connection
    await pgPool.query('SELECT 1');
    console.log('✅ PostgreSQL connection verified');
    
    // Migrate tables in order
    for (const tableName of MIGRATION_ORDER) {
      try {
        console.log(`\n📋 Migrating table: ${tableName}`);
        
        // Get schema from PostgreSQL
        const schema = await getTableSchema(tableName);
        
        // Create table in SQLite
        await createSQLiteTable(tableName, schema);
        
        // Migrate data
        await migrateTableData(tableName);
        
      } catch (error) {
        console.error(`❌ Failed to migrate table ${tableName}:`, error);
        // Continue with other tables
      }
    }
    
    // Create indexes
    console.log('\n🔧 Creating indexes...');
    await createIndexes();
    
    // Verify migration
    console.log('\n🔍 Verifying migration...');
    await verifyMigration();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📊 Migration Summary:');
    console.log(`   - Database: ${process.env.POSTGRES_DATABASE_URL} → ./data/dreambeesart.db`);
    console.log(`   - Tables migrated: ${MIGRATION_ORDER.length}`);
    console.log(`   - Backup created: ./data/dreambeesart_backup_*.db`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await pgPool.end();
    console.log('🔌 PostgreSQL connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as migrateToSQLite };
```

## Step 2: Create Rollback Script

Create `scripts/rollback-migration.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { NOORMME } from 'noormme';

async function rollbackMigration(): Promise<void> {
  console.log('🔄 Starting rollback...');
  
  try {
    // Find the most recent backup
    const backupDir = './data';
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('dreambeesart_backup_') && file.endsWith('.db'))
      .sort()
      .reverse();
    
    if (backupFiles.length === 0) {
      throw new Error('No backup files found');
    }
    
    const latestBackup = backupFiles[0];
    const backupPath = path.join(backupDir, latestBackup);
    const currentDbPath = path.join(backupDir, 'dreambeesart.db');
    
    console.log(`📂 Found backup: ${latestBackup}`);
    
    // Restore from backup
    if (fs.existsSync(currentDbPath)) {
      fs.unlinkSync(currentDbPath);
    }
    
    fs.copyFileSync(backupPath, currentDbPath);
    
    // Verify restoration
    const db = new NOORMME({
      dialect: 'sqlite',
      connection: { database: currentDbPath } as any
    });
    
    await db.initialize();
    
    const kysely = db.getKysely();
    const userCount = await kysely
      .selectFrom('users' as any)
      .select(kysely.fn.count('*').as('count'))
      .executeTakeFirst();
    
    console.log(`✅ Rollback completed`);
    console.log(`📊 Users in restored database: ${userCount?.count || 0}`);
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

// Run rollback if called directly
if (require.main === module) {
  rollbackMigration().catch(console.error);
}

export { rollbackMigration };
```

## Step 3: Create Data Validation Script

Create `scripts/validate-migration.ts`:

```typescript
import { Pool } from 'pg';
import { NOORMME } from 'noormme';

const pgPool = new Pool({
  connectionString: process.env.POSTGRES_DATABASE_URL,
});

const sqliteDb = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/dreambeesart.db' } as any
});

interface ValidationResult {
  table: string;
  pgCount: number;
  sqliteCount: number;
  match: boolean;
  issues?: string[];
}

async function validateTable(tableName: string): Promise<ValidationResult> {
  const issues: string[] = [];
  
  try {
    // Count rows
    const pgResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const pgCount = parseInt(pgResult.rows[0].count);
    
    const kysely = sqliteDb.getKysely();
    const sqliteResult = await kysely
      .selectFrom(tableName as any)
      .select(kysely.fn.count('*').as('count'))
      .executeTakeFirst();
    const sqliteCount = Number(sqliteResult?.count || 0);
    
    // Check for specific data issues
    if (tableName === 'users') {
      // Validate email uniqueness
      const pgEmails = await pgPool.query('SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1');
      if (pgEmails.rows.length > 0) {
        issues.push('Duplicate emails in PostgreSQL');
      }
    }
    
    if (tableName === 'sessions') {
      // Validate session tokens
      const pgSessions = await pgPool.query('SELECT session_token FROM sessions WHERE expires < NOW()');
      const sqliteSessions = await kysely
        .selectFrom('sessions' as any)
        .select('session_token')
        .where('expires', '<', new Date().toISOString())
        .execute();
      
      if (pgSessions.rows.length !== sqliteSessions.length) {
        issues.push('Expired session count mismatch');
      }
    }
    
    return {
      table: tableName,
      pgCount,
      sqliteCount,
      match: pgCount === sqliteCount,
      issues: issues.length > 0 ? issues : undefined
    };
    
  } catch (error) {
    return {
      table: tableName,
      pgCount: 0,
      sqliteCount: 0,
      match: false,
      issues: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

async function validateMigration(): Promise<void> {
  console.log('🔍 Validating migration...');
  
  try {
    await sqliteDb.initialize();
    
    const tables = [
      'users', 'accounts', 'sessions', 'verification_tokens',
      'roles', 'permissions', 'user_roles', 'role_permissions',
      'generation_history', 'user_preferences', 'api_keys', 'ai_models'
    ];
    
    const results: ValidationResult[] = [];
    
    for (const table of tables) {
      const result = await validateTable(table);
      results.push(result);
      
      if (result.match && !result.issues) {
        console.log(`✅ ${table}: ${result.sqliteCount} rows (OK)`);
      } else {
        console.log(`⚠️  ${table}: PG=${result.pgCount}, SQLite=${result.sqliteCount}${result.issues ? ` - ${result.issues.join(', ')}` : ''}`);
      }
    }
    
    const failedTables = results.filter(r => !r.match || r.issues);
    
    if (failedTables.length === 0) {
      console.log('\n🎉 Migration validation passed!');
    } else {
      console.log(`\n⚠️  ${failedTables.length} tables have issues`);
      console.log('Failed tables:', failedTables.map(t => t.table).join(', '));
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
  } finally {
    await pgPool.end();
  }
}

// Run validation if called directly
if (require.main === module) {
  validateMigration().catch(console.error);
}

export { validateMigration };
```

## Step 4: Create Migration Package Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "migrate:to-sqlite": "tsx scripts/migrate-to-sqlite.ts",
    "migrate:rollback": "tsx scripts/rollback-migration.ts", 
    "migrate:validate": "tsx scripts/validate-migration.ts"
  }
}
```

## Step 5: Environment Configuration

Create `.env.migration`:

```bash
# PostgreSQL connection (source)
POSTGRES_DATABASE_URL="postgresql://username:password@localhost:5432/dreambeesart"

# Migration settings
MIGRATION_BATCH_SIZE=100
MIGRATION_BACKUP_ENABLED=true
MIGRATION_VERIFY_ENABLED=true
```

## Step 6: Usage Instructions

### Pre-Migration Checklist
1. **Backup PostgreSQL database**
2. **Stop application services**
3. **Verify environment variables**
4. **Test PostgreSQL connection**

### Run Migration
```bash
# Set environment variables
export POSTGRES_DATABASE_URL="your_postgres_url"

# Run migration
npm run migrate:to-sqlite

# Validate migration
npm run migrate:validate
```

### Rollback if Needed
```bash
npm run migrate:rollback
```

## Step 7: Advanced Migration Features

### Custom Data Transformers
```typescript
// Add to migration script
const customTransformers: Record<string, (value: any) => any> = {
  'users.email': (email: string) => email.toLowerCase().trim(),
  'users.created_at': (date: Date) => new Date(date).toISOString(),
  'generation_history.metadata': (metadata: any) => JSON.stringify(metadata)
};

function transformValue(tableName: string, columnName: string, value: any): any {
  const key = `${tableName}.${columnName}`;
  const transformer = customTransformers[key];
  return transformer ? transformer(value) : value;
}
```

### Progress Tracking
```typescript
import cliProgress from 'cli-progress';

const progressBar = new cliProgress.SingleBar({
  format: 'Migration Progress |{bar}| {percentage}% | {value}/{total} Tables | ETA: {eta}s',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

progressBar.start(MIGRATION_ORDER.length, 0);

// Update progress in migration loop
progressBar.increment();
```

## Common Issues and Solutions

### Memory Issues with Large Tables
- **Issue**: Out of memory during migration
- **Solution**: Implement streaming with smaller batch sizes

### Foreign Key Constraint Violations
- **Issue**: Data insertion fails due to FK constraints
- **Solution**: Ensure proper migration order and handle orphaned records

### Data Type Conversion Errors
- **Issue**: PostgreSQL types don't map to SQLite
- **Solution**: Add custom transformers for problematic types

### Performance Issues
- **Issue**: Migration is too slow
- **Solution**: Use transactions, optimize batch sizes, and create indexes after data migration

## Next Steps

After successful data migration, proceed to [12-performance-optimization.md](./12-performance-optimization.md) to optimize your SQLite database for production use.
