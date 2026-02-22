"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
/**
 * Logger for NOORMME
 */
class Logger {
    queryLogs = [];
    queryCount = 0;
    totalQueryTime = 0;
    config;
    namespace;
    constructor(configOrNamespace) {
        if (typeof configOrNamespace === 'string') {
            this.namespace = configOrNamespace;
            this.config = { enabled: true, level: 'info' };
        }
        else {
            this.config = configOrNamespace || {};
        }
    }
    /**
     * Format namespace prefix
     */
    getPrefix(level) {
        const prefix = this.namespace ? `[${this.namespace}]` : '';
        return `[NOORMME ${level.toUpperCase()}]${prefix}`;
    }
    /**
     * Log debug message
     */
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            console.debug(`${this.getPrefix('debug')} ${message}`, ...args);
            this.writeToFile('debug', message, ...args);
        }
    }
    /**
     * Log info message
     */
    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.info(`${this.getPrefix('info')} ${message}`, ...args);
            this.writeToFile('info', message, ...args);
        }
    }
    /**
     * Log warning message
     */
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(`${this.getPrefix('warn')} ${message}`, ...args);
            this.writeToFile('warn', message, ...args);
        }
    }
    /**
     * Log error message
     */
    error(message, ...args) {
        if (this.shouldLog('error')) {
            console.error(`${this.getPrefix('error')} ${message}`, ...args);
            this.writeToFile('error', message, ...args);
        }
    }
    /**
     * Log query execution
     */
    logQuery(sql, parameters, duration) {
        const queryLog = {
            sql,
            parameters,
            duration,
            timestamp: Date.now()
        };
        this.queryLogs.push(queryLog);
        this.queryCount++;
        this.totalQueryTime += duration;
        if (this.shouldLog('debug')) {
            this.debug(`Query executed in ${duration}ms: ${sql}`, parameters);
        }
        // Keep only last 1000 queries
        if (this.queryLogs.length > 1000) {
            this.queryLogs.shift();
        }
    }
    /**
     * Create Kysely logger
     */
    createKyselyLogger() {
        return (event) => {
            if (event.level === 'query') {
                this.logQuery(event.sql, event.parameters, event.duration);
            }
            else if (event.level === 'error') {
                this.error('Database error:', event.error);
            }
        };
    }
    /**
     * Get query count
     */
    getQueryCount() {
        return this.queryCount;
    }
    /**
     * Get average query time
     */
    getAverageQueryTime() {
        return this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0;
    }
    /**
     * Get query logs
     */
    getQueryLogs() {
        return [...this.queryLogs];
    }
    /**
     * Get slow queries
     */
    getSlowQueries(threshold = 1000) {
        return this.queryLogs.filter(log => log.duration > threshold);
    }
    /**
     * Clear query logs
     */
    clearQueryLogs() {
        this.queryLogs = [];
        this.queryCount = 0;
        this.totalQueryTime = 0;
    }
    /**
     * Update logging configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Check if should log at given level
     */
    shouldLog(level) {
        if (!this.config.enabled)
            return false;
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevel = this.config.level || 'info';
        const currentLevelIndex = levels.indexOf(currentLevel);
        const requestedLevelIndex = levels.indexOf(level);
        return requestedLevelIndex >= currentLevelIndex;
    }
    /**
     * Write logs to file if configured
     */
    writeToFile(level, message, ...args) {
        if (!this.config.file)
            return;
        try {
            // Ensure directory exists
            const logDir = path.dirname(this.config.file);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const timestamp = new Date().toISOString();
            const prefix = this.getPrefix(level);
            let logMessage = `[${timestamp}] ${prefix} ${message}`;
            if (args.length > 0) {
                logMessage += ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            }
            logMessage += '\n';
            fs.appendFileSync(this.config.file, logMessage);
        }
        catch (error) {
            // Fallback to console error if file writing fails to prevent crash
            console.error('Failed to write to log file:', error);
        }
    }
    /**
     * Format log message
     */
    formatMessage(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            queryCount: this.queryCount,
            averageQueryTime: this.getAverageQueryTime(),
            totalQueryTime: this.totalQueryTime,
            slowQueries: this.getSlowQueries().length
        };
    }
    /**
     * Export query logs to JSON
     */
    exportQueryLogs() {
        return JSON.stringify(this.queryLogs, null, 2);
    }
    /**
     * Import query logs from JSON
     */
    importQueryLogs(json) {
        try {
            const logs = JSON.parse(json);
            this.queryLogs = logs;
            this.queryCount = logs.length;
            this.totalQueryTime = logs.reduce((sum, log) => sum + log.duration, 0);
        }
        catch (error) {
            this.error('Failed to import query logs:', error);
        }
    }
}
exports.Logger = Logger;
