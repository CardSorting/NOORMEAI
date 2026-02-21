import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'fs'
import * as path from 'path'
import { init } from '../../../src/cli/commands/init.js'
import { createTestContext, cleanupTestContext, mockInquirerResponses, ConsoleCapture } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Init Command', () => {
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

  describe('Basic initialization', () => {
    it('should initialize with default database path', async () => {
      mockInquirerResponses({
        autoOptimize: true,
        autoIndex: true,
        proceed: true
      })

      await init({
        database: './test.sqlite',
        output: 'lib',
        force: false,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('NOORMME initialized with complete automation')).toBe(true)
      expect(consoleCapture.hasOutput('Zero-configuration SQLite automation')).toBe(true)
    })

    it('should create database configuration file', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      const dbFilePath = path.join('lib', 'db.ts')
      const dbFileExists = await fs.access(dbFilePath).then(() => true).catch(() => false)
      expect(dbFileExists).toBe(true)

      const dbFileContent = await fs.readFile(dbFilePath, 'utf8')
      expect(dbFileContent).toContain('NOORMME with complete SQLite automation')
      expect(dbFileContent).toContain('enableAutoOptimization: true')
      expect(dbFileContent).toContain('enableAutoIndexing: true')
    })

    it('should create environment configuration files', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      // Check .env.example
      const envExampleExists = await fs.access('.env.example').then(() => true).catch(() => false)
      expect(envExampleExists).toBe(true)

      const envExampleContent = await fs.readFile('.env.example', 'utf8')
      expect(envExampleContent).toContain('DATABASE_PATH')
      expect(envExampleContent).toContain('AUTO_OPTIMIZE')
      expect(envExampleContent).toContain('AUTO_INDEX')

      // Check .env (if it doesn't exist)
      const envExists = await fs.access('.env').then(() => true).catch(() => false)
      if (!envExists) {
        const envContent = await fs.readFile('.env', 'utf8')
        expect(envContent).toContain('DATABASE_PATH')
      }
    })

    it('should create automation configuration file', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      const configExists = await fs.access('automation.config.ts').then(() => true).catch(() => false)
      expect(configExists).toBe(true)

      const configContent = await fs.readFile('automation.config.ts', 'utf8')
      expect(configContent).toContain('noormmeConfig')
      expect(configContent).toContain('autoOptimize: true')
      expect(configContent).toContain('autoIndex: true')
    })

    it('should create comprehensive README file', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      const readmeExists = await fs.access('NOORMME_README.md').then(() => true).catch(() => false)
      expect(readmeExists).toBe(true)

      const readmeContent = await fs.readFile('NOORMME_README.md', 'utf8')
      expect(readmeContent).toContain('NOORMME - Complete SQLite Automation')
      expect(readmeContent).toContain('What NOORMME Does Automatically')
      expect(readmeContent).toContain('CLI Commands')
      expect(readmeContent).toContain('Zero-configuration SQLite automation')
    })
  })

  describe('Automation options', () => {
    it('should handle auto-optimization disabled', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: false,
        autoIndex: true
      })

      const dbFileContent = await fs.readFile(path.join('lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toContain('enableAutoOptimization: false')
      expect(dbFileContent).toContain('enableAutoIndexing: true')
    })

    it('should handle auto-indexing disabled', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: false
      })

      const dbFileContent = await fs.readFile(path.join('lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toContain('enableAutoOptimization: true')
      expect(dbFileContent).toContain('enableAutoIndexing: false')
    })

    it('should handle both automation features disabled', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: false,
        autoIndex: false
      })

      const dbFileContent = await fs.readFile(path.join('lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toContain('enableAutoOptimization: false')
      expect(dbFileContent).toContain('enableAutoIndexing: false')
    })
  })

  describe('Interactive prompts', () => {
    it('should prompt for automation options when not provided', async () => {
      mockInquirerResponses({
        autoOptimize: false,
        autoIndex: true,
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true
        // autoOptimize and autoIndex not provided - should prompt
      })

      const dbFileContent = await fs.readFile(path.join('lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toContain('enableAutoOptimization: false')
      expect(dbFileContent).toContain('enableAutoIndexing: true')
    })

    it('should handle cancellation', async () => {
      mockInquirerResponses({
        proceed: false
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('Initialization cancelled')).toBe(true)
      
      // Should not create files when cancelled
      const dbFileExists = await fs.access(path.join('lib', 'db.ts')).then(() => true).catch(() => false)
      expect(dbFileExists).toBe(false)
    })
  })

  describe('File handling', () => {
    it('should handle existing files with force option', async () => {
      // Create existing file
      await fs.mkdir('lib', { recursive: true })
      await fs.writeFile(path.join('lib', 'db.ts'), 'existing content')

      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      const dbFileContent = await fs.readFile(path.join('lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toContain('NOORMME with complete SQLite automation')
      expect(dbFileContent).not.toContain('existing content')
    })

    it('should prompt for overwrite when file exists and force is false', async () => {
      // Create existing file
      await fs.mkdir('lib', { recursive: true })
      await fs.writeFile(path.join('lib', 'db.ts'), 'existing content')

      mockInquirerResponses({
        overwrite: true,
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: false,
        autoOptimize: true,
        autoIndex: true
      })

      const dbFileContent = await fs.readFile(path.join('lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toContain('NOORMME with complete SQLite automation')
    })

    it('should skip file creation when overwrite is declined', async () => {
      // Create existing file
      await fs.mkdir('lib', { recursive: true })
      await fs.writeFile(path.join('lib', 'db.ts'), 'existing content')

      mockInquirerResponses({
        overwrite: false,
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: false,
        autoOptimize: true,
        autoIndex: true
      })

      const dbFileContent = await fs.readFile(path.join('lib', 'db.ts'), 'utf8')
      expect(dbFileContent).toBe('existing content')
      expect(consoleCapture.hasOutput('Skipped:')).toBe(true)
    })
  })

  describe('Package.json integration', () => {
    it('should update package.json with NOORMME scripts', async () => {
      // Create package.json
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          'test': 'jest'
        }
      }
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2))

      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      const updatedPackageJson = JSON.parse(await fs.readFile('package.json', 'utf8'))
      expect(updatedPackageJson.scripts['db:init']).toBe('noormme init')
      expect(updatedPackageJson.scripts['db:inspect']).toBe('noormme inspect')
      expect(updatedPackageJson.scripts['db:generate']).toBe('noormme generate')
      expect(updatedPackageJson.scripts['db:optimize']).toBe('noormme optimize')
      expect(updatedPackageJson.scripts['db:analyze']).toBe('noormme analyze --report')
      expect(updatedPackageJson.scripts['db:migrate']).toBe('noormme migrate --latest')
      expect(updatedPackageJson.scripts['db:watch']).toBe('noormme watch --auto-optimize')
      expect(updatedPackageJson.scripts['db:status']).toBe('noormme status')
    })

    it('should handle missing package.json gracefully', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('Could not update package.json')).toBe(true)
    })
  })

  describe('Database detection', () => {
    it('should detect existing database', async () => {
      // Create a mock database file
      await fs.writeFile(testContext.databasePath, 'mock database content')

      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('Found existing database')).toBe(true)
      expect(consoleCapture.hasOutput('NOORMME will automatically discover your schema')).toBe(true)
    })

    it('should handle missing database', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: './nonexistent.sqlite',
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('Database not found')).toBe(true)
      expect(consoleCapture.hasOutput('NOORMME will create the database')).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock NOORMME to throw error
      const mockNOORMME = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed')
      })
      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: mockNOORMME
      }))

      mockInquirerResponses({
        proceed: true
      })

      await expect(init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Initialization failed')).toBe(true)
    })

    it('should handle file system errors', async () => {
      // Mock fs to throw error
      const originalWriteFile = fs.writeFile
      jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Permission denied'))

      mockInquirerResponses({
        proceed: true
      })

      await expect(init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })).rejects.toThrow('Permission denied')

      // Restore original function
      fs.writeFile = originalWriteFile
    })
  })

  describe('Output messages', () => {
    it('should display correct success messages', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('NOORMME initialized with complete automation')).toBe(true)
      expect(consoleCapture.hasOutput('What NOORMME will do automatically')).toBe(true)
      expect(consoleCapture.hasOutput('Schema Discovery')).toBe(true)
      expect(consoleCapture.hasOutput('Type Generation')).toBe(true)
      expect(consoleCapture.hasOutput('Repository Creation')).toBe(true)
      expect(consoleCapture.hasOutput('Performance Optimization')).toBe(true)
      expect(consoleCapture.hasOutput('Index Management')).toBe(true)
      expect(consoleCapture.hasOutput('Migration Automation')).toBe(true)
    })

    it('should display next steps', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('Next steps:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme inspect')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme generate')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme optimize')).toBe(true)
    })

    it('should display pro tips', async () => {
      mockInquirerResponses({
        proceed: true
      })

      await init({
        database: testContext.databasePath,
        output: 'lib',
        force: true,
        autoOptimize: true,
        autoIndex: true
      })

      expect(consoleCapture.hasOutput('Pro tips:')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme watch')).toBe(true)
      expect(consoleCapture.hasOutput('npx noormme status')).toBe(true)
      expect(consoleCapture.hasOutput('zero setup required')).toBe(true)
    })
  })
})
