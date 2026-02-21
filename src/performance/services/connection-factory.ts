import { NOORMME } from '../../noormme'
import { NOORMConfig } from '../../types'
import { Logger } from '../../logging/logger.js'

export interface ConnectionConfig extends NOORMConfig {
  id?: string
  maxRetries?: number
  retryDelay?: number
  validationTimeout?: number
}

export interface PooledConnection {
  id: string
  db: NOORMME
  createdAt: Date
  lastUsed: Date
  isActive: boolean
  inUse: boolean
  config: ConnectionConfig
}

export interface ConnectionValidationResult {
  isValid: boolean
  error?: string
  responseTime?: number
}

export interface ConnectionStats {
  totalCreated: number
  totalDestroyed: number
  activeConnections: number
  failedCreations: number
  averageCreationTime: number
  averageValidationTime: number
}

/**
 * Factory for creating and managing database connections
 */
export class ConnectionFactory {
  private connections = new Map<string, PooledConnection>()
  private stats: ConnectionStats
  private logger: Logger

  constructor(logger?: Logger) {
    this.logger = logger || new Logger('ConnectionFactory')
    this.stats = {
      totalCreated: 0,
      totalDestroyed: 0,
      activeConnections: 0,
      failedCreations: 0,
      averageCreationTime: 0,
      averageValidationTime: 0
    }
  }

  /**
   * Create a new database connection
   */
  async createConnection(config: ConnectionConfig): Promise<PooledConnection> {
    const startTime = performance.now()
    const id = config.id || this.generateConnectionId()
    
    try {
      this.logger.debug(`Creating connection ${id}`)
      
      const db = new NOORMME(config)
      await db.initialize()

      const connection: PooledConnection = {
        id,
        db,
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: true,
        inUse: false,
        config
      }

      this.connections.set(id, connection)
      this.updateStats('created', performance.now() - startTime)
      
      this.logger.debug(`Created connection ${id} successfully`)
      return connection
    } catch (error) {
      this.updateStats('failed', performance.now() - startTime)
      this.logger.error(`Failed to create connection ${id}:`, error)
      throw error
    }
  }

  /**
   * Validate a connection
   */
  async validateConnection(connection: PooledConnection): Promise<ConnectionValidationResult> {
    const startTime = performance.now()
    
    try {
      await connection.db.execute('SELECT 1')
      
      const responseTime = performance.now() - startTime
      this.updateStats('validated', responseTime)
      
      return {
        isValid: true,
        responseTime
      }
    } catch (error) {
      const responseTime = performance.now() - startTime
      this.updateStats('validated', responseTime)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      return {
        isValid: false,
        error: errorMessage,
        responseTime
      }
    }
  }

  /**
   * Get connection by ID
   */
  getConnection(id: string): PooledConnection | null {
    return this.connections.get(id) || null
  }

  /**
   * Get all connections
   */
  getAllConnections(): PooledConnection[] {
    return Array.from(this.connections.values())
  }

  /**
   * Get active connections
   */
  getActiveConnections(): PooledConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.isActive)
  }

  /**
   * Get idle connections
   */
  getIdleConnections(): PooledConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.isActive && !conn.inUse
    )
  }

  /**
   * Mark connection as in use
   */
  markInUse(connection: PooledConnection): void {
    connection.inUse = true
    connection.lastUsed = new Date()
  }

  /**
   * Mark connection as idle
   */
  markIdle(connection: PooledConnection): void {
    connection.inUse = false
    connection.lastUsed = new Date()
  }

  /**
   * Destroy a connection
   */
  async destroyConnection(id: string): Promise<boolean> {
    const connection = this.connections.get(id)
    if (!connection) {
      return false
    }

    try {
      await connection.db.destroy()
      connection.isActive = false
      this.connections.delete(id)
      this.updateStats('destroyed', 0)
      
      this.logger.debug(`Destroyed connection ${id}`)
      return true
    } catch (error) {
      this.logger.error(`Failed to destroy connection ${id}:`, error)
      return false
    }
  }

  /**
   * Destroy all connections
   */
  async destroyAllConnections(): Promise<void> {
    const destroyPromises = Array.from(this.connections.keys()).map(id =>
      this.destroyConnection(id)
    )

    await Promise.all(destroyPromises)
    this.logger.info('Destroyed all connections')
  }

  /**
   * Cleanup inactive connections
   */
  async cleanupInactiveConnections(maxAge: number = 300000): Promise<number> {
    const now = Date.now()
    let cleaned = 0

    for (const [id, connection] of this.connections.entries()) {
      if (!connection.inUse && 
          now - connection.lastUsed.getTime() > maxAge) {
        if (await this.destroyConnection(id)) {
          cleaned++
        }
      }
    }

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} inactive connections`)
    }

    return cleaned
  }

  /**
   * Validate all connections
   */
  async validateAllConnections(): Promise<Array<{
    id: string
    isValid: boolean
    error?: string
    responseTime?: number
  }>> {
    const validationPromises = Array.from(this.connections.values()).map(
      async (connection) => {
        const result = await this.validateConnection(connection)
        return {
          id: connection.id,
          isValid: result.isValid,
          error: result.error,
          responseTime: result.responseTime
        }
      }
    )

    return Promise.all(validationPromises)
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats }
  }

  /**
   * Get connection health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    connections: {
      total: number
      active: number
      idle: number
      inUse: number
    }
  }> {
    const connections = this.getAllConnections()
    const activeConnections = this.getActiveConnections()
    const idleConnections = this.getIdleConnections()
    const inUseConnections = connections.filter(c => c.inUse)

    const issues: string[] = []
    
    // Check for failed creations
    if (this.stats.failedCreations > 0) {
      issues.push(`${this.stats.failedCreations} connection creation failures`)
    }

    // Check for slow validation times
    if (this.stats.averageValidationTime > 1000) {
      issues.push(`Slow connection validation: ${this.stats.averageValidationTime.toFixed(2)}ms average`)
    }

    // Check for high connection count
    if (connections.length > 50) {
      issues.push(`High connection count: ${connections.length}`)
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (issues.length > 0) {
      status = issues.some(issue => issue.includes('failures')) ? 'critical' : 'warning'
    }

    return {
      status,
      issues,
      connections: {
        total: connections.length,
        active: activeConnections.length,
        idle: idleConnections.length,
        inUse: inUseConnections.length
      }
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Update statistics
   */
  private updateStats(operation: 'created' | 'destroyed' | 'failed' | 'validated', time: number): void {
    switch (operation) {
      case 'created':
        this.stats.totalCreated++
        this.stats.activeConnections++
        this.updateAverageTime('creation', time)
        break
      case 'destroyed':
        this.stats.totalDestroyed++
        this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1)
        break
      case 'failed':
        this.stats.failedCreations++
        break
      case 'validated':
        this.updateAverageTime('validation', time)
        break
    }
  }

  /**
   * Update average time for operations
   */
  private updateAverageTime(operation: 'creation' | 'validation', time: number): void {
    if (operation === 'creation') {
      const total = this.stats.totalCreated
      this.stats.averageCreationTime = 
        (this.stats.averageCreationTime * (total - 1) + time) / total
    } else if (operation === 'validation') {
      // This is a simplified approach - in practice you'd track validation count separately
      this.stats.averageValidationTime = 
        (this.stats.averageValidationTime + time) / 2
    }
  }
}

/**
 * Connection pool manager using the factory
 */
export class ConnectionPoolManager {
  private factory: ConnectionFactory
  private config: ConnectionConfig
  private poolConfig: {
    minConnections: number
    maxConnections: number
    acquireTimeout: number
    idleTimeout: number
    validationInterval: number
  }
  private waitingQueue: Array<{
    resolve: (connection: PooledConnection) => void
    reject: (error: Error) => void
    timestamp: number
  }> = []
  private validationTimer?: NodeJS.Timeout
  private isShuttingDown = false
  private logger: Logger

  constructor(
    config: ConnectionConfig,
    poolConfig: Partial<ConnectionPoolManager['poolConfig']> = {},
    logger?: Logger
  ) {
    this.config = config
    this.logger = logger || new Logger('ConnectionPoolManager')
    this.factory = new ConnectionFactory(this.logger)
    
    this.poolConfig = {
      minConnections: 2,
      maxConnections: 10,
      acquireTimeout: 30000,
      idleTimeout: 300000,
      validationInterval: 60000,
      ...poolConfig
    }

    this.startValidationTimer()
  }

  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    this.logger.info(`Initializing connection pool with ${this.poolConfig.minConnections} minimum connections`)
    
    const initPromises = Array.from({ length: this.poolConfig.minConnections }, (_, i) =>
      this.factory.createConnection({
        ...this.config,
        id: `pool_conn_${i}`
      })
    )

    try {
      await Promise.all(initPromises)
      this.logger.info(`Connection pool initialized with ${this.factory.getAllConnections().length} connections`)
    } catch (error) {
      this.logger.error('Failed to initialize connection pool:', error)
      throw error
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquire(): Promise<PooledConnection> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down')
    }

    const startTime = performance.now()

    try {
      // Try to get an idle connection
      const idleConnection = this.getIdleConnection()
      if (idleConnection) {
        this.factory.markInUse(idleConnection)
        this.logger.debug(`Acquired connection ${idleConnection.id} from pool`)
        return idleConnection
      }

      // Try to create a new connection if under max limit
      const currentConnections = this.factory.getAllConnections()
      if (currentConnections.length < this.poolConfig.maxConnections) {
        const newConnection = await this.factory.createConnection({
          ...this.config,
          id: `pool_conn_${Date.now()}`
        })
        this.factory.markInUse(newConnection)
        this.logger.debug(`Created and acquired new connection ${newConnection.id}`)
        return newConnection
      }

      // Wait for a connection to become available
      return this.waitForConnection(startTime)
    } catch (error) {
      this.logger.error('Failed to acquire connection:', error)
      throw error
    }
  }

  /**
   * Release a connection back to the pool
   */
  async release(connection: PooledConnection): Promise<void> {
    try {
      // Validate connection before returning to pool
      const validation = await this.factory.validateConnection(connection)
      if (!validation.isValid) {
        this.logger.warn(`Connection ${connection.id} failed validation, removing from pool`)
        await this.factory.destroyConnection(connection.id)
        return
      }

      this.factory.markIdle(connection)
      this.processWaitingQueue()
      
      this.logger.debug(`Released connection ${connection.id} back to pool`)
    } catch (error) {
      this.logger.error(`Failed to release connection ${connection.id}:`, error)
    }
  }

  /**
   * Execute a function with a pooled connection
   */
  async withConnection<T>(fn: (db: NOORMME) => Promise<T>): Promise<T> {
    const connection = await this.acquire()
    
    try {
      return await fn(connection.db)
    } finally {
      await this.release(connection)
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const factoryStats = this.factory.getStats()
    const connections = this.factory.getAllConnections()
    
    return {
      ...factoryStats,
      poolSize: connections.length,
      idleConnections: this.factory.getIdleConnections().length,
      inUseConnections: connections.filter(c => c.inUse).length,
      waitingQueue: this.waitingQueue.length
    }
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down connection pool...')
    this.isShuttingDown = true

    // Stop validation timer
    if (this.validationTimer) {
      clearInterval(this.validationTimer)
    }

    // Reject all waiting requests
    this.waitingQueue.forEach(({ reject }) => {
      reject(new Error('Connection pool is shutting down'))
    })
    this.waitingQueue = []

    // Destroy all connections
    await this.factory.destroyAllConnections()
    this.logger.info('Connection pool shutdown complete')
  }

  /**
   * Get idle connection from pool
   */
  private getIdleConnection(): PooledConnection | null {
    const idleConnections = this.factory.getIdleConnections()
    return idleConnections.length > 0 ? idleConnections[0] : null
  }

  /**
   * Wait for a connection to become available
   */
  private async waitForConnection(startTime: number): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.reject === reject)
        if (index !== -1) {
          this.waitingQueue.splice(index, 1)
        }
        reject(new Error(`Connection acquisition timeout after ${this.poolConfig.acquireTimeout}ms`))
      }, this.poolConfig.acquireTimeout)

      this.waitingQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout)
          resolve(connection)
        },
        reject: (error) => {
          clearTimeout(timeout)
          reject(error)
        },
        timestamp: Date.now()
      })
    })
  }

  /**
   * Process waiting queue when connections become available
   */
  private processWaitingQueue(): void {
    while (this.waitingQueue.length > 0) {
      const idleConnection = this.getIdleConnection()
      if (!idleConnection) break

      const waiter = this.waitingQueue.shift()!
      this.factory.markInUse(idleConnection)
      waiter.resolve(idleConnection)
    }
  }

  /**
   * Start validation timer
   */
  private startValidationTimer(): void {
    this.validationTimer = setInterval(async () => {
      await this.validateConnections()
      await this.cleanupIdleConnections()
    }, this.poolConfig.validationInterval)
  }

  /**
   * Validate all connections in the pool
   */
  private async validateConnections(): Promise<void> {
    const validationPromises = this.factory.getIdleConnections().map(
      async (connection) => {
        const validation = await this.factory.validateConnection(connection)
        if (!validation.isValid) {
          await this.factory.destroyConnection(connection.id)
        }
      }
    )

    await Promise.all(validationPromises)
  }

  /**
   * Cleanup idle connections that exceed the idle timeout
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now()
    const idleConnections = this.factory.getIdleConnections()
    
    const excessConnections = idleConnections.filter(conn => 
      now - conn.lastUsed.getTime() > this.poolConfig.idleTimeout
    ).slice(this.poolConfig.minConnections)

    for (const connection of excessConnections) {
      await this.factory.destroyConnection(connection.id)
    }

    if (excessConnections.length > 0) {
      this.logger.debug(`Cleaned up ${excessConnections.length} idle connections`)
    }
  }
}

/**
 * Factory function to create connection pool manager
 */
export function createConnectionPool(
  config: ConnectionConfig,
  poolConfig?: Partial<ConnectionPoolManager['poolConfig']>,
  logger?: Logger
): ConnectionPoolManager {
  return new ConnectionPoolManager(config, poolConfig, logger)
}
