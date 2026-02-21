import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'fs'
import * as path from 'path'
import { createTestContext, cleanupTestContext, ConsoleCapture, runCLICommand } from '../utils/test-helpers.js'

describe('CLI Integration Workflows', () => {
  let testContext: any
  let consoleCapture: ConsoleCapture

  beforeEach(async () => {
    testContext = await createTestContext()
    consoleCapture = new ConsoleCapture()
    consoleCapture.start()
  })

  afterEach(async () => {
    consoleCapture.stop()
    await cleanupTestContext(testContext)
  })

  describe('Complete initialization workflow', () => {
    it('should handle full project initialization workflow', async () => {
      // Step 1: Initialize NOORMME
      const initResult = await runCLICommand('npx noormme init --database ./test.sqlite --force --auto-optimize --auto-index', {
        cwd: testContext.tempDir
      })

      expect(initResult.exitCode).toBe(0)
      expect(initResult.stdout).toContain('NOORMME initialized with complete automation')

      // Check that files were created
      const dbFileExists = await fs.access(path.join(testContext.tempDir, 'lib', 'db.ts')).then(() => true).catch(() => false)
      const packageJsonExists = await fs.access(path.join(testContext.tempDir, 'package.json')).then(() => true).catch(() => false)

      expect(dbFileExists).toBe(true)
      expect(packageJsonExists).toBe(true)

      // Step 2: Inspect the database
      const inspectResult = await runCLICommand('npx noormme inspect', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './test.sqlite' }
      })

      expect(inspectResult.exitCode).toBe(0)
      expect(inspectResult.stdout).toContain('NOORMME Schema Inspection')

      // Step 3: Generate types and repositories
      const generateResult = await runCLICommand('npx noormme generate', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './test.sqlite' }
      })

      expect(generateResult.exitCode).toBe(0)
      expect(generateResult.stdout).toContain('NOORMME Code Generation')

      // Check that generated files exist
      const typesExists = await fs.access(path.join(testContext.tempDir, 'generated', 'database.d.ts')).then(() => true).catch(() => false)
      const reposExists = await fs.access(path.join(testContext.tempDir, 'generated', 'repositories.ts')).then(() => true).catch(() => false)

      expect(typesExists).toBe(true)
      expect(reposExists).toBe(true)

      // Step 4: Optimize the database
      const optimizeResult = await runCLICommand('npx noormme optimize', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './test.sqlite' }
      })

      expect(optimizeResult.exitCode).toBe(0)
      expect(optimizeResult.stdout).toContain('NOORMME SQLite Optimization')

      // Step 5: Check status
      const statusResult = await runCLICommand('npx noormme status', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './test.sqlite' }
      })

      expect(statusResult.exitCode).toBe(0)
      expect(statusResult.stdout).toContain('NOORMME Automation Status')
    })
  })

  describe('Development workflow', () => {
    it('should handle typical development workflow', async () => {
      // Initialize project
      await runCLICommand('npx noormme init --database ./dev.sqlite --force', {
        cwd: testContext.tempDir
      })

      // Create a mock database with some tables
      await fs.writeFile(path.join(testContext.tempDir, 'dev.sqlite'), 'mock database')

      // Inspect database
      const inspectResult = await runCLICommand('npx noormme inspect --relationships --optimizations', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './dev.sqlite' }
      })

      expect(inspectResult.exitCode).toBe(0)
      expect(inspectResult.stdout).toContain('Relationships:')
      expect(inspectResult.stdout).toContain('Optimization Overview:')

      // Generate code
      const generateResult = await runCLICommand('npx noormme generate --types-only', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './dev.sqlite' }
      })

      expect(generateResult.exitCode).toBe(0)

      // Analyze performance
      const analyzeResult = await runCLICommand('npx noormme analyze --report', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './dev.sqlite' }
      })

      expect(analyzeResult.exitCode).toBe(0)
      expect(analyzeResult.stdout).toContain('Performance Report')

      // Optimize
      const optimizeResult = await runCLICommand('npx noormme optimize --pragma --indexes', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './dev.sqlite' }
      })

      expect(optimizeResult.exitCode).toBe(0)

      // Check final status
      const statusResult = await runCLICommand('npx noormme status --metrics', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './dev.sqlite' }
      })

      expect(statusResult.exitCode).toBe(0)
      expect(statusResult.stdout).toContain('Performance Metrics:')
    })
  })

  describe('Migration workflow', () => {
    it('should handle migration workflow', async () => {
      // Initialize project
      await runCLICommand('npx noormme init --database ./migrate.sqlite --force', {
        cwd: testContext.tempDir
      })

      await fs.writeFile(path.join(testContext.tempDir, 'migrate.sqlite'), 'mock database')

      // Check migration status
      const statusResult = await runCLICommand('npx noormme migrate --status', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './migrate.sqlite' }
      })

      expect(statusResult.exitCode).toBe(0)
      expect(statusResult.stdout).toContain('Migration Status:')

      // Generate a migration
      const generateResult = await runCLICommand('npx noormme migrate --generate add_user_profile', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './migrate.sqlite' }
      })

      expect(generateResult.exitCode).toBe(0)
      expect(generateResult.stdout).toContain('Generating Migration: add_user_profile')

      // Migrate to latest
      const migrateResult = await runCLICommand('npx noormme migrate --latest', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './migrate.sqlite' }
      })

      expect(migrateResult.exitCode).toBe(0)
      expect(migrateResult.stdout).toContain('Migrating to Latest Version')

      // Check status again
      const finalStatusResult = await runCLICommand('npx noormme migrate', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './migrate.sqlite' }
      })

      expect(finalStatusResult.exitCode).toBe(0)
    })
  })

  describe('Monitoring workflow', () => {
    it('should handle monitoring and analysis workflow', async () => {
      // Initialize project
      await runCLICommand('npx noormme init --database ./monitor.sqlite --force', {
        cwd: testContext.tempDir
      })

      await fs.writeFile(path.join(testContext.tempDir, 'monitor.sqlite'), 'mock database')

      // Analyze query patterns
      const analyzeResult = await runCLICommand('npx noormme analyze --patterns --slow-queries', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './monitor.sqlite' }
      })

      expect(analyzeResult.exitCode).toBe(0)
      expect(analyzeResult.stdout).toContain('Query Pattern Analysis:')

      // Get comprehensive status
      const statusResult = await runCLICommand('npx noormme status --metrics --optimizations --cache', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './monitor.sqlite' }
      })

      expect(statusResult.exitCode).toBe(0)
      expect(statusResult.stdout).toContain('Performance Metrics:')
      expect(statusResult.stdout).toContain('Applied Optimizations:')
      expect(statusResult.stdout).toContain('Cache Status:')

      // Test watch command (with timeout to avoid hanging)
      const watchResult = await runCLICommand('timeout 5s npx noormme watch --interval 1000', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './monitor.sqlite' }
      })

      // Watch command should start successfully (exit code might be 124 due to timeout)
      expect([0, 124]).toContain(watchResult.exitCode)
    })
  })

  describe('Error handling workflow', () => {
    it('should handle errors gracefully across commands', async () => {
      // Try to run commands without initialization
      const inspectResult = await runCLICommand('npx noormme inspect', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './nonexistent.sqlite' }
      })

      // Should handle missing database gracefully
      expect(inspectResult.exitCode).toBe(1)
      expect(inspectResult.stderr).toContain('Inspection failed')

      // Try to generate without database
      const generateResult = await runCLICommand('npx noormme generate', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './nonexistent.sqlite' }
      })

      expect(generateResult.exitCode).toBe(1)
      expect(generateResult.stderr).toContain('Code generation failed')

      // Try to optimize without database
      const optimizeResult = await runCLICommand('npx noormme optimize', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './nonexistent.sqlite' }
      })

      expect(optimizeResult.exitCode).toBe(1)
      expect(optimizeResult.stderr).toContain('Optimization failed')

      // Try to analyze without database
      const analyzeResult = await runCLICommand('npx noormme analyze', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './nonexistent.sqlite' }
      })

      expect(analyzeResult.exitCode).toBe(1)
      expect(analyzeResult.stderr).toContain('Analysis failed')

      // Try to get status without database
      const statusResult = await runCLICommand('npx noormme status', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './nonexistent.sqlite' }
      })

      expect(statusResult.exitCode).toBe(1)
      expect(statusResult.stderr).toContain('Status check failed')
    })
  })

  describe('Environment variable workflow', () => {
    it('should use environment variables consistently', async () => {
      // Initialize with environment variable
      await runCLICommand('npx noormme init --force', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './env.sqlite' }
      })

      await fs.writeFile(path.join(testContext.tempDir, 'env.sqlite'), 'mock database')

      // All commands should use the same database path from environment
      const inspectResult = await runCLICommand('npx noormme inspect', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './env.sqlite' }
      })

      expect(inspectResult.exitCode).toBe(0)
      expect(inspectResult.stdout).toContain('Database: ./env.sqlite')

      const generateResult = await runCLICommand('npx noormme generate', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './env.sqlite' }
      })

      expect(generateResult.exitCode).toBe(0)

      const optimizeResult = await runCLICommand('npx noormme optimize', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './env.sqlite' }
      })

      expect(optimizeResult.exitCode).toBe(0)

      const statusResult = await runCLICommand('npx noormme status', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './env.sqlite' }
      })

      expect(statusResult.exitCode).toBe(0)
      expect(statusResult.stdout).toContain('Database: ./env.sqlite')
    })
  })

  describe('Package.json scripts workflow', () => {
    it('should work with package.json scripts', async () => {
      // Initialize project
      await runCLICommand('npx noormme init --database ./scripts.sqlite --force', {
        cwd: testContext.tempDir
      })

      await fs.writeFile(path.join(testContext.tempDir, 'scripts.sqlite'), 'mock database')

      // Test package.json scripts
      const scripts = [
        'npm run db:inspect',
        'npm run db:generate',
        'npm run db:optimize',
        'npm run db:analyze',
        'npm run db:status'
      ]

      for (const script of scripts) {
        const result = await runCLICommand(script, {
          cwd: testContext.tempDir,
          env: { DATABASE_PATH: './scripts.sqlite' }
        })

        expect(result.exitCode).toBe(0)
      }
    })
  })

  describe('Configuration workflow', () => {
    it('should handle different configuration options', async () => {
      // Initialize with specific options
      await runCLICommand('npx noormme init --database ./config.sqlite --force --no-auto-optimize --no-auto-index', {
        cwd: testContext.tempDir
      })

      await fs.writeFile(path.join(testContext.tempDir, 'config.sqlite'), 'mock database')

      // Check that configuration was applied
      const dbFileContent = await fs.readFile(path.join(testContext.tempDir, 'lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toContain('enableAutoOptimization: false')
      expect(dbFileContent).toContain('enableAutoIndexing: false')

      // Test different output formats
      const generateResult = await runCLICommand('npx noormme generate --format ts --output typescript', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './config.sqlite' }
      })

      expect(generateResult.exitCode).toBe(0)

      // Check that .ts files were generated
      const typesExists = await fs.access(path.join(testContext.tempDir, 'typescript', 'database.ts')).then(() => true).catch(() => false)
      expect(typesExists).toBe(true)
    })
  })

  describe('Performance testing workflow', () => {
    it('should handle performance analysis workflow', async () => {
      // Initialize project
      await runCLICommand('npx noormme init --database ./perf.sqlite --force', {
        cwd: testContext.tempDir
      })

      await fs.writeFile(path.join(testContext.tempDir, 'perf.sqlite'), 'mock database')

      // Run comprehensive performance analysis
      const analyzeResult = await runCLICommand('npx noormme analyze --patterns --slow-queries --indexes --report', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './perf.sqlite' }
      })

      expect(analyzeResult.exitCode).toBe(0)
      expect(analyzeResult.stdout).toContain('Query Pattern Analysis:')
      expect(analyzeResult.stdout).toContain('Analyzing Slow Queries')
      expect(analyzeResult.stdout).toContain('Generating Index Recommendations')
      expect(analyzeResult.stdout).toContain('Generating Detailed Performance Report')

      // Apply optimizations
      const optimizeResult = await runCLICommand('npx noormme optimize --pragma --indexes --analyze --wal', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './perf.sqlite' }
      })

      expect(optimizeResult.exitCode).toBe(0)

      // Check performance status
      const statusResult = await runCLICommand('npx noormme status --metrics --optimizations', {
        cwd: testContext.tempDir,
        env: { DATABASE_PATH: './perf.sqlite' }
      })

      expect(statusResult.exitCode).toBe(0)
      expect(statusResult.stdout).toContain('Performance Metrics:')
      expect(statusResult.stdout).toContain('Applied Optimizations:')
    })
  })
})
