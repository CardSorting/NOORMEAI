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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
const inquirer_1 = __importDefault(require("inquirer"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const security_validator_js_1 = require("../../util/security-validator.js");
async function init(options) {
    console.log(chalk_1.default.blue.bold('\n🎯 NOORMME Zero-Configuration Setup\n'));
    console.log(chalk_1.default.gray('Setting up NOORMME with complete SQLite automation...\n'));
    try {
        // SECURITY: Validate and sanitize database path to prevent path traversal attacks
        const databasePathInput = options.database || './database.sqlite';
        const databasePath = (0, security_validator_js_1.sanitizeDatabasePath)(databasePathInput);
        // SECURITY: Validate output directory to prevent path traversal attacks
        const outputDir = options.output || 'lib';
        (0, security_validator_js_1.validateOutputDirectory)(outputDir);
        console.log(chalk_1.default.blue('🔍 Detecting existing SQLite database...'));
        // Check if database exists
        const dbExists = await checkDatabaseExists(databasePath);
        if (dbExists) {
            console.log(chalk_1.default.green(`✅ Found existing database: ${databasePath}`));
            console.log(chalk_1.default.gray('NOORMME will automatically discover your schema and optimize performance\n'));
        }
        else {
            console.log(chalk_1.default.yellow(`⚠️ Database not found: ${databasePath}`));
            console.log(chalk_1.default.gray('NOORMME will create the database and set up automation when you first use it\n'));
        }
        // Interactive setup for automation options
        let autoOptimize = options.autoOptimize !== false; // Default to true
        let autoIndex = options.autoIndex !== false; // Default to true
        if (options.autoOptimize === undefined && options.autoIndex === undefined) {
            const automationAnswers = await inquirer_1.default.prompt([
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
            ]);
            autoOptimize = automationAnswers.autoOptimize;
            autoIndex = automationAnswers.autoIndex;
        }
        // Confirm setup
        const confirmation = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: `Ready to initialize NOORMME with complete automation?`,
                default: true,
            },
        ]);
        if (!confirmation.proceed) {
            console.log(chalk_1.default.yellow('Initialization cancelled.'));
            return;
        }
        // Generate files with automation focus
        await generateDbFile(databasePath, outputDir, options.force, autoOptimize, autoIndex);
        await generateEnvExample(databasePath);
        await generateAutomationConfig(databasePath, autoOptimize, autoIndex);
        await generateReadme();
        await generatePackageScripts();
        console.log(chalk_1.default.green.bold('\n✅ NOORMME initialized with complete automation!\n'));
        console.log(chalk_1.default.blue('🚀 What NOORMME will do automatically:'));
        console.log(chalk_1.default.gray('✅ Discover your existing database schema'));
        console.log(chalk_1.default.gray('✅ Generate TypeScript types with full type safety'));
        console.log(chalk_1.default.gray('✅ Create repository classes with intelligent CRUD methods'));
        console.log(chalk_1.default.gray('✅ Optimize SQLite performance with PRAGMA settings'));
        console.log(chalk_1.default.gray('✅ Recommend indexes based on your query patterns'));
        console.log(chalk_1.default.gray('✅ Validate and fix foreign key constraints\n'));
        console.log(chalk_1.default.blue('📋 Next steps:'));
        console.log(chalk_1.default.gray('1. Run: npx noormme inspect (to explore your database)'));
        console.log(chalk_1.default.gray('2. Run: npx noormme generate (to create TypeScript types)'));
        console.log(chalk_1.default.gray('3. Run: npx noormme optimize (to optimize performance)'));
        console.log(chalk_1.default.gray('4. Start using auto-generated repositories in your code\n'));
        console.log(chalk_1.default.yellow('💡 Pro tips:'));
        console.log(chalk_1.default.gray('• Use "npx noormme watch" for continuous optimization'));
        console.log(chalk_1.default.gray('• Run "npx noormme status" to monitor automation'));
        console.log(chalk_1.default.gray('• Point NOORMME at your existing database - zero setup required!'));
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Initialization failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
async function checkDatabaseExists(databasePath) {
    try {
        await fs_1.promises.access(databasePath);
        return true;
    }
    catch {
        return false;
    }
}
async function generateDbFile(databasePath, outputDir, force, autoOptimize, autoIndex) {
    const dbFilePath = path.join(outputDir, 'db.ts');
    // Check if file exists and force is not set
    try {
        await fs_1.promises.access(dbFilePath);
        if (!force) {
            const overwrite = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'overwrite',
                    message: `File ${dbFilePath} already exists. Overwrite?`,
                    default: false,
                },
            ]);
            if (!overwrite.overwrite) {
                console.log(chalk_1.default.yellow(`Skipped: ${dbFilePath}`));
                return;
            }
        }
    }
    catch {
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
`;
    // Ensure directory exists
    await fs_1.promises.mkdir(outputDir, { recursive: true });
    await fs_1.promises.writeFile(dbFilePath, dbFileContent);
    console.log(chalk_1.default.green(`✓ Created: ${dbFilePath}`));
}
async function generateEnvExample(databasePath) {
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
`;
    await fs_1.promises.writeFile('.env.example', envContent);
    console.log(chalk_1.default.green('✓ Created: .env.example'));
    // Also create .env if it doesn't exist
    try {
        await fs_1.promises.access('.env');
        console.log(chalk_1.default.yellow('Note: .env already exists, please update it manually'));
    }
    catch {
        await fs_1.promises.writeFile('.env', envContent);
        console.log(chalk_1.default.green('✓ Created: .env'));
    }
}
async function generateAutomationConfig(databasePath, autoOptimize, autoIndex) {
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
`;
    await fs_1.promises.writeFile('automation.config.ts', configContent);
    console.log(chalk_1.default.green('✓ Created: automation.config.ts'));
}
async function generateReadme() {
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
`;
    await fs_1.promises.writeFile('NOORMME_README.md', readmeContent);
    console.log(chalk_1.default.green('✓ Created: NOORMME_README.md'));
}
async function generatePackageScripts() {
    // Try to read existing package.json
    try {
        const packageJsonPath = 'package.json';
        const packageContent = await fs_1.promises.readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        // Add NOORMME scripts if not present
        if (!packageJson.scripts) {
            packageJson.scripts = {};
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
        };
        let hasChanges = false;
        for (const [key, value] of Object.entries(noormmeScripts)) {
            if (!packageJson.scripts[key]) {
                packageJson.scripts[key] = value;
                hasChanges = true;
            }
        }
        if (hasChanges) {
            await fs_1.promises.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
            console.log(chalk_1.default.green('✓ Updated: package.json (added NOORMME automation scripts)'));
        }
    }
    catch {
        console.log(chalk_1.default.yellow('Note: Could not update package.json scripts automatically'));
    }
}
