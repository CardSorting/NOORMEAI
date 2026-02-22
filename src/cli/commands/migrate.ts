import chalk from 'chalk'
import { NOORMME } from '../../noormme.js'
import { SQLiteMigrationManager } from '../../sqlite-migration/sqlite-migration-manager.js'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

export async function migrate(options: {
  database?: string
  to?: string
  latest?: boolean
  rollback?: boolean
  status?: boolean
  generate?: string
}) {
  console.log(
    chalk.blue.bold(
      '\n🔄 NOORMME Migration Management - Automated Schema Evolution\n',
    ),
  )

  try {
    // Initialize NOORMME with database path
    const databasePath =
      options.database || process.env.DATABASE_PATH || './database.sqlite'
    const db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        database: databasePath,
        host: 'localhost',
        port: 0,
        username: '',
        password: '',
      },
    })
    await db.initialize()

    const migrationManager = SQLiteMigrationManager.getInstance(db.getKysely())
    await migrationManager.initialize()

    console.log(chalk.gray(`📁 Database: ${databasePath}\n`))

    // Generate new migration
    if (options.generate) {
      console.log(chalk.blue(`📝 Generating migration: ${options.generate}`))
      try {
        const migration = await migrationManager.generateMigration(
          options.generate,
        )
        console.log(
          chalk.green(`✅ Migration generated: ${migration.fileName}`),
        )
        console.log(chalk.gray(`📁 Location: ${migration.filePath}`))

        // Show migration content
        if (migration.content) {
          console.log(chalk.blue('\n📄 Migration Content:'))
          console.log(chalk.gray(migration.content))
        }

        console.log(chalk.blue('\n💡 Next steps:'))
        console.log(
          chalk.gray('• Review and modify the generated migration if needed'),
        )
        console.log(
          chalk.gray(
            '• Run "npx noormme migrate --latest" to apply the migration',
          ),
        )
      } catch (error) {
        console.error(
          chalk.red('❌ Migration generation failed:'),
          error instanceof Error ? error.message : error,
        )
      }
      await db.close()
      return
    }

    // Show migration status
    if (
      options.status ||
      (!options.to && !options.latest && !options.rollback)
    ) {
      console.log(chalk.blue('📊 Migration Status:'))
      try {
        const status = await migrationManager.getStatus()

        console.log(chalk.green(`\n📈 Migration Summary:`))
        console.log(
          chalk.gray(`  Current version: ${status.lastMigration || 'None'}`),
        )
        console.log(
          chalk.gray(`  Available migrations: ${status.totalMigrations}`),
        )
        console.log(
          chalk.gray(`  Pending migrations: ${status.pendingMigrations}`),
        )
        console.log(
          chalk.gray(`  Applied migrations: ${status.appliedMigrations}`),
        )

        if (status.appliedList.length > 0) {
          console.log(chalk.green(`\n✅ Applied Migrations:`))
          status.appliedList.forEach((migration: any, index: number) => {
            console.log(
              chalk.gray(
                `  ${index + 1}. ${migration.name} (Applied: ${migration.applied_at})`,
              ),
            )
          })
        }

        const pending = await migrationManager.getPendingMigrations()
        if (pending.length > 0) {
          console.log(chalk.yellow(`\n⏳ Pending Migrations:`))
          pending.forEach((name: string, index: number) => {
            console.log(chalk.gray(`  ${index + 1}. ${name}`))
          })
        }

        if (status.totalMigrations === 0) {
          console.log(
            chalk.gray(
              '\n📝 No migrations found. Create your first migration with:',
            ),
          )
          console.log(
            chalk.gray('npx noormme migrate --generate "initial_schema"'),
          )
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Failed to get migration status:'),
          error instanceof Error ? error.message : error,
        )
      }
    }

    // Migrate to latest version
    if (options.latest) {
      console.log(chalk.blue('🚀 Migrating to latest version...'))
      try {
        const result = await migrationManager.executeMigrations()

        if (result.success) {
          console.log(
            chalk.green(`\n✅ Applied ${result.migrationsApplied} migrations.`),
          )

          if (result.optimizationsApplied.length > 0) {
            console.log(
              chalk.blue(
                `🔧 Applied ${result.optimizationsApplied.length} SQLite optimizations.`,
              ),
            )
          }

          console.log(chalk.green(`\n🎉 Migration completed successfully!`))
        } else {
          console.log(chalk.gray('No migrations to apply or migration failed.'))
          if (result.warnings.length > 0) {
            result.warnings.forEach((w) =>
              console.warn(chalk.yellow(`⚠️ ${w}`)),
            )
          }
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Migration failed:'),
          error instanceof Error ? error.message : error,
        )
      }
    }

    // Rollback last migration
    if (options.rollback) {
      console.log(chalk.blue('⏪ Rolling back last migration...'))
      try {
        const result = await migrationManager.rollbackLastMigration()

        if (result.success) {
          console.log(
            chalk.green(`\n✅ Rollback of record completed successfully!`),
          )
          console.log(
            chalk.gray(`Rolled back record for: ${result.migrationName}`),
          )
        } else {
          console.log(chalk.yellow('No migrations to rollback'))
        }
      } catch (error) {
        console.error(
          chalk.red('❌ Rollback failed:'),
          error instanceof Error ? error.message : error,
        )
      }
    }

    await db.close()
  } catch (error) {
    console.error(
      chalk.red('❌ Migration command failed:'),
      error instanceof Error ? error.message : error,
    )
    process.exit(1)
  }
}
