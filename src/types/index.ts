/**
 * Core type definitions for NOORMME
 */

export interface NOORMConfig {
  dialect: 'sqlite' | 'postgresql' | 'mysql'
  connection: ConnectionConfig
  introspection?: IntrospectionConfig
  cache?: CacheConfig
  logging?: LoggingConfig
  performance?: PerformanceConfig
  automation?: AutomationConfig
  optimization?: OptimizationConfig
  sqlite?: SQLiteConfig
  agentic?: AgenticConfig
}

export interface AgenticConfig {
  sessionsTable?: string
  messagesTable?: string
  memoriesTable?: string
  goalsTable?: string
  reflectionsTable?: string
  knowledgeTable?: string
  actionsTable?: string
  episodesTable?: string
  resourcesTable?: string
  capabilitiesTable?: string
  policiesTable?: string
  metricsTable?: string
  personasTable?: string
  epochsTable?: string
  ritualsTable?: string
  rulesTable?: string
  telemetryEventsTable?: string
  sessionEvolutionTable?: string
  researchMetricsTable?: string
  snapshotsTable?: string
  contextWindowSize?: number
  vectorConfig?: VectorConfig
  evolution?: EmergentSkillConfig
  llm?: LLMProvider // The AI brain for synthesis and reasoning
  metadata?: {
    typesOutputPath?: string
    [key: string]: any
  }
}

export interface EmergentSkillConfig {
  verificationWindow?: number
  rollbackThresholdZ?: number
  enableHiveLink?: boolean
  mutationAggressiveness?: number
  maxSandboxSkills?: number
}

export interface AgentSnapshot {
  id: string | number
  name: string
  dna: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface VectorConfig {
  provider: 'pgvector' | 'sqlite-vss' | 'manual'
  dimensions?: number
  distanceMetric?: 'cosine' | 'euclidean' | 'inner_product'
}

export interface ConnectionConfig {
  host?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean | object
  pool?: PoolConfig
}

export interface PoolConfig {
  min?: number
  max?: number
  idleTimeoutMillis?: number
}

export interface IntrospectionConfig {
  includeViews?: boolean
  excludeTables?: string[]
  customTypeMappings?: Record<string, string>
}

export interface CacheConfig {
  ttl?: number
  maxSize?: number
  strategy?: 'lru' | 'fifo'
}

export interface LoggingConfig {
  level?: 'debug' | 'info' | 'warn' | 'error'
  enabled?: boolean
  file?: string
}

export interface PerformanceConfig {
  enableQueryOptimization?: boolean
  enableBatchLoading?: boolean
  maxBatchSize?: number
  enableCaching?: boolean
  maxCacheSize?: number
  enableBatchOperations?: boolean
  slowQueryThreshold?: number
}

export interface AutomationConfig {
  enableAutoOptimization?: boolean
  enableIndexRecommendations?: boolean
  enableQueryAnalysis?: boolean
  enableMigrationGeneration?: boolean
  enablePerformanceMonitoring?: boolean
  enableSchemaWatcher?: boolean
}

export interface OptimizationConfig {
  enableWALMode?: boolean
  enableForeignKeys?: boolean
  cacheSize?: number
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY'
  autoVacuumMode?: 'NONE' | 'FULL' | 'INCREMENTAL'
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF'
}

export interface SQLiteConfig {
  enableWALMode?: boolean
  enableForeignKeys?: boolean
  cacheSize?: number
  synchronous?: 'OFF' | 'NORMAL' | 'FULL' | 'EXTRA'
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY'
  autoVacuumMode?: 'NONE' | 'FULL' | 'INCREMENTAL'
  journalMode?: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF'
}

export interface SchemaInfo {
  tables: TableInfo[]
  relationships: RelationshipInfo[]
  views?: ViewInfo[]
}

export interface TableInfo {
  name: string
  schema?: string
  columns: ColumnInfo[]
  primaryKey?: string[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue?: unknown
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  maxLength?: number
  precision?: number
  scale?: number
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
}

export interface ForeignKeyInfo {
  name: string
  column: string
  referencedTable: string
  referencedColumn: string
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

export interface RelationshipInfo {
  name: string
  type: 'one-to-many' | 'many-to-one' | 'many-to-many'
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
  throughTable?: string
  throughFromColumn?: string
  throughToColumn?: string
}

export interface ViewInfo {
  name: string
  schema?: string
  definition: string
  columns: ColumnInfo[]
}

export interface GeneratedTypes {
  entities: EntityType[]
  interfaces: string
  types: string
}

export interface EntityType {
  name: string
  tableName: string
  interface: string
  insertType: string
  updateType: string
  selectType: string
}

export interface DjangoManager<T> {
  all(): Promise<T[]>
  get(id: string | number): Promise<T | null>
  get(filter: Partial<T>): Promise<T | null>
  filter(filter: Partial<T>): DjangoManager<T>
  exclude(filter: Partial<T>): DjangoManager<T>
  order_by(...columns: (keyof T | string)[]): DjangoManager<T>
  count(): Promise<number>
  exists(): Promise<boolean>
  first(): Promise<T | null>
  last(): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(data: Partial<T>): Promise<T[]>
  delete(): Promise<number>
  // Execution
  execute(): Promise<T[]>
}

export interface Repository<T> {
  // Django-style objects manager
  objects: DjangoManager<T>

  // CRUD operations
  findById(id: string | number): Promise<T | null>
  findAll(): Promise<T[]>
  create(data: Partial<T>): Promise<T>
  update(entity: T): Promise<T>
  delete(id: string | number): Promise<boolean>

  // Relationships
  findWithRelations(id: string | number, relations: string[]): Promise<T | null>
  loadRelationships(entities: T[], relations: string[]): Promise<void>

  // Utility methods
  count(): Promise<number>
  exists(id: string | number): Promise<boolean>

  // Pagination
  paginate(options: {
    page: number
    limit: number
    where?: Partial<T>
    orderBy?: {
      column: keyof T
      direction: 'asc' | 'desc'
    }
  }): Promise<{
    data: T[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }>

  // Relationship counting
  withCount(id: string | number, relationships: string[]): Promise<T & Record<string, number>>

  // Custom finders (auto-generated from schema)
  [key: string]: unknown
}

export interface AgentSession {
  id: string | number
  name?: string
  status: 'active' | 'archived' | 'deleted'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AgentMessage {
  id: string | number
  sessionId: string | number
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AgentGoal {
  id: string | number
  sessionId: string | number
  parentId?: string | number // For hierarchical sub-goals
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  priority: number
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AgentMemory {
  id: string | number
  sessionId?: string | number
  content: string
  embedding?: number[]
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AgentReflection {
  id: string | number
  sessionId?: string | number
  outcome: 'success' | 'failure' | 'interrupted'
  lessonsLearned: string
  suggestedActions?: string[]
  metadata?: Record<string, any>
  createdAt: Date
}

export interface KnowledgeItem {
  id: string | number
  entity: string
  fact: string
  confidence: number
  status: 'verified' | 'disputed' | 'deprecated' // Collapsed 'proposed' into 'verified' (as initial low-confidence) or handled by implicit state
  sourceSessionId?: string | number
  tags?: string[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgeLink {
  id: string | number
  sourceId: string | number
  targetId: string | number
  relationship: string // e.g. "is_part_of", "related_to"
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AgentAction {
  id: string | number
  sessionId: string | number
  messageId?: string | number
  toolName: string
  arguments: Record<string, any>
  outcome?: string
  status: 'success' | 'failure' | 'pending'
  durationMs?: number
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AgentEpisode {
  id: string | number
  sessionId: string | number
  name: string
  summary?: string
  startTime: Date
  endTime?: Date
  status: 'active' | 'completed'
  metadata?: Record<string, any>
}

export interface ResourceUsage {
  id: string | number
  sessionId: string | number
  agentId?: string
  modelName: string
  inputTokens: number
  outputTokens: number
  cost?: number
  currency?: string
  createdAt: Date
}

export interface AgentCapability {
  id: string | number
  name: string
  version: string
  description?: string
  status: 'experimental' | 'verified' | 'blacklisted'
  reliability: number // 0.0 to 1.0 success rate
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AgentPolicy {
  id: string | number
  name: string
  type: 'budget' | 'safety' | 'privacy' | 'performance'
  definition: Record<string, any>
  isEnabled: boolean
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AgentMetric {
  id: string | number
  sessionId?: string | number
  agentId?: string
  metricName: string
  metricValue: number
  unit?: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AgentPersona {
  id: string | number
  name: string
  role?: string
  capabilities?: string[]
  policies?: string[]
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface AgentEpoch {
  id: string | number
  sessionId: string | number
  summary: string
  startMessageId: string | number
  endMessageId: string | number
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AgentRitual {
  id: string | number
  name: string
  type: 'optimization' | 'compression' | 'pruning' | 'evolution'
  definition?: string // The ritual script or command
  frequency?: 'hourly' | 'daily' | 'weekly'
  lastRun?: Date
  nextRun?: Date
  lockedUntil?: Date
  status: 'pending' | 'success' | 'failure'
  metadata?: Record<string, any>
}

export interface CognitiveRule {
  id: string | number
  tableName: string
  operation: 'insert' | 'update' | 'delete' | 'select'
  condition?: string
  action: 'allow' | 'deny' | 'audit' | 'mask'
  priority: number
  isEnabled: boolean
  metadata?: Record<string, any>
  createdAt: Date
}



export interface TelemetryEvent {
  id: string | number
  sessionId: string | number
  type: 'action' | 'prompt' | 'output' | 'error' | 'pivot' | 'magic'
  content: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface SessionEvolution {
  id: string | number
  sessionId: string | number
  goalInferred: string
  strategy: string
  evolutionPath: string[] // JSON array in DB
  status: 'active' | 'abandoned' | 'completed' | 'pivoted'
  autonomyLevel: number // 1-4
  isAbandoned: boolean
  metadata?: Record<string, any>
  updatedAt: Date
}

export interface ResearchMetric {
  id: string | number
  metricName: 'autonomy_gradient' | 'discovery_index' | 'time_to_magic' | 'trust_signal'
  metricValue: number
  sessionId?: string | number
  metadata?: Record<string, any>
  createdAt: Date
}

export interface SchemaChange {
  type: 'table_added' | 'table_removed' | 'column_added' | 'column_removed' | 'column_modified'
  table: string
  column?: string
  details?: unknown
}

export interface RefreshResult {
  schemaInfo: SchemaInfo
  changes: SchemaChange[]
  typesRegenerated: boolean
}

// Performance optimization interfaces
export interface ConnectionPoolConfig {
  min?: number
  max?: number
  idleTimeout?: number
  acquireTimeout?: number
}

export interface QueryCacheConfig {
  enabled: boolean
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum cache size
}

export interface BatchConfig {
  maxBatchSize: number
  batchTimeout: number // Maximum time to wait before executing batch
}

export interface OptimizationRecommendation {
  type: 'index' | 'query' | 'schema' | 'performance'
  priority: 'low' | 'medium' | 'high'
  description: string
  suggestion: string
  estimatedImpact: string
}

// Repository interface improvements
export interface BaseRepository<T> {
  // CRUD operations
  findAll(): Promise<T[]>
  findById(id: string | number): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(id: string | number, data: Partial<T>): Promise<T>
  delete(id: string | number): Promise<boolean>
  count(): Promise<number>
}

// Configuration validation function type
export function validateNOORMConfig(config: NOORMConfig): void {
  if (!config.dialect) {
    throw new Error('Dialect is required')
  }

  if (!config.connection?.database) {
    throw new Error('Database path is required')
  }

  // Validate dialect-specific requirements
  if (config.dialect === 'sqlite') {
    if (!config.connection.database.endsWith('.db') && !config.connection.database.endsWith('.sqlite')) {
      console.warn('SQLite database path should typically end with .db or .sqlite')
    }
  }

  // Validate performance settings
  if (config.performance?.maxBatchSize && config.performance.maxBatchSize <= 0) {
    throw new Error('maxBatchSize must be greater than 0')
  }

  if (config.performance?.maxCacheSize && config.performance.maxCacheSize <= 0) {
    throw new Error('maxCacheSize must be greater than 0')
  }
}

// Evolution & Synthesis types
export interface SkillSynthesisStrategy {
  name: string
  synthesize(context: SynthesisContext): Promise<{
    mutatedDescription: string
    mutatedMetadata: Record<string, any>
    version: string
  }>
}

export interface SynthesisContext {
  targetTool: string
  failures: {
    arguments: Record<string, any>
    error?: string
    outcome?: string
    timestamp: Date
  }[]
  existingDescription?: string
  evolutionConfig: EmergentSkillConfig
}

/**
 * Production-grade LLM Provider interface.
 * Allows NOORMME to orchestrate AI-driven self-improvement.
 */
export interface LLMProvider {
  /**
   * Complete a prompt/chat sequence.
   */
  complete(options: {
    prompt?: string
    messages?: AgentMessage[]
    temperature?: number
    maxTokens?: number
    responseFormat?: 'text' | 'json'
  }): Promise<{
    content: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }>
}
