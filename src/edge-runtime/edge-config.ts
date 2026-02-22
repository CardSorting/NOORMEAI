import { NOORMConfig } from '../types'
import type { NOORMME } from '../noormme'

/**
 * Edge Runtime compatible configuration for NOORMME
 *
 * Edge Runtime has specific limitations:
 * - No file system access (use in-memory database)
 * - No WAL mode support
 * - Limited memory and CPU resources
 * - No persistent storage
 * - Minimal logging capabilities
 */
export function getEdgeRuntimeConfig(): NOORMConfig {
  return {
    dialect: 'sqlite',
    connection: {
      database: ':memory:',
    },
    optimization: {
      enableWALMode: false, // WAL mode not supported in Edge Runtime
      enableForeignKeys: true,
      cacheSize: -2000, // 2MB cache (smaller for Edge Runtime)
      synchronous: 'NORMAL',
      tempStore: 'MEMORY', // Use memory for temporary storage
    },
    logging: {
      level: 'error', // Minimal logging for performance
      enabled: false, // Disable logging in Edge Runtime
    },
  }
}

/**
 * Check if current environment is Edge Runtime
 */
export function isEdgeRuntime(): boolean {
  return (
    (typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis) ||
    (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge')
  )
}

/**
 * Get appropriate configuration based on runtime environment
 */
export function getRuntimeConfig(): NOORMConfig {
  if (isEdgeRuntime()) {
    return getEdgeRuntimeConfig()
  }

  // Default configuration for Node.js runtime
  return {
    dialect: 'sqlite',
    connection: {
      database: process.env.DATABASE_URL || './app.db',
    },
    optimization: {
      enableWALMode: true,
      enableForeignKeys: true,
      cacheSize: -64000, // 64MB cache
      synchronous: 'NORMAL',
      tempStore: 'DEFAULT',
    },
    logging: {
      level: process.env.NODE_ENV === 'development' ? 'info' : 'error',
      enabled: true,
    },
  }
}

/**
 * Edge Runtime compatible database operations
 */
export class EdgeRuntimeDB {
  private static instance: NOORMME | null = null
  private config: NOORMConfig

  constructor(config?: NOORMConfig) {
    this.config = config || getEdgeRuntimeConfig()
  }

  /**
   * Create or return cached database instance optimized for Edge Runtime
   */
  async getInstance() {
    if (EdgeRuntimeDB.instance) {
      return EdgeRuntimeDB.instance
    }

    const { NOORMME } = await import('../noormme')
    const db = new NOORMME(this.config)
    await db.initialize()
    EdgeRuntimeDB.instance = db
    return db
  }

  /**
   * Execute a simple query in Edge Runtime
   */
  async executeQuery(query: string, params?: any[]) {
    const db = await this.getInstance()
    return await db.execute(query, params)
  }

  /**
   * Perform a read operation in Edge Runtime
   */
  async read(table: string, conditions: Record<string, any> = {}) {
    const db = await this.getInstance()
    const repo = db.getRepository(table)
    return await repo.findAll()
  }

  /**
   * Perform a write operation in Edge Runtime
   */
  async write(table: string, data: Record<string, any>) {
    const db = await this.getInstance()
    const repo = db.getRepository(table)
    return await repo.create(data)
  }

  /**
   * Clear the cached instance (useful for testing or re-configuration)
   */
  static clearInstance() {
    if (EdgeRuntimeDB.instance) {
      EdgeRuntimeDB.instance.close()
      EdgeRuntimeDB.instance = null
    }
  }
}

/**
 * Edge Runtime compatible middleware
 */
export function createEdgeMiddleware() {
  return {
    /**
     * Handle database operations in Edge Runtime
     */
    async handleRequest(request: Request) {
      const edgeDB = new EdgeRuntimeDB()

      try {
        const url = new URL(request.url)
        const pathname = url.pathname

        if (pathname.startsWith('/api/')) {
          return await this.handleAPIRequest(request, edgeDB)
        }

        return new Response('Not found', { status: 404 })
      } catch (error) {
        console.error('Edge Runtime error:', error)
        return new Response('Internal Server Error', { status: 500 })
      }
    },

    /**
     * Handle API requests in Edge Runtime
     */
    async handleAPIRequest(request: Request, edgeDB: EdgeRuntimeDB) {
      const url = new URL(request.url)
      const method = request.method
      const pathname = url.pathname

      // Simple routing for Edge Runtime
      if (pathname === '/api/health') {
        return new Response(
          JSON.stringify({
            status: 'healthy',
            runtime: 'edge',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (pathname === '/api/users' && method === 'GET') {
        const users = await edgeDB.read('users')
        return new Response(JSON.stringify(users), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (pathname === '/api/users' && method === 'POST') {
        const data = await request.json()
        const user = await edgeDB.write('users', data)
        return new Response(JSON.stringify(user), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response('Not found', { status: 404 })
    },
  }
}

/**
 * Edge Runtime compatible error handler
 */
export function createEdgeErrorHandler() {
  return {
    /**
     * Handle errors in Edge Runtime
     */
    handleError(error: Error, context?: string) {
      // Log error (minimal logging in Edge Runtime)
      console.error(
        `Edge Runtime Error${context ? ` in ${context}` : ''}:`,
        error.message,
      )

      // Return appropriate response
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message:
            process.env.NODE_ENV === 'development'
              ? error.message
              : 'Something went wrong',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    },
  }
}

/**
 * Edge Runtime performance monitoring
 */
export class EdgeRuntimeMonitor {
  private metrics: Map<string, number> = new Map()

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number) {
    this.metrics.set(name, value)
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return Object.fromEntries(this.metrics)
  }

  /**
   * Monitor a function execution
   */
  async monitor<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()

    try {
      const result = await fn()
      const duration = performance.now() - start
      this.recordMetric(`${name}_duration`, duration)
      this.recordMetric(`${name}_success`, 1)
      return result
    } catch (error) {
      const duration = performance.now() - start
      this.recordMetric(`${name}_duration`, duration)
      this.recordMetric(`${name}_error`, 1)
      throw error
    }
  }

  /**
   * Get performance report
   */
  getReport() {
    const metrics = this.getMetrics()
    const totalOperations = Object.keys(metrics).length

    return {
      totalOperations,
      metrics,
      timestamp: new Date().toISOString(),
      runtime: 'edge',
    }
  }
}

/**
 * Edge Runtime utilities
 */
export const EdgeRuntimeUtils = {
  /**
   * Check if running in Edge Runtime
   */
  isEdgeRuntime,

  /**
   * Get Edge Runtime configuration
   */
  getConfig: getEdgeRuntimeConfig,

  /**
   * Create Edge Runtime database instance
   */
  createDB: () => new EdgeRuntimeDB(),

  /**
   * Create Edge Runtime middleware
   */
  createMiddleware: createEdgeMiddleware,

  /**
   * Create Edge Runtime error handler
   */
  createErrorHandler: createEdgeErrorHandler,

  /**
   * Create Edge Runtime monitor
   */
  createMonitor: () => new EdgeRuntimeMonitor(),
}
