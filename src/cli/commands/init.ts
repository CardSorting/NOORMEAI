import inquirer from 'inquirer'
import { promises as fs } from 'fs'
import * as path from 'path'
import chalk from 'chalk'
import { NOORMConfig } from '../../types/index.js'
import { sanitizeDatabasePath, validateOutputDirectory } from '../../util/security-validator.js'

export async function init(options: {
  database?: string
  output?: string
  force?: boolean
  autoOptimize?: boolean
  autoIndex?: boolean
}) {
  console.log(chalk.blue.bold('\n🎯 NOORMME Zero-Configuration Setup\n'))
  console.log(chalk.gray('Setting up NOORMME with complete SQLite automation...\n'))

  try {
    // SECURITY: Validate and sanitize database path to prevent path traversal attacks
    const databasePathInput = options.database || './database.sqlite'
    const databasePath = sanitizeDatabasePath(databasePathInput)

    // SECURITY: Validate output directory to prevent path traversal attacks
    const outputDir = options.output || 'lib'
    validateOutputDirectory(outputDir)
    
    console.log(chalk.blue('🔍 Detecting existing SQLite database...'))
    
    // Check if database exists
    const dbExists = await checkDatabaseExists(databasePath)
    
    if (dbExists) {
      console.log(chalk.green(`✅ Found existing database: ${databasePath}`))
      console.log(chalk.gray('NOORMME will automatically discover your schema and optimize performance\n'))
    } else {
      console.log(chalk.yellow(`⚠️ Database not found: ${databasePath}`))
      console.log(chalk.gray('NOORMME will create the database and set up automation when you first use it\n'))
    }

    // Interactive setup for automation options
    let autoOptimize = options.autoOptimize !== false // Default to true
    let autoIndex = options.autoIndex !== false // Default to true
    
    if (options.autoOptimize === undefined && options.autoIndex === undefined) {
      const automationAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'autoOptimize',
          message: 'Enable automatic SQLite performance optimization?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'autoIndex',
          message: 'Enable intelligent index recommendations?',
          default: true,
        },
      ])
      autoOptimize = automationAnswers.autoOptimize
      autoIndex = automationAnswers.autoIndex
    }

    // Confirm setup
    const confirmation = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: `Ready to initialize NOORMME with complete automation?`,
        default: true,
      },
    ])

    if (!confirmation.proceed) {
      console.log(chalk.yellow('Initialization cancelled.'))
      return
    }

    // Generate files with automation focus
    await generateDbFile(databasePath, outputDir, options.force, autoOptimize, autoIndex)
    await generateEnvExample(databasePath)
    await generateAutomationConfig(databasePath, autoOptimize, autoIndex)
    await generateReadme()
    await generatePackageScripts()

    console.log(chalk.green.bold('\n✅ NOORMME initialized with complete automation!\n'))
    console.log(chalk.blue('🚀 What NOORMME will do automatically:'))
    console.log(chalk.gray('✅ Discover your existing database schema'))
    console.log(chalk.gray('✅ Generate TypeScript types with full type safety'))
    console.log(chalk.gray('✅ Create repository classes with intelligent CRUD methods'))
    console.log(chalk.gray('✅ Optimize SQLite performance with PRAGMA settings'))
    console.log(chalk.gray('✅ Recommend indexes based on your query patterns'))
    console.log(chalk.gray('✅ Validate and fix foreign key constraints\n'))

    console.log(chalk.blue('📋 Next steps:'))
    console.log(chalk.gray('1. Run: npx noormme inspect (to explore your database)'))
    console.log(chalk.gray('2. Run: npx noormme generate (to create TypeScript types)'))
    console.log(chalk.gray('3. Run: npx noormme optimize (to optimize performance)'))
    console.log(chalk.gray('4. Start using auto-generated repositories in your code\n'))

    console.log(chalk.yellow('💡 Pro tips:'))
    console.log(chalk.gray('• Use "npx noormme watch" for continuous optimization'))
    console.log(chalk.gray('• Run "npx noormme status" to monitor automation'))
    console.log(chalk.gray('• Point NOORMME at your existing database - zero setup required!'))

  } catch (error) {
    console.error(chalk.red('❌ Initialization failed:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

async function checkDatabaseExists(databasePath: string): Promise<boolean> {
  try {
    await fs.access(databasePath)
    return true
  } catch {
    return false
  }
}

async function generateDbFile(
  databasePath: string,
  outputDir: string,
  force?: boolean,
  autoOptimize?: boolean,
  autoIndex?: boolean
): Promise<void> {
  const dbFilePath = path.join(outputDir, 'db.ts')

  // Check if file exists and force is not set
  try {
    await fs.access(dbFilePath)
    if (!force) {
      const overwrite = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `File ${dbFilePath} already exists. Overwrite?`,
          default: false,
        },
      ])
      if (!overwrite.overwrite) {
        console.log(chalk.yellow(`Skipped: ${dbFilePath}`))
        return
      }
    }
  } catch {
    // File doesn't exist, safe to create
  }

  const dbFileContent = `import { NOORMME } from 'noormme'

// NOORMME with complete SQLite automation
// Automatically discovers schema, generates types, and optimizes performance
const database = new NOORMME({
  dialect: 'sqlite',
  connection: { database: '${databasePath}' },
  
  // Complete automation enabled
  performance: {
    enableAutoOptimization: ${autoOptimize},
    enableQueryOptimization: true,
    enableAutoIndexing: ${autoIndex},
    enableCaching: true,
    enableBatchOperations: true,
    maxCacheSize: 1000
  },

  // SQLite-specific optimizations
  sqlite: {
    enableWALMode: true,
    enableForeignKeys: true,
    cacheSize: -64000, // 64MB
    synchronous: 'NORMAL',
    tempStore: 'MEMORY',
    autoVacuumMode: 'INCREMENTAL'
  },

  // Logging for development
  logging: {
    enabled: process.env.NODE_ENV !== 'production',
    level: 'info',
    includeQueryTime: true
  }
})

// Initialize with complete automation
export async function initializeDatabase() {
  await database.initialize()
  console.log('🎉 NOORMME initialized with complete SQLite automation!')
  console.log('✅ Schema discovered automatically')
  console.log('✅ Types generated automatically')
  console.log('✅ Performance optimized automatically')
}

// Get a repository for any table (auto-generated)
export function getRepository<T>(tableName: string) {
  return database.getRepository<T>(tableName)
}

// Get Kysely instance for complex queries
export function getKysely() {
  return database.getKysely()
}

// Performance monitoring
export async function getPerformanceMetrics() {
  return await database.getSQLitePerformanceMetrics()
}

// Get optimization recommendations
export async function getOptimizationRecommendations() {
  return await database.getSQLiteIndexRecommendations()
}

// Apply optimizations
export async function applyOptimizations() {
  return await database.applySQLiteOptimizations()
}

// Close database connections
export async function closeDatabase() {
  await database.close()
}
`

  // Ensure directory exists
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(dbFilePath, dbFileContent)
  console.log(chalk.green(`✓ Created: ${dbFilePath}`))
}

async function generateEnvExample(databasePath: string): Promise<void> {
  const envContent = `# NOORMME SQLite Configuration
DATABASE_PATH="${databasePath}"

# Optional: Enable debug logging
# LOG_LEVEL=debug

# Optional: Cache configuration
# CACHE_TTL=300000
# CACHE_MAX_SIZE=1000

# Optional: Automation settings
# AUTO_OPTIMIZE=true
# AUTO_INDEX=true
`

  await fs.writeFile('.env.example', envContent)
  console.log(chalk.green('✓ Created: .env.example'))

  // Also create .env if it doesn't exist
  try {
    await fs.access('.env')
    console.log(chalk.yellow('Note: .env already exists, please update it manually'))
  } catch {
    await fs.writeFile('.env', envContent)
    console.log(chalk.green('✓ Created: .env'))
  }
}

async function generateAutomationConfig(databasePath: string, autoOptimize: boolean, autoIndex: boolean): Promise<void> {
  const configContent = `// NOORMME Automation Configuration
// This file contains the automation settings for your project

export const noormmeConfig = {
  database: '${databasePath}',
  
  // Complete automation settings
  automation: {
    autoOptimize: ${autoOptimize},
    autoIndex: ${autoIndex},
    enableQueryAnalysis: true,
    enablePerformanceMonitoring: true,
    enableSchemaWatcher: false // Set to true for development
  },

  // Performance settings
  performance: {
    enableCaching: true,
    maxCacheSize: 1000,
    slowQueryThreshold: 1000,
    enableBatchOperations: true
  },

  // SQLite optimizations
  sqlite: {
    enableWALMode: true,
    enableForeignKeys: true,
    cacheSize: -64000, // 64MB
    synchronous: 'NORMAL',
    tempStore: 'MEMORY',
    autoVacuumMode: 'INCREMENTAL'
  }
}

// Usage example:
// import { NOORMME } from 'noormme'
// import { noormmeConfig } from './automation.config'
// 
// const db = new NOORMME({
//   dialect: 'sqlite',
//   connection: { database: noormmeConfig.database },
//   ...noormmeConfig
// })
`

  await fs.writeFile('automation.config.ts', configContent)
  console.log(chalk.green('✓ Created: automation.config.ts'))
}

async function generateReadme(): Promise<void> {
  const readmeContent = `# NOORMME - Complete SQLite Automation

This project uses NOORMME (No ORM, just magic!) for complete SQLite automation.

## 🚀 What NOORMME Does Automatically

✅ **Schema Discovery**: Automatically introspects your existing SQLite database  
✅ **Type Generation**: Creates TypeScript types with full type safety  
✅ **Repository Creation**: Generates optimized CRUD repositories with intelligent methods  
✅ **Performance Optimization**: Continuously optimizes SQLite with PRAGMA settings  
✅ **Index Management**: Recommends and manages indexes based on query patterns  
✅ **Migration Automation**: Handles schema changes with intelligent strategies  

## Quick Start

\`\`\`typescript
import { db, initializeDatabase } from './lib/db'

// Initialize with complete automation
await initializeDatabase()

// Get auto-generated repository for any table
const userRepo = db.getRepository('users')

// Use intelligent CRUD methods
const users = await userRepo.findAll()
const user = await userRepo.findById(1)
const activeUsers = await userRepo.findManyByStatus('active')

// Type-safe operations
const newUser = await userRepo.create({
  name: 'John Doe',
  email: 'john@example.com'
})

// Complex queries with Kysely
const kysely = db.getKysely()
const result = await kysely
  .selectFrom('users')
  .innerJoin('posts', 'posts.user_id', 'users.id')
  .select(['users.name', 'posts.title'])
  .where('users.status', '=', 'active')
  .execute()
\`\`\`

## CLI Commands

\`\`\`bash
# Zero-config setup
npx noormme init

# Inspect database with automation insights
npx noormme inspect --optimizations

# Generate TypeScript types and repositories
npx noormme generate

# Optimize SQLite performance automatically
npx noormme optimize

# Analyze query patterns and get recommendations
npx noormme analyze --report

# Manage migrations with automation
npx noormme migrate --latest

# Monitor schema changes and auto-optimize
npx noormme watch --auto-optimize

# Check automation status and metrics
npx noormme status
\`\`\`

## Configuration

Your \`.env\` file is already configured:

\`\`\`
DATABASE_PATH="./database.sqlite"
AUTO_OPTIMIZE=true
AUTO_INDEX=true
\`\`\`

## Available Repository Methods

Every repository automatically includes:

### Basic CRUD
- \`findById(id)\` - Find by primary key
- \`findAll()\` - Get all records
- \`create(data)\` - Create new record
- \`update(id, data)\` - Update existing record
- \`delete(id)\` - Delete by primary key

### Advanced Features
- \`count()\` - Count total records
- \`exists(id)\` - Check if record exists
- \`paginate(options)\` - Paginated results with sorting and filtering

### Dynamic Finders
- \`findByEmail(email)\` - Find by any column
- \`findManyByStatus(status)\` - Find multiple by any column

### Performance Monitoring
- \`getPerformanceMetrics()\` - Get SQLite performance data
- \`getOptimizationRecommendations()\` - Get index recommendations
- \`applyOptimizations()\` - Apply performance optimizations

## Automation Features

### Performance Optimization
- Automatic PRAGMA optimization
- WAL mode for better concurrency
- Intelligent cache sizing
- Foreign key constraint validation

### Index Management
- Query pattern analysis
- Automatic index recommendations
- Performance impact assessment
- Smart index creation

### Schema Monitoring
- Real-time schema change detection
- Automatic optimization triggers
- Migration recommendations
- Performance degradation alerts

## Error Handling

NOORMME provides intelligent error messages with actionable suggestions:

\`\`\`typescript
try {
  await userRepo.findByInvalidColumn('test')
} catch (error) {
  // Enhanced error with suggestions
  console.log(error.getFormattedMessage())
  // Output: Column 'invalid_column' not found. Did you mean 'email'?
}
\`\`\`

## Pro Tips

- Point NOORMME at your existing SQLite database - zero setup required!
- Use \`npx noormme watch\` during development for continuous optimization
- Check \`npx noormme status\` regularly to monitor automation effectiveness
- Run \`npx noormme analyze --report\` for detailed performance insights

## Learn More

- [NOORMME Documentation](https://github.com/cardsorting/noormme)
- [SQLite Optimization Guide](https://www.sqlite.org/optoverview.html)
- [Kysely Query Builder](https://github.com/koskimas/kysely)
`

  await fs.writeFile('NOORMME_README.md', readmeContent)
  console.log(chalk.green('✓ Created: NOORMME_README.md'))
}

async function generatePackageScripts(): Promise<void> {
  // Try to read existing package.json
  try {
    const packageJsonPath = 'package.json'
    const packageContent = await fs.readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageContent)

    // Add NOORMME scripts if not present
    if (!packageJson.scripts) {
      packageJson.scripts = {}
    }

    const noormmeScripts = {
      'db:init': 'noormme init',
      'db:inspect': 'noormme inspect',
      'db:generate': 'noormme generate',
      'db:optimize': 'noormme optimize',
      'db:analyze': 'noormme analyze --report',
      'db:migrate': 'noormme migrate --latest',
      'db:watch': 'noormme watch --auto-optimize',
      'db:status': 'noormme status'
    }

    let hasChanges = false
    for (const [key, value] of Object.entries(noormmeScripts)) {
      if (!packageJson.scripts[key]) {
        packageJson.scripts[key] = value
        hasChanges = true
      }
    }

    if (hasChanges) {
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
      console.log(chalk.green('✓ Updated: package.json (added NOORMME automation scripts)'))
    }
  } catch {
    console.log(chalk.yellow('Note: Could not update package.json scripts automatically'))
  }
}