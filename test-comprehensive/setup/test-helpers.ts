/**
 * Common test helpers for NOORM comprehensive testing
 */

import { NOORMME } from '../../src/noormme.js'
import { TestDatabase, createTestDatabase, setupTestDatabase, cleanupTestDatabase } from './test-database.js'
import { getTestConfig, testTimeouts } from './test-config.js'

/**
 * Test helper class for common testing operations
 */
export class TestHelper {
  public testDatabases: Map<string, TestDatabase> = new Map()
  
  /**
   * Create and setup a test database
   */
  async createTestDatabase(dialect: 'sqlite'): Promise<TestDatabase> {
    // Clean up existing database if it exists
    const existing = this.testDatabases.get(dialect)
    if (existing) {
      await cleanupTestDatabase(existing)
    }
    
    const testDb = await createTestDatabase(dialect)
    await setupTestDatabase(testDb)
    this.testDatabases.set(dialect, testDb)
    return testDb
  }
  
  /**
   * Get an existing test database
   */
  getTestDatabase(dialect: 'sqlite'): TestDatabase | undefined {
    return this.testDatabases.get(dialect)
  }
  
  /**
   * Clean up all test databases
   */
  async cleanup(): Promise<void> {
    for (const [dialect, testDb] of this.testDatabases) {
      try {
        await cleanupTestDatabase(testDb)
      } catch (error) {
        console.warn(`Error cleaning up ${dialect} database:`, error)
      }
    }
    this.testDatabases.clear()
  }
}

/**
 * Global test helper instance
 */
export const testHelper = new TestHelper()

/**
 * Test wrapper that automatically handles database setup and cleanup
 */
export function withTestDatabase<T>(
  dialect: 'sqlite',
  testFn: (testDb: TestDatabase) => Promise<T>
): () => Promise<T> {
  return async () => {
    const testDb = await testHelper.createTestDatabase(dialect)
    try {
      // Ensure database is initialized
      await ensureInitialized(testDb.db)
      return await testFn(testDb)
    } finally {
      await cleanupTestDatabase(testDb)
      testHelper.testDatabases.delete(dialect)
    }
  }
}

/**
 * Test wrapper for multiple databases
 */
export function withMultipleDatabases<T>(
  dialects: Array<'sqlite'>,
  testFn: (testDatabases: Map<string, TestDatabase>) => Promise<T>
): () => Promise<T> {
  return async () => {
    const testDatabases = new Map<string, TestDatabase>()
    
    try {
      // Create all test databases
      for (const dialect of dialects) {
        const testDb = await testHelper.createTestDatabase(dialect)
        testDatabases.set(dialect, testDb)
      }
      
      // Ensure all databases are initialized
      for (const testDb of testDatabases.values()) {
        await ensureInitialized(testDb.db)
      }
      
      return await testFn(testDatabases)
    } finally {
      // Clean up all databases
      for (const [dialect, testDb] of testDatabases) {
        await cleanupTestDatabase(testDb)
        testHelper.testDatabases.delete(dialect)
      }
    }
  }
}

/**
 * Performance measurement helper
 */
export class PerformanceHelper {
  private measurements: Map<string, number[]> = new Map()
  
  /**
   * Measure execution time of a function
   */
  async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start
    
    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)
    
    return result
  }
  
  /**
   * Get performance statistics
   */
  getStats(name: string): {
    count: number
    total: number
    average: number
    min: number
    max: number
    median: number
  } | null {
    const measurements = this.measurements.get(name)
    if (!measurements || measurements.length === 0) {
      return null
    }
    
    const sorted = [...measurements].sort((a, b) => a - b)
    const total = measurements.reduce((sum, val) => sum + val, 0)
    const average = total / measurements.length
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const median = sorted[Math.floor(sorted.length / 2)]
    
    return {
      count: measurements.length,
      total,
      average,
      min,
      max,
      median
    }
  }
  
  /**
   * Get all performance statistics
   */
  getAllStats(): Record<string, ReturnType<PerformanceHelper['getStats']>> {
    const stats: Record<string, ReturnType<PerformanceHelper['getStats']>> = {}
    for (const name of this.measurements.keys()) {
      stats[name] = this.getStats(name)
    }
    return stats
  }
  
  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear()
  }
}

/**
 * Global performance helper instance
 */
export const performanceHelper = new PerformanceHelper()

/**
 * Memory usage helper
 */
export class MemoryHelper {
  /**
   * Get current memory usage
   */
  getMemoryUsage(): {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  } {
    const usage = process.memoryUsage()
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    }
  }
  
  /**
   * Measure memory usage of a function
   */
  async measureMemory<T>(fn: () => Promise<T>): Promise<{
    result: T
    before: ReturnType<MemoryHelper['getMemoryUsage']>
    after: ReturnType<MemoryHelper['getMemoryUsage']>
    delta: ReturnType<MemoryHelper['getMemoryUsage']>
  }> {
    const before = this.getMemoryUsage()
    const result = await fn()
    const after = this.getMemoryUsage()
    
    const delta = {
      rss: after.rss - before.rss,
      heapTotal: after.heapTotal - before.heapTotal,
      heapUsed: after.heapUsed - before.heapUsed,
      external: after.external - before.external
    }
    
    return { result, before, after, delta }
  }
}

/**
 * Global memory helper instance
 */
export const memoryHelper = new MemoryHelper()

/**
 * Helper to ensure database is initialized without redundant calls
 */
export async function ensureInitialized(db: any): Promise<void> {
  if (!db.isInitialized()) {
    await db.initialize()
  }
}

/**
 * Assertion helpers
 */
export const assertions = {
  /**
   * Assert that a value is within a performance threshold
   */
  assertPerformance(actual: number, expected: number, threshold: number = 0.1): void {
    const difference = Math.abs(actual - expected) / expected
    if (difference > threshold) {
      throw new Error(`Performance assertion failed: expected ${expected}ms, got ${actual}ms (difference: ${(difference * 100).toFixed(2)}%)`)
    }
  },
  
  /**
   * Assert that memory usage is within limits
   */
  assertMemoryUsage(usage: ReturnType<MemoryHelper['getMemoryUsage']>, maxRSS: number = 100): void {
    if (usage.rss > maxRSS) {
      throw new Error(`Memory usage assertion failed: RSS ${usage.rss}MB exceeds limit ${maxRSS}MB`)
    }
  },
  
  /**
   * Assert that a function completes within a timeout
   */
  async assertTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Function timed out after ${timeout}ms`)), timeout)
      )
    ])
  },
  
  /**
   * Assert that a function throws an error
   */
  async assertThrows<T>(fn: () => Promise<T>, expectedError?: string | RegExp): Promise<Error> {
    try {
      await fn()
      throw new Error('Expected function to throw an error')
    } catch (error) {
      if (expectedError) {
        const message = error instanceof Error ? error.message : String(error)
        if (typeof expectedError === 'string') {
          if (!message.includes(expectedError)) {
            throw new Error(`Expected error message to contain "${expectedError}", got: ${message}`)
          }
        } else {
          if (!expectedError.test(message)) {
            throw new Error(`Expected error message to match ${expectedError}, got: ${message}`)
          }
        }
      }
      return error as Error
    }
  }
}

/**
 * Test data generation helpers
 */
export const dataHelpers = {
  /**
   * Generate random string
   */
  randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },
  
  /**
   * Generate random email
   */
  randomEmail(): string {
    return `${this.randomString(8)}@example.com`
  },
  
  /**
   * Generate random number
   */
  randomNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
  
  /**
   * Generate random date
   */
  randomDate(start: Date = new Date(2020, 0, 1), end: Date = new Date()): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
  },
  
  /**
   * Generate random boolean
   */
  randomBoolean(): boolean {
    return Math.random() > 0.5
  }
}

/**
 * Test execution helpers
 */
export const executionHelpers = {
  /**
   * Retry a function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          throw lastError
        }
        
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  },
  
  /**
   * Run a function with a timeout
   */
  async withTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ])
  },
  
  /**
   * Run multiple functions in parallel with concurrency limit
   */
  async parallel<T>(
    functions: Array<() => Promise<T>>,
    concurrency: number = 5
  ): Promise<T[]> {
    const results: T[] = []
    const executing: Promise<void>[] = []
    
    for (let i = 0; i < functions.length; i++) {
      const promise = functions[i]().then(result => {
        results[i] = result
      })
      
      executing.push(promise)
      
      if (executing.length >= concurrency) {
        await Promise.race(executing)
        executing.splice(executing.findIndex(p => p === promise), 1)
      }
    }
    
    await Promise.all(executing)
    return results
  }
}

/**
 * Test cleanup helpers
 */
export const cleanupHelpers = {
  /**
   * Clean up test files
   */
  async cleanupFiles(files: string[]): Promise<void> {
    const fs = await import('fs/promises')
    
    for (const file of files) {
      try {
        await fs.unlink(file)
      } catch (error) {
        // Ignore file not found errors
        if ((error as any).code !== 'ENOENT') {
          console.warn(`Could not delete file ${file}:`, error)
        }
      }
    }
  },
  
  /**
   * Clean up test directories
   */
  async cleanupDirectories(directories: string[]): Promise<void> {
    const fs = await import('fs/promises')
    
    for (const dir of directories) {
      try {
        await fs.rmdir(dir, { recursive: true })
      } catch (error) {
        // Ignore directory not found errors
        if ((error as any).code !== 'ENOENT') {
          console.warn(`Could not delete directory ${dir}:`, error)
        }
      }
    }
  }
}

/**
 * Test logging helpers
 */
export const loggingHelpers = {
  /**
   * Log test execution time
   */
  logExecutionTime(name: string, startTime: number): void {
    const duration = performance.now() - startTime
    console.log(`⏱️  ${name}: ${duration.toFixed(2)}ms`)
  },
  
  /**
   * Log memory usage
   */
  logMemoryUsage(context: string): void {
    const usage = memoryHelper.getMemoryUsage()
    console.log(`🧠 ${context}: RSS ${usage.rss}MB, Heap ${usage.heapUsed}MB/${usage.heapTotal}MB`)
  },
  
  /**
   * Log performance statistics
   */
  logPerformanceStats(name: string): void {
    const stats = performanceHelper.getStats(name)
    if (stats) {
      console.log(`📊 ${name}: avg ${stats.average.toFixed(2)}ms, min ${stats.min.toFixed(2)}ms, max ${stats.max.toFixed(2)}ms`)
    }
  }
}
