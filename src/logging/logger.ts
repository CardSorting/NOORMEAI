import { LoggingConfig } from '../types'
import * as fs from 'node:fs'
import * as path from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface QueryLog {
  sql: string
  parameters: any[]
  duration: number
  timestamp: number
}

/**
 * Logger for NOORMME
 */
export class Logger {
  private queryLogs: QueryLog[] = []
  private queryCount = 0
  private totalQueryTime = 0
  private config: LoggingConfig
  private namespace?: string

  constructor(configOrNamespace?: LoggingConfig | string) {
    if (typeof configOrNamespace === 'string') {
      this.namespace = configOrNamespace
      this.config = { enabled: true, level: 'info' }
    } else {
      this.config = configOrNamespace || {}
    }
  }

  /**
   * Format namespace prefix
   */
  private getPrefix(level: string): string {
    const prefix = this.namespace ? `[${this.namespace}]` : ''
    return `[NOORMME ${level.toUpperCase()}]${prefix}`
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`${this.getPrefix('debug')} ${message}`, ...args)
      this.writeToFile('debug', message, ...args)
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`${this.getPrefix('info')} ${message}`, ...args)
      this.writeToFile('info', message, ...args)
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`${this.getPrefix('warn')} ${message}`, ...args)
      this.writeToFile('warn', message, ...args)
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`${this.getPrefix('error')} ${message}`, ...args)
      this.writeToFile('error', message, ...args)
    }
  }

  /**
   * Log query execution
   */
  logQuery(sql: string, parameters: any[], duration: number): void {
    const queryLog: QueryLog = {
      sql,
      parameters,
      duration,
      timestamp: Date.now(),
    }

    this.queryLogs.push(queryLog)
    this.queryCount++
    this.totalQueryTime += duration

    if (this.shouldLog('debug')) {
      this.debug(`Query executed in ${duration}ms: ${sql}`, parameters)
    }

    // Keep only last 1000 queries
    if (this.queryLogs.length > 1000) {
      this.queryLogs.shift()
    }
  }

  /**
   * Create Kysely logger
   */
  createKyselyLogger() {
    return (event: any) => {
      if (event.level === 'query') {
        this.logQuery(event.sql, event.parameters, event.duration)
      } else if (event.level === 'error') {
        this.error('Database error:', event.error)
      }
    }
  }

  /**
   * Get query count
   */
  getQueryCount(): number {
    return this.queryCount
  }

  /**
   * Get average query time
   */
  getAverageQueryTime(): number {
    return this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0
  }

  /**
   * Get query logs
   */
  getQueryLogs(): QueryLog[] {
    return [...this.queryLogs]
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold: number = 1000): QueryLog[] {
    return this.queryLogs.filter((log) => log.duration > threshold)
  }

  /**
   * Clear query logs
   */
  clearQueryLogs(): void {
    this.queryLogs = []
    this.queryCount = 0
    this.totalQueryTime = 0
  }

  /**
   * Update logging configuration
   */
  updateConfig(newConfig: LoggingConfig): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Check if should log at given level
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevel = this.config.level || 'info'
    const currentLevelIndex = levels.indexOf(currentLevel)
    const requestedLevelIndex = levels.indexOf(level)

    return requestedLevelIndex >= currentLevelIndex
  }

  /**
   * Write logs to file if configured
   */
  private writeToFile(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.config.file) return

    try {
      // Ensure directory exists
      const logDir = path.dirname(this.config.file)
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }

      const timestamp = new Date().toISOString()
      const prefix = this.getPrefix(level)
      let logMessage = `[${timestamp}] ${prefix} ${message}`

      if (args.length > 0) {
        logMessage +=
          ' ' +
          args
            .map((arg) =>
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg),
            )
            .join(' ')
      }

      logMessage += '\n'

      fs.appendFileSync(this.config.file, logMessage)
    } catch (error) {
      // Fallback to console error if file writing fails to prevent crash
      console.error('Failed to write to log file:', error)
    }
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      queryCount: this.queryCount,
      averageQueryTime: this.getAverageQueryTime(),
      totalQueryTime: this.totalQueryTime,
      slowQueries: this.getSlowQueries().length,
    }
  }

  /**
   * Export query logs to JSON
   */
  exportQueryLogs(): string {
    return JSON.stringify(this.queryLogs, null, 2)
  }

  /**
   * Import query logs from JSON
   */
  importQueryLogs(json: string): void {
    try {
      const logs = JSON.parse(json)
      this.queryLogs = logs
      this.queryCount = logs.length
      this.totalQueryTime = logs.reduce(
        (sum: number, log: QueryLog) => sum + log.duration,
        0,
      )
    } catch (error) {
      this.error('Failed to import query logs:', error)
    }
  }
}
