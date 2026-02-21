import type { Kysely } from '../kysely.js'
import { SchemaInfo, SchemaChange, TableInfo, ColumnInfo } from '../types/index.js'
import { Logger } from '../logging/logger.js'
import { SchemaDiscovery } from '../schema/schema-discovery.js'
import { createHash } from 'node:crypto'

export interface WatchOptions {
  pollInterval?: number; // in milliseconds, default 5000 (5 seconds)
  ignoreViews?: boolean;
  ignoredTables?: string[];
  enabled?: boolean;
}

/**
 * Monitors database schema changes in development mode
 */
export class SchemaWatcher {
  private isWatching = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastSchemaHash: string | null = null;
  private lastSchema: SchemaInfo | null = null;
  private callbacks: Array<(changes: SchemaChange[]) => void> = [];

  constructor(
    private db: Kysely<any>,
    private schemaDiscovery: SchemaDiscovery,
    private logger: Logger,
    private options: WatchOptions = {}
  ) {
    // Merge options, giving priority to explicitly passed values
    const defaultEnabled = process.env.NODE_ENV === 'development';
    this.options = {
      pollInterval: 5000,
      ignoreViews: true,
      ignoredTables: [],
      enabled: options.enabled !== undefined ? options.enabled : defaultEnabled,
      ...options
    };
  }

  /**
   * Start watching for schema changes
   */
  async startWatching(): Promise<void> {
    if (!this.options.enabled) {
      this.logger.debug('Schema watching disabled (not in development mode)');
      return;
    }

    if (this.isWatching) {
      this.logger.warn('Schema watcher already running');
      return;
    }

    this.logger.info('Starting schema change monitoring...');

    // Get initial schema snapshot
    try {
      const initialSchema = await this.getCurrentSchema();
      this.lastSchemaHash = this.hashSchema(initialSchema);
      this.lastSchema = initialSchema;
    } catch (error) {
      this.logger.error('Failed to get initial schema snapshot:', error);
      // Set a default hash to allow watching to continue
      this.lastSchemaHash = '0';
      this.lastSchema = null;
    }

    this.isWatching = true;
    this.intervalId = setInterval(() => {
      this.checkForChanges().catch(error => {
        this.logger.error('Error checking for schema changes:', error);
      });
    }, this.options.pollInterval);

    // Unref the interval to allow the process to exit
    if (this.intervalId && typeof this.intervalId.unref === 'function') {
      this.intervalId.unref();
    }

    this.logger.info(`Schema watcher started (polling every ${this.options.pollInterval}ms)`);
  }

  /**
   * Stop watching for schema changes
   */
  stopWatching(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isWatching = false;
    this.callbacks = []; // Clear callbacks on stop

    if (this.logger) {
      this.logger.info('Schema watcher stopped');
    }
  }

  /**
   * Register callback for schema changes
   */
  onSchemaChange(callback: (changes: SchemaChange[]) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove callback for schema changes
   */
  removeSchemaChangeCallback(callback: (changes: SchemaChange[]) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Manually trigger schema check
   */
  async checkForChanges(): Promise<SchemaChange[]> {
    try {
      const currentSchema = await this.getCurrentSchema();
      const currentHash = this.hashSchema(currentSchema);

      // Debug logging
      this.logger.debug(`Schema check - Last hash: ${this.lastSchemaHash}, Current hash: ${currentHash}, Tables: ${currentSchema.tables.length}`);

      if (this.lastSchemaHash && currentHash !== this.lastSchemaHash) {
        this.logger.info('Schema changes detected, analyzing...');

        const changes = this.detectChanges(this.lastSchema, currentSchema);

        this.lastSchemaHash = currentHash;
        this.lastSchema = currentSchema;

        if (changes.length > 0) {
          this.logger.info(`Found ${changes.length} schema changes`);
          this.notifyCallbacks(changes);
        }

        return changes;
      }

      // Update hash even if no changes detected yet (for first check after initialization)
      if (!this.lastSchemaHash) {
        this.lastSchemaHash = currentHash;
        this.lastSchema = currentSchema;
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to check for schema changes:', error);
      return [];
    }
  }

  /**
   * Get current database schema
   */
  private async getCurrentSchema(): Promise<SchemaInfo> {
    return await this.schemaDiscovery.discoverSchema();
  }

  /**
   * Create a hash of the schema for change detection
   */
  private hashSchema(schema: SchemaInfo): string {
    // Create a deterministic string representation of the schema
    const schemaString = JSON.stringify({
      tables: schema.tables
        .filter(table => !this.options.ignoredTables?.includes(table.name))
        .map(table => ({
          name: table.name,
          columns: table.columns.map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            isPrimaryKey: col.isPrimaryKey,
            defaultValue: col.defaultValue
          })),
          primaryKey: table.primaryKey,
          foreignKeys: table.foreignKeys,
          indexes: table.indexes
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),

      relationships: schema.relationships
        .sort((a, b) => `${a.fromTable}.${a.name}`.localeCompare(`${b.fromTable}.${b.name}`))
    });

    return createHash('sha256').update(schemaString).digest('hex');
  }

  /**
   * Detect specific changes between schemas
   */
  private detectChanges(oldSchema: SchemaInfo | null, newSchema: SchemaInfo): SchemaChange[] {
    const changes: SchemaChange[] = [];

    if (!oldSchema) {
      // If no old schema, everything is new (but effectively just "tables added")
      // However, usually this happens on first run where we don't return changes.
      // If we are here, it means we lost state or something weird.
      // Let's just treat all tables as added.
      for (const table of newSchema.tables) {
        changes.push({
          type: 'table_added',
          table: table.name,
          details: { columns: table.columns.length }
        });
      }
      return changes;
    }

    const oldTablesMap = new Map(oldSchema.tables.map(t => [t.name, t]));
    const newTablesMap = new Map(newSchema.tables.map(t => [t.name, t]));

    // Check for added tables
    for (const table of newSchema.tables) {
      if (!oldTablesMap.has(table.name)) {
        changes.push({
          type: 'table_added',
          table: table.name,
          details: { columns: table.columns.length }
        });
      }
    }

    // Check for removed tables
    for (const table of oldSchema.tables) {
      if (!newTablesMap.has(table.name)) {
        changes.push({
          type: 'table_removed',
          table: table.name
        });
      }
    }

    // Check for modified tables (column changes)
    for (const newTable of newSchema.tables) {
      const oldTable = oldTablesMap.get(newTable.name);
      if (oldTable) {
        const oldColumnsMap = new Map(oldTable.columns.map(c => [c.name, c]));
        const newColumnsMap = new Map(newTable.columns.map(c => [c.name, c]));

        // Check for added columns
        for (const column of newTable.columns) {
          if (!oldColumnsMap.has(column.name)) {
            changes.push({
              type: 'column_added',
              table: newTable.name,
              column: column.name,
              details: { type: column.type }
            });
          }
        }

        // Check for removed columns
        for (const column of oldTable.columns) {
          if (!newColumnsMap.has(column.name)) {
            changes.push({
              type: 'column_removed',
              table: newTable.name,
              column: column.name
            });
          } else {
            // Check for modified columns
            const newColumn = newColumnsMap.get(column.name)!;
            if (this.isColumnModified(column, newColumn)) {
              changes.push({
                type: 'column_modified',
                table: newTable.name,
                column: column.name,
                details: {
                  old: { type: column.type, nullable: column.nullable },
                  new: { type: newColumn.type, nullable: newColumn.nullable }
                }
              });
            }
          }
        }
      }
    }

    return changes;
  }

  private isColumnModified(oldCol: ColumnInfo, newCol: ColumnInfo): boolean {
    return oldCol.type !== newCol.type ||
      oldCol.nullable !== newCol.nullable ||
      oldCol.isPrimaryKey !== newCol.isPrimaryKey;
  }

  /**
   * Notify all registered callbacks about schema changes
   */
  private notifyCallbacks(changes: SchemaChange[]): void {
    this.callbacks.forEach(callback => {
      try {
        callback(changes);
      } catch (error) {
        this.logger.error('Error in schema change callback:', error);
      }
    });
  }

  /**
   * Get current watching status
   */
  isCurrentlyWatching(): boolean {
    return this.isWatching;
  }

  /**
   * Get watch configuration
   */
  getWatchOptions(): WatchOptions {
    return { ...this.options };
  }
}