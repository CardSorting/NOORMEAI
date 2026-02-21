import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'fs'
import * as path from 'path'
import { generate } from '../../../src/cli/commands/generate.js'
import { createTestContext, cleanupTestContext, ConsoleCapture } from '../utils/test-helpers.js'

// Mock NOORMME
jest.mock('../../../src/noormme.js', () => ({
  NOORMME: jest.fn().mockImplementation(() => global.createMockNOORMME())
}))

describe('CLI Generate Command', () => {
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

  describe('Basic code generation', () => {
    it('should generate all files by default', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      expect(consoleCapture.hasOutput('NOORMME Code Generation')).toBe(true)
      expect(consoleCapture.hasOutput('Automating TypeScript & Repositories')).toBe(true)
      expect(consoleCapture.hasOutput('Discovered 2 tables')).toBe(true)

      // Check that all files were generated
      const typesExists = await fs.access(path.join('generated', 'database.d.ts')).then(() => true).catch(() => false)
      const reposExists = await fs.access(path.join('generated', 'repositories.ts')).then(() => true).catch(() => false)
      const configExists = await fs.access(path.join('generated', 'automation.config.ts')).then(() => true).catch(() => false)
      const examplesExists = await fs.access(path.join('generated', 'usage-examples.ts')).then(() => true).catch(() => false)

      expect(typesExists).toBe(true)
      expect(reposExists).toBe(true)
      expect(configExists).toBe(true)
      expect(examplesExists).toBe(true)

      expect(consoleCapture.hasOutput('Generated TypeScript types: database.d.ts')).toBe(true)
      expect(consoleCapture.hasOutput('Generated repository classes: repositories.ts')).toBe(true)
      expect(consoleCapture.hasOutput('Generated automation config: automation.config.ts')).toBe(true)
      expect(consoleCapture.hasOutput('Generated usage examples: usage-examples.ts')).toBe(true)
    })

    it('should use default output directory', async () => {
      await generate({
        database: testContext.databasePath
      })

      const typesExists = await fs.access(path.join('./generated', 'database.d.ts')).then(() => true).catch(() => false)
      expect(typesExists).toBe(true)
    })

    it('should show generation summary', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      expect(consoleCapture.hasOutput('Generated 4 files successfully')).toBe(true)
      expect(consoleCapture.hasOutput('Next steps:')).toBe(true)
      expect(consoleCapture.hasOutput('Import and use the generated types')).toBe(true)
      expect(consoleCapture.hasOutput('Use the repository classes')).toBe(true)
      expect(consoleCapture.hasOutput('Configure automation settings')).toBe(true)
      expect(consoleCapture.hasOutput('Check usage-examples.ts')).toBe(true)
    })
  })

  describe('Types-only generation', () => {
    it('should generate only TypeScript types when typesOnly is true', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true
      })

      const typesExists = await fs.access(path.join('generated', 'database.d.ts')).then(() => true).catch(() => false)
      const reposExists = await fs.access(path.join('generated', 'repositories.ts')).then(() => true).catch(() => false)

      expect(typesExists).toBe(true)
      expect(reposExists).toBe(false)

      expect(consoleCapture.hasOutput('Generated TypeScript types: database.d.ts')).toBe(true)
      expect(consoleCapture.hasOutput('Generated repository classes')).toBe(false)
    })

    it('should generate TypeScript files when format is ts', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true,
        format: 'ts'
      })

      const typesExists = await fs.access(path.join('generated', 'database.ts')).then(() => true).catch(() => false)
      expect(typesExists).toBe(true)
    })
  })

  describe('Repositories-only generation', () => {
    it('should generate only repository classes when reposOnly is true', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        reposOnly: true
      })

      const typesExists = await fs.access(path.join('generated', 'database.d.ts')).then(() => true).catch(() => false)
      const reposExists = await fs.access(path.join('generated', 'repositories.ts')).then(() => true).catch(() => false)

      expect(typesExists).toBe(false)
      expect(reposExists).toBe(true)

      expect(consoleCapture.hasOutput('Generated TypeScript types')).toBe(false)
      expect(consoleCapture.hasOutput('Generated repository classes: repositories.ts')).toBe(true)
    })
  })

  describe('Generated TypeScript types', () => {
    it('should generate correct TypeScript interfaces', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true
      })

      const typesContent = await fs.readFile(path.join('generated', 'database.d.ts'), 'utf8')

      expect(typesContent).toContain('Auto-generated by NOORMME CLI')
      expect(typesContent).toContain('interface UsersTable')
      expect(typesContent).toContain('interface PostsTable')
      expect(typesContent).toContain('interface Database')
      expect(typesContent).toContain('users: UsersTable')
      expect(typesContent).toContain('posts: PostsTable')
    })

    it('should generate correct column types', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true
      })

      const typesContent = await fs.readFile(path.join('generated', 'database.d.ts'), 'utf8')

      // Check UsersTable interface
      expect(typesContent).toContain('id: number')
      expect(typesContent).toContain('name: string')
      expect(typesContent).toContain('email: string')
      expect(typesContent).toContain('status?: string') // Optional due to default value
      expect(typesContent).toContain('created_at: Date')

      // Check PostsTable interface
      expect(typesContent).toContain('title: string')
      expect(typesContent).toContain('content?: string') // Nullable
      expect(typesContent).toContain('user_id: number')
    })

    it('should generate insert and update types', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true
      })

      const typesContent = await fs.readFile(path.join('generated', 'database.d.ts'), 'utf8')

      expect(typesContent).toContain('interface UsersInsert')
      expect(typesContent).toContain('interface UsersUpdate')
      expect(typesContent).toContain('interface PostsInsert')
      expect(typesContent).toContain('interface PostsUpdate')
    })

    it('should generate repository types', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true
      })

      const typesContent = await fs.readFile(path.join('generated', 'database.d.ts'), 'utf8')

      expect(typesContent).toContain('interface UsersRepository')
      expect(typesContent).toContain('interface PostsRepository')
      expect(typesContent).toContain('findById(id: number): Promise<UsersTable | null>')
      expect(typesContent).toContain('findAll(): Promise<UsersTable[]>')
      expect(typesContent).toContain('create(data: UsersInsert): Promise<UsersTable>')
      expect(typesContent).toContain('update(entity: UsersUpdate): Promise<UsersTable>')
      expect(typesContent).toContain('delete(id: number): Promise<boolean>')
    })

    it('should generate dynamic finders', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true
      })

      const typesContent = await fs.readFile(path.join('generated', 'database.d.ts'), 'utf8')

      expect(typesContent).toContain('findByName(value: string): Promise<UsersTable | null>')
      expect(typesContent).toContain('findByEmail(value: string): Promise<UsersTable | null>')
      expect(typesContent).toContain('findManyByName(value: string): Promise<UsersTable[]>')
      expect(typesContent).toContain('findManyByEmail(value: string): Promise<UsersTable[]>')
    })
  })

  describe('Generated repository classes', () => {
    it('should generate repository classes with correct structure', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        reposOnly: true
      })

      const reposContent = await fs.readFile(path.join('generated', 'repositories.ts'), 'utf8')

      expect(reposContent).toContain('import { NOORMME } from \'noormme\'')
      expect(reposContent).toContain('class UsersRepository')
      expect(reposContent).toContain('class PostsRepository')
      expect(reposContent).toContain('class RepositoryFactory')
    })

    it('should generate repository methods', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        reposOnly: true
      })

      const reposContent = await fs.readFile(path.join('generated', 'repositories.ts'), 'utf8')

      expect(reposContent).toContain('async findById(id: number): Promise<UsersTable | null>')
      expect(reposContent).toContain('async findAll(): Promise<UsersTable[]>')
      expect(reposContent).toContain('async create(data: UsersInsert): Promise<UsersTable>')
      expect(reposContent).toContain('async update(id: number, data: UsersUpdate): Promise<UsersTable>')
      expect(reposContent).toContain('async delete(id: number): Promise<boolean>')
      expect(reposContent).toContain('async count(): Promise<number>')
      expect(reposContent).toContain('async exists(id: number): Promise<boolean>')
    })

    it('should generate dynamic finder methods', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        reposOnly: true
      })

      const reposContent = await fs.readFile(path.join('generated', 'repositories.ts'), 'utf8')

      expect(reposContent).toContain('async findByName(value: string): Promise<UsersTable | null>')
      expect(reposContent).toContain('async findManyByName(value: string): Promise<UsersTable[]>')
    })

    it('should generate repository factory', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        reposOnly: true
      })

      const reposContent = await fs.readFile(path.join('generated', 'repositories.ts'), 'utf8')

      expect(reposContent).toContain('get users(): UsersRepository')
      expect(reposContent).toContain('get posts(): PostsRepository')
      expect(reposContent).toContain('createRepositoryFactory')
    })
  })

  describe('Generated automation config', () => {
    it('should generate automation configuration', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const configContent = await fs.readFile(path.join('generated', 'automation.config.ts'), 'utf8')

      expect(configContent).toContain('NOORMME Automation Configuration')
      expect(configContent).toContain('export const automationConfig')
      expect(configContent).toContain('dialect: \'sqlite\'')
      expect(configContent).toContain('enableAutoOptimization: true')
      expect(configContent).toContain('enableQueryOptimization: true')
      expect(configContent).toContain('enableCaching: true')
      expect(configContent).toContain('enableBatchOperations: true')
    })

    it('should generate SQLite-specific optimizations', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const configContent = await fs.readFile(path.join('generated', 'automation.config.ts'), 'utf8')

      expect(configContent).toContain('enableWALMode: true')
      expect(configContent).toContain('enableForeignKeys: true')
      expect(configContent).toContain('cacheSize: -64000')
      expect(configContent).toContain('synchronous: \'NORMAL\'')
      expect(configContent).toContain('tempStore: \'MEMORY\'')
      expect(configContent).toContain('autoVacuumMode: \'INCREMENTAL\'')
    })

    it('should generate table-specific settings', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const configContent = await fs.readFile(path.join('generated', 'automation.config.ts'), 'utf8')

      expect(configContent).toContain('tableAutomationSettings')
      expect(configContent).toContain('users: {')
      expect(configContent).toContain('posts: {')
      expect(configContent).toContain('enableAutoIndexing: true')
      expect(configContent).toContain('enablePerformanceMonitoring: true')
    })
  })

  describe('Generated usage examples', () => {
    it('should generate comprehensive usage examples', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const examplesContent = await fs.readFile(path.join('generated', 'usage-examples.ts'), 'utf8')

      expect(examplesContent).toContain('NOORMME Usage Examples')
      expect(examplesContent).toContain('import { NOORMME } from \'noormme\'')
      expect(examplesContent).toContain('import { createRepositoryFactory }')
      expect(examplesContent).toContain('import { automationConfig }')
    })

    it('should include basic CRUD examples', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const examplesContent = await fs.readFile(path.join('generated', 'usage-examples.ts'), 'utf8')

      expect(examplesContent).toContain('basicCrudExample')
      expect(examplesContent).toContain('const usersRepo = repositories.users')
      expect(examplesContent).toContain('await usersRepo.create')
      expect(examplesContent).toContain('await usersRepo.findById')
      expect(examplesContent).toContain('await usersRepo.update')
      expect(examplesContent).toContain('await usersRepo.delete')
    })

    it('should include dynamic finder examples', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const examplesContent = await fs.readFile(path.join('generated', 'usage-examples.ts'), 'utf8')

      expect(examplesContent).toContain('dynamicFinderExample')
      expect(examplesContent).toContain('findByName')
      expect(examplesContent).toContain('findManyByName')
    })

    it('should include performance monitoring examples', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const examplesContent = await fs.readFile(path.join('generated', 'usage-examples.ts'), 'utf8')

      expect(examplesContent).toContain('performanceExample')
      expect(examplesContent).toContain('getPerformanceMetrics')
      expect(examplesContent).toContain('getOptimizationRecommendations')
    })

    it('should include migration examples', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated'
      })

      const examplesContent = await fs.readFile(path.join('generated', 'usage-examples.ts'), 'utf8')

      expect(examplesContent).toContain('migrationExample')
      expect(examplesContent).toContain('getMigrationManager')
      expect(examplesContent).toContain('generateMigration')
      expect(examplesContent).toContain('migrateToLatest')
    })
  })

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      const mockNOORMME = jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockRejectedValue(new Error('Database connection failed')) as jest.MockedFunction<() => Promise<void>>,
        close: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<void>>
      }))

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: mockNOORMME
      }))

      await expect(generate({
        database: testContext.databasePath,
        output: 'generated'
      })).rejects.toThrow('Database connection failed')

      expect(consoleCapture.hasOutput('Code generation failed')).toBe(true)
    })

    it('should handle file system errors', async () => {
      // Mock fs.writeFile to throw error
      const originalWriteFile = fs.writeFile
      jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Permission denied'))

      await expect(generate({
        database: testContext.databasePath,
        output: 'generated'
      })).rejects.toThrow('Permission denied')

      // Restore original function
      fs.writeFile = originalWriteFile
    })

    it('should handle schema info errors', async () => {
      const mockNOORMME = jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<void>>,
        close: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<void>>,
        getSchemaInfo: jest.fn().mockRejectedValue(new Error('Schema discovery failed')) as jest.MockedFunction<() => Promise<any>>
      }))

      jest.doMock('../../../src/noormme.js', () => ({
        NOORMME: mockNOORMME
      }))

      await expect(generate({
        database: testContext.databasePath,
        output: 'generated'
      })).rejects.toThrow('Schema discovery failed')
    })
  })

  describe('Output directory handling', () => {
    it('should create output directory if it does not exist', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'new-directory'
      })

      const dirExists = await fs.access('new-directory').then(() => true).catch(() => false)
      expect(dirExists).toBe(true)

      const typesExists = await fs.access(path.join('new-directory', 'database.d.ts')).then(() => true).catch(() => false)
      expect(typesExists).toBe(true)
    })

    it('should handle nested output directories', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'nested/deep/directory'
      })

      const typesExists = await fs.access(path.join('nested', 'deep', 'directory', 'database.d.ts')).then(() => true).catch(() => false)
      expect(typesExists).toBe(true)
    })
  })

  describe('Format options', () => {
    it('should generate .ts files when format is ts', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true,
        format: 'ts'
      })

      const typesExists = await fs.access(path.join('generated', 'database.ts')).then(() => true).catch(() => false)
      expect(typesExists).toBe(true)
    })

    it('should generate .d.ts files when format is dts', async () => {
      await generate({
        database: testContext.databasePath,
        output: 'generated',
        typesOnly: true,
        format: 'dts'
      })

      const typesExists = await fs.access(path.join('generated', 'database.d.ts')).then(() => true).catch(() => false)
      expect(typesExists).toBe(true)
    })
  })

  describe('Environment variable support', () => {
    it('should use DATABASE_PATH environment variable when database option is not provided', async () => {
      const originalEnv = process.env.DATABASE_PATH
      process.env.DATABASE_PATH = testContext.databasePath

      await generate({
        output: 'generated'
      })

      expect(consoleCapture.hasOutput('Discovered 2 tables')).toBe(true)

      // Restore original environment
      if (originalEnv) {
        process.env.DATABASE_PATH = originalEnv
      } else {
        delete process.env.DATABASE_PATH
      }
    })
  })
})
