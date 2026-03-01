#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { init } from './commands/init.js'
import { inspect } from './commands/inspect.js'
import { generate } from './commands/generate.js'
import { optimize } from './commands/optimize.js'
import { analyze } from './commands/analyze.js'


const program = new Command()

program
  .name('noormme')
  .description(
    chalk.blue.bold('NOORMME CLI - Automating SQLite with Intelligence'),
  )
  .version('1.0.0')

// Init command - Zero-configuration setup
program
  .command('init')
  .description('Initialize NOORMME with zero-configuration SQLite automation')
  .option(
    '-d, --database <path>',
    'SQLite database file path',
    './database.sqlite',
  )
  .option('-o, --output <dir>', 'Output directory for generated files', 'lib')
  .option('-f, --force', 'Overwrite existing files')
  .option('--no-auto-optimize', 'Disable automatic SQLite optimization')
  .option('--no-auto-index', 'Disable automatic index recommendations')
  .action(init)

// Inspect command - Enhanced schema discovery
program
  .command('inspect [table]')
  .description('Inspect database schema with automation insights')
  .option('-d, --database <path>', 'SQLite database file path')
  .option('-r, --relationships', 'Show relationships and foreign keys')
  .option('-o, --optimizations', 'Show optimization recommendations')
  .option('-i, --indexes', 'Show index analysis')
  .option('-p, --performance', 'Show performance metrics')
  .action(inspect)

// Generate command - Enhanced type and repository generation
program
  .command('generate')
  .description('Generate TypeScript types, repositories, and automation files')
  .option('-d, --database <path>', 'SQLite database file path')
  .option('-o, --output <dir>', 'Output directory', './generated')
  .option('-t, --types-only', 'Generate only TypeScript types')
  .option('-r, --repos-only', 'Generate only repository classes')
  .option('-f, --format <format>', 'TypeScript output format (dts, ts)', 'dts')
  .action(generate)

// Optimize command - SQLite performance optimization
program
  .command('optimize')
  .description('Optimize SQLite database performance automatically')
  .option('-d, --database <path>', 'SQLite database file path')
  .option('-p, --pragma', 'Apply PRAGMA optimizations')
  .option('-i, --indexes', 'Apply intelligent index recommendations')
  .option('-a, --analyze', 'Run ANALYZE for query optimization')
  .option('-w, --wal', 'Enable WAL mode for better concurrency')
  .option('--dry-run', 'Show what would be optimized without applying changes')
  .action(optimize)

// Analyze command - Query pattern analysis
program
  .command('analyze')
  .description('Analyze query patterns and provide intelligent recommendations')
  .option('-d, --database <path>', 'SQLite database file path')
  .option('-s, --slow-queries', 'Focus on slow query analysis')
  .option('-i, --indexes', 'Generate index recommendations')
  .option('-p, --patterns', 'Show query usage patterns')
  .option('-r, --report', 'Generate detailed performance report')
  .action(analyze)



// Help command
program.addHelpText(
  'after',
  `
${chalk.blue.bold('🚀 NOORMME - Complete SQLite Automation')}

${chalk.green.bold('Quick Start:')}
  $ noormme init                          # Zero-config setup with your existing SQLite database
  $ noormme inspect                       # Discover your database schema automatically
  $ noormme optimize                      # Automatically optimize SQLite performance

${chalk.green.bold('Automation Features:')}
  $ noormme analyze                       # Analyze query patterns and get recommendations

${chalk.green.bold('Development:')}
  $ noormme generate                      # Generate TypeScript types and repositories
  $ noormme inspect users --optimizations # Inspect table with optimization insights
  $ noormme analyze --slow-queries        # Focus on performance bottlenecks

${chalk.green.bold('Zero Configuration:')}
  NOORMME automatically:
  ✅ Discovers all tables, columns, and relationships
  ✅ Generates TypeScript interfaces with full type safety
  ✅ Creates repository classes with intelligent CRUD methods
  ✅ Optimizes SQLite performance with PRAGMA settings
  ✅ Recommends indexes based on your query patterns
  ✅ Validates and fixes foreign key constraints

${chalk.yellow('Environment Variables:')}
  DATABASE_PATH    SQLite database file path (default: ./database.sqlite)

${chalk.yellow('Pro Tips:')}
  • Point NOORMME at your existing SQLite database - no setup required!
  • Use --dry-run with optimize to see what would be improved
  • Check status regularly to monitor automation effectiveness

${chalk.blue('📚 Learn more: https://github.com/noormme/noormme')}
`,
)

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
})

// Handle unknown commands
program.on('command:*', function (operands) {
  console.error(chalk.red(`❌ Unknown command: ${operands[0]}`))
  console.error(chalk.gray('See --help for a list of available commands.'))
  process.exit(1)
})

// Parse command line arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  console.log(
    chalk.blue.bold('\n🎯 NOORMME - Automating SQLite with Intelligence\n'),
  )
  console.log(
    chalk.gray(
      "The only SQLite ORM that automates everything. Built on Kysely's type-safe foundation.\n",
    ),
  )
  program.outputHelp()
}
