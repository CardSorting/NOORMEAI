import { expect } from 'chai'
import { NOORMME } from '../../../src/noormme'
import { NOORMConfig } from '../../../src/types'
import { unlink } from 'fs/promises'
import { join } from 'path'

interface BenchmarkResult {
  operation: string
  iterations: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  throughput: number // operations per second
}

interface PerformanceMetrics {
  database: string
  version: string
  timestamp: Date
  results: BenchmarkResult[]
  summary: {
    totalOperations: number
    totalTime: number
    averageThroughput: number
    slowestOperation: string
    fastestOperation: string
  }
}

export class PerformanceBenchmarkSuite {
  private results: BenchmarkResult[] = []
  private db: NOORMME | null = null
  private testDbPath: string

  constructor() {
    this.testDbPath = join(process.cwd(), `benchmark-${Date.now()}.db`)
  }

  async setup(): Promise<void> {
    const config: NOORMConfig = {
      dialect: 'sqlite',
      connection: {
        database: this.testDbPath
      },
      optimization: {
        enableWALMode: true,
        enableForeignKeys: true,
        cacheSize: -64000, // 64MB cache
        synchronous: 'NORMAL'
      },
      logging: {
        level: 'error', // Minimal logging for benchmarks
        enabled: false
      }
    }

    this.db = new NOORMME(config)
    await this.db.initialize()

    // Create test tables
    await this.createTestTables()
  }

  async cleanup(): Promise<void> {
    if (this.db) {
      await this.db.destroy()
    }

    // Clean up test database files
    try {
      await unlink(this.testDbPath)
      await unlink(`${this.testDbPath}-wal`)
      await unlink(`${this.testDbPath}-shm`)
    } catch (e) {
      // Files might not exist
    }
  }

  private async createTestTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    // Create users table
    await this.db.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create posts table
    await this.db.execute(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author_id INTEGER REFERENCES users(id),
        published BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes for performance
    await this.db.execute(`CREATE INDEX idx_users_email ON users(email)`)
    await this.db.execute(`CREATE INDEX idx_posts_author_id ON posts(author_id)`)
    await this.db.execute(`CREATE INDEX idx_posts_published ON posts(published)`)
  }

  async runBenchmarks(): Promise<PerformanceMetrics> {
    if (!this.db) throw new Error('Database not initialized')

    console.log('🚀 Starting Performance Benchmarks...')

    // Repository operations
    await this.benchmarkRepositoryCreate()
    await this.benchmarkRepositoryFind()
    await this.benchmarkRepositoryUpdate()
    await this.benchmarkRepositoryDelete()

    // Query operations
    await this.benchmarkComplexQueries()
    await this.benchmarkBatchOperations()
    await this.benchmarkConcurrentOperations()

    // Relationship operations
    await this.benchmarkRelationshipLoading()

    // Raw SQL operations
    await this.benchmarkRawSQL()

    return this.generateReport()
  }

  private async benchmarkRepositoryCreate(): Promise<void> {
    const userRepo = this.db!.getRepository('users')
    const iterations = 1000

    console.log(`📝 Benchmarking repository create operations (${iterations} iterations)...`)

    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      
      await userRepo.create({
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50)
      })
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Repository Create', iterations, times)
  }

  private async benchmarkRepositoryFind(): Promise<void> {
    const userRepo = this.db!.getRepository('users')
    const iterations = 1000

    console.log(`🔍 Benchmarking repository find operations (${iterations} iterations)...`)

    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      
      await userRepo.findAll({
        limit: 10,
        offset: i % 100
      })
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Repository Find All', iterations, times)
  }

  private async benchmarkRepositoryUpdate(): Promise<void> {
    const userRepo = this.db!.getRepository('users')
    const iterations = 500

    console.log(`✏️ Benchmarking repository update operations (${iterations} iterations)...`)

    const times: number[] = []
    
    for (let i = 1; i <= iterations; i++) {
      const start = performance.now()
      
      await userRepo.update(i, {
        age: 25 + (i % 30)
      })
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Repository Update', iterations, times)
  }

  private async benchmarkRepositoryDelete(): Promise<void> {
    const userRepo = this.db!.getRepository('users')
    const iterations = 100

    console.log(`🗑️ Benchmarking repository delete operations (${iterations} iterations)...`)

    // Create test users for deletion
    for (let i = 0; i < iterations; i++) {
      await userRepo.create({
        name: `Delete User ${i}`,
        email: `delete${i}@example.com`,
        age: 30
      })
    }

    const times: number[] = []
    
    for (let i = 1; i <= iterations; i++) {
      const start = performance.now()
      
      await userRepo.delete(i + 1000) // Offset to avoid conflicts
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Repository Delete', iterations, times)
  }

  private async benchmarkComplexQueries(): Promise<void> {
    const kysely = this.db!.getKysely()
    const iterations = 100

    console.log(`🔗 Benchmarking complex queries (${iterations} iterations)...`)

    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      
      await kysely
        .selectFrom('users')
        .leftJoin('posts', 'posts.author_id', 'users.id')
        .selectAll('users')
        .select(['posts.title as post_title', 'posts.published'])
        .where('users.age', '>', 25)
        .where('posts.published', '=', true)
        .orderBy('users.created_at', 'desc')
        .limit(20)
        .execute()
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Complex Join Query', iterations, times)
  }

  private async benchmarkBatchOperations(): Promise<void> {
    const userRepo = this.db!.getRepository('users')
    const batchSize = 100
    const iterations = 10

    console.log(`📦 Benchmarking batch operations (${iterations} batches of ${batchSize})...`)

    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      
      // Batch insert
      const batchData = Array.from({ length: batchSize }, (_, j) => ({
        name: `Batch User ${i}-${j}`,
        email: `batch${i}-${j}@example.com`,
        age: 20 + (j % 40)
      }))

      for (const data of batchData) {
        await userRepo.create(data)
      }
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Batch Insert', iterations, times)
  }

  private async benchmarkConcurrentOperations(): Promise<void> {
    const userRepo = this.db!.getRepository('users')
    const iterations = 50

    console.log(`⚡ Benchmarking concurrent operations (${iterations} concurrent)...`)

    const start = performance.now()
    
    const promises = Array.from({ length: iterations }, async (_, i) => {
      return userRepo.create({
        name: `Concurrent User ${i}`,
        email: `concurrent${i}@example.com`,
        age: 25 + (i % 35)
      })
    })

    await Promise.all(promises)
    
    const end = performance.now()
    const totalTime = end - start

    this.addResult('Concurrent Create', iterations, [totalTime])
  }

  private async benchmarkRelationshipLoading(): Promise<void> {
    const userRepo = this.db!.getRepository('users')
    const postRepo = this.db!.getRepository('posts')
    const iterations = 100

    console.log(`🔗 Benchmarking relationship loading (${iterations} iterations)...`)

    // Create test data with relationships
    const users = []
    for (let i = 0; i < 10; i++) {
      const user = await userRepo.create({
        name: `Rel User ${i}`,
        email: `rel${i}@example.com`,
        age: 30
      })
      users.push(user)

      // Create posts for each user
      for (let j = 0; j < 5; j++) {
        await postRepo.create({
          title: `Post ${i}-${j}`,
          content: `Content for post ${i}-${j}`,
          author_id: user.id,
          published: j % 2 === 0
        })
      }
    }

    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      
      // Load user with posts
      const user = users[i % users.length]
      await userRepo.findWithRelations(user.id, ['posts'])
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Relationship Loading', iterations, times)
  }

  private async benchmarkRawSQL(): Promise<void> {
    const iterations = 1000

    console.log(`⚡ Benchmarking raw SQL operations (${iterations} iterations)...`)

    const times: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      
      await this.db!.execute(`
        SELECT u.*, COUNT(p.id) as post_count
        FROM users u
        LEFT JOIN posts p ON p.author_id = u.id
        WHERE u.age > ?
        GROUP BY u.id
        ORDER BY post_count DESC
        LIMIT 10
      `, [25])
      
      const end = performance.now()
      times.push(end - start)
    }

    this.addResult('Raw SQL Query', iterations, times)
  }

  private addResult(operation: string, iterations: number, times: number[]): void {
    const totalTime = times.reduce((sum, time) => sum + time, 0)
    const averageTime = totalTime / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    const throughput = (iterations / totalTime) * 1000 // operations per second

    this.results.push({
      operation,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      throughput
    })

    console.log(`✅ ${operation}: ${averageTime.toFixed(2)}ms avg, ${throughput.toFixed(0)} ops/sec`)
  }

  private generateReport(): PerformanceMetrics {
    const totalOperations = this.results.reduce((sum, result) => sum + result.iterations, 0)
    const totalTime = this.results.reduce((sum, result) => sum + result.totalTime, 0)
    const averageThroughput = this.results.reduce((sum, result) => sum + result.throughput, 0) / this.results.length

    const slowestOperation = this.results.reduce((slowest, current) => 
      current.averageTime > slowest.averageTime ? current : slowest
    )
    const fastestOperation = this.results.reduce((fastest, current) => 
      current.averageTime < fastest.averageTime ? current : fastest
    )

    return {
      database: 'SQLite',
      version: '3.x',
      timestamp: new Date(),
      results: this.results,
      summary: {
        totalOperations,
        totalTime,
        averageThroughput,
        slowestOperation: slowestOperation.operation,
        fastestOperation: fastestOperation.operation
      }
    }
  }

  printReport(metrics: PerformanceMetrics): void {
    console.log('\n📊 Performance Benchmark Report')
    console.log('================================')
    console.log(`Database: ${metrics.database} ${metrics.version}`)
    console.log(`Timestamp: ${metrics.timestamp.toISOString()}`)
    console.log(`Total Operations: ${metrics.summary.totalOperations.toLocaleString()}`)
    console.log(`Total Time: ${metrics.summary.totalTime.toFixed(2)}ms`)
    console.log(`Average Throughput: ${metrics.summary.averageThroughput.toFixed(0)} ops/sec`)
    console.log(`Slowest Operation: ${metrics.summary.slowestOperation}`)
    console.log(`Fastest Operation: ${metrics.summary.fastestOperation}`)

    console.log('\n📈 Detailed Results:')
    console.log('Operation | Iterations | Avg Time | Min Time | Max Time | Throughput')
    console.log('----------|------------|----------|----------|----------|----------')

    for (const result of metrics.results) {
      console.log(
        `${result.operation.padEnd(9)} | ${result.iterations.toString().padStart(10)} | ` +
        `${result.averageTime.toFixed(2).padStart(8)}ms | ${result.minTime.toFixed(2).padStart(8)}ms | ` +
        `${result.maxTime.toFixed(2).padStart(8)}ms | ${result.throughput.toFixed(0).padStart(9)} ops/sec`
      )
    }
  }
}

describe('Performance Benchmarks', () => {
  let benchmarkSuite: PerformanceBenchmarkSuite

  beforeEach(async () => {
    benchmarkSuite = new PerformanceBenchmarkSuite()
    await benchmarkSuite.setup()
  })

  afterEach(async () => {
    await benchmarkSuite.cleanup()
  })

  it('should run comprehensive performance benchmarks', async () => {
    const metrics = await benchmarkSuite.runBenchmarks()
    
    // Print detailed report
    benchmarkSuite.printReport(metrics)

    // Assertions for performance expectations
    expect(metrics.results).to.have.length.greaterThan(0)
    expect(metrics.summary.totalOperations).to.be.greaterThan(0)
    expect(metrics.summary.averageThroughput).to.be.greaterThan(100) // At least 100 ops/sec

    // Repository operations should be fast
    const createResult = metrics.results.find(r => r.operation === 'Repository Create')
    if (createResult) {
      expect(createResult.averageTime).to.be.lessThan(10) // Less than 10ms average
      expect(createResult.throughput).to.be.greaterThan(100) // At least 100 ops/sec
    }

    // Concurrent operations should show good performance
    const concurrentResult = metrics.results.find(r => r.operation === 'Concurrent Create')
    if (concurrentResult) {
      expect(concurrentResult.averageTime).to.be.lessThan(100) // Less than 100ms for batch
    }

    // Complex queries should be reasonable
    const complexResult = metrics.results.find(r => r.operation === 'Complex Join Query')
    if (complexResult) {
      expect(complexResult.averageTime).to.be.lessThan(50) // Less than 50ms average
    }

    console.log('\n✅ All performance benchmarks completed successfully!')
  }).timeout(60000) // 60 second timeout for comprehensive benchmarks
})
