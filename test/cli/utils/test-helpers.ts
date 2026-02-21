import { jest } from '@jest/globals'
import { promises as fs } from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface TestContext {
  tempDir: string
  databasePath: string
  originalCwd: string
}

/**
 * Create a temporary test environment
 */
export async function createTestContext(): Promise<TestContext> {
  const tempDir = path.join(__dirname, '..', 'temp', `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const databasePath = path.join(tempDir, 'test.sqlite')
  const originalCwd = process.cwd()

  // Create temp directory
  await fs.mkdir(tempDir, { recursive: true })
  
  // Change to temp directory
  process.chdir(tempDir)

  return { tempDir, databasePath, originalCwd }
}

/**
 * Clean up test environment
 */
export async function cleanupTestContext(context: TestContext): Promise<void> {
  // Restore original working directory
  process.chdir(context.originalCwd)
  
  // Clean up temp directory
  try {
    await fs.rmdir(context.tempDir, { recursive: true })
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Mock inquirer responses
 */
export function mockInquirerResponses(responses: Record<string, any>): void {
  jest.doMock('inquirer', () => ({
    prompt: jest.fn().mockImplementation(async (questions: any[]) => {
      const answers: Record<string, any> = {}
      for (const question of questions) {
        if (responses[question.name] !== undefined) {
          answers[question.name] = responses[question.name]
        } else if (question.default !== undefined) {
          answers[question.name] = question.default
        }
      }
      return answers
    })
  }))
}

/**
 * Create a mock SQLite database file
 */
export async function createMockSQLiteDatabase(filePath: string): Promise<void> {
  // Create a simple SQLite database with test tables
  const sql = `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_status ON users(status);
    CREATE INDEX idx_posts_user_id ON posts(user_id);
    CREATE INDEX idx_posts_status ON posts(status);

    INSERT INTO users (name, email) VALUES ('Test User', 'test@example.com');
    INSERT INTO posts (title, user_id) VALUES ('Test Post', 1);
  `

  // For testing purposes, we'll create an empty file
  // In real tests, you might want to use a proper SQLite library
  await fs.writeFile(filePath, '')
}

/**
 * Mock console output capture
 */
export class ConsoleCapture {
  private logs: string[] = []
  private errors: string[] = []
  private warns: string[] = []
  private infos: string[] = []

  constructor() {
    this.logs = []
    this.errors = []
    this.warns = []
    this.infos = []
  }

  start(): void {
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      this.logs.push(args.join(' '))
    })
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      this.errors.push(args.join(' '))
    })
    jest.spyOn(console, 'warn').mockImplementation((...args) => {
      this.warns.push(args.join(' '))
    })
    jest.spyOn(console, 'info').mockImplementation((...args) => {
      this.infos.push(args.join(' '))
    })
  }

  stop(): void {
    jest.restoreAllMocks()
  }

  getLogs(): string[] {
    return this.logs
  }

  getErrors(): string[] {
    return this.errors
  }

  getWarns(): string[] {
    return this.warns
  }

  getInfos(): string[] {
    return this.infos
  }

  getAllOutput(): string[] {
    return [...this.logs, ...this.errors, ...this.warns, ...this.infos]
  }

  hasOutput(pattern: string | RegExp): boolean {
    const allOutput = this.getAllOutput().join('\n')
    return pattern instanceof RegExp ? pattern.test(allOutput) : allOutput.includes(pattern)
  }
}

/**
 * Mock file system operations
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map()

  constructor() {
    this.files = new Map()
  }

  writeFile(filePath: string, content: string): void {
    this.files.set(path.resolve(filePath), content)
  }

  readFile(filePath: string): string | undefined {
    return this.files.get(path.resolve(filePath))
  }

  exists(filePath: string): boolean {
    return this.files.has(path.resolve(filePath))
  }

  mkdir(dirPath: string): void {
    // Simple directory tracking - in real implementation you'd track directory structure
    this.files.set(path.resolve(dirPath, '.dir'), '')
  }

  getAllFiles(): string[] {
    return Array.from(this.files.keys())
  }

  getAllContent(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [filePath, content] of this.files) {
      result[filePath] = content
    }
    return result
  }
}

/**
 * Run CLI command and capture output
 */
export async function runCLICommand(command: string, options: {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
} = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { cwd = process.cwd(), env = {}, timeout = 10000 } = options
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      env: { ...process.env, ...env },
      timeout
    })
    
    return { stdout, stderr, exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    }
  }
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
  
  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Create mock NOORMME instance with specific behavior
 */
export function createMockNOORMMEWithBehavior(behavior: Partial<{
  initialize: jest.MockedFunction<() => Promise<void>>
  close: jest.MockedFunction<() => Promise<void>>
  getSchemaInfo: jest.MockedFunction<() => Promise<any>>
  getSQLiteOptimizations: jest.MockedFunction<() => Promise<any>>
  getSQLiteIndexRecommendations: jest.MockedFunction<() => Promise<any>>
  getSQLitePerformanceMetrics: jest.MockedFunction<() => Promise<any>>
  applySQLiteOptimizations: jest.MockedFunction<() => Promise<any>>
  applySQLiteIndexRecommendations: jest.MockedFunction<() => Promise<any>>
  runSQLiteAnalyze: jest.MockedFunction<() => Promise<void>>
  enableSQLiteWALMode: jest.MockedFunction<() => Promise<void>>
  getQueryAnalyzer: jest.MockedFunction<() => any>
  getSlowQueries: jest.MockedFunction<() => Promise<any[]>>
  getKysely: jest.MockedFunction<() => any>
  getRepository: jest.MockedFunction<(tableName: string) => any>
  getMigrationManager: jest.MockedFunction<() => any>
  startSchemaWatcher: jest.MockedFunction<(config: any) => Promise<void>>
}> = {}) {
  const defaultBehavior = {
    initialize: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<void>>,
    close: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<void>>,
    getSchemaInfo: jest.fn().mockResolvedValue(global.createMockSchemaInfo()) as jest.MockedFunction<() => Promise<any>>,
    getSQLiteOptimizations: jest.fn().mockResolvedValue({
      appliedOptimizations: ['Enabled WAL mode'],
      warnings: []
    }) as jest.MockedFunction<() => Promise<any>>,
    getSQLiteIndexRecommendations: jest.fn().mockResolvedValue({
      recommendations: []
    }) as jest.MockedFunction<() => Promise<any>>,
    getSQLitePerformanceMetrics: jest.fn().mockResolvedValue({
      cacheHitRate: 0.8,
      averageQueryTime: 50
    }) as jest.MockedFunction<() => Promise<any>>,
    applySQLiteOptimizations: jest.fn().mockResolvedValue({
      appliedOptimizations: ['Enabled WAL mode'],
      warnings: []
    }) as jest.MockedFunction<() => Promise<any>>,
    applySQLiteIndexRecommendations: jest.fn().mockResolvedValue([]) as jest.MockedFunction<() => Promise<any>>,
    runSQLiteAnalyze: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<void>>,
    enableSQLiteWALMode: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<void>>,
    getQueryAnalyzer: jest.fn().mockReturnValue({
      getQueryPatterns: jest.fn().mockReturnValue({
        totalQueries: 100,
        frequentQueries: [],
        slowQueries: [],
        nPlusOneQueries: []
      })
    }) as jest.MockedFunction<() => any>,
    getSlowQueries: jest.fn().mockResolvedValue([]) as jest.MockedFunction<() => Promise<any[]>>,
    getKysely: jest.fn().mockReturnValue({}) as jest.MockedFunction<() => any>,
    getRepository: jest.fn().mockReturnValue({}) as jest.MockedFunction<(tableName: string) => any>,
    getMigrationManager: jest.fn().mockReturnValue({
      getMigrationStatus: jest.fn().mockResolvedValue({
        currentVersion: null,
        appliedMigrations: [],
        pendingMigrations: [],
        availableMigrations: []
      })
    }) as jest.MockedFunction<() => any>,
    startSchemaWatcher: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<(config: any) => Promise<void>>
  }

  return { ...defaultBehavior, ...behavior }
}
