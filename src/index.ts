export * from './kysely.js'
export * from './query-creator.js'

export * from './expression/expression.js'
export { expressionBuilder } from './expression/expression-builder.js'
export type { ExpressionBuilder } from './expression/expression-builder.js'
export * from './expression/expression-wrapper.js'

export * from './query-builder/where-interface.js'
export * from './query-builder/returning-interface.js'
export * from './query-builder/output-interface.js'
export * from './query-builder/having-interface.js'
export * from './query-builder/order-by-interface.js'
export * from './query-builder/select-query-builder.js'
export * from './query-builder/insert-query-builder.js'
export * from './query-builder/update-query-builder.js'
export * from './query-builder/delete-query-builder.js'
export * from './query-builder/no-result-error.js'
export * from './query-builder/join-builder.js'
export * from './query-builder/function-module.js'
export * from './query-builder/insert-result.js'
export * from './query-builder/delete-result.js'
export * from './query-builder/update-result.js'
export * from './query-builder/on-conflict-builder.js'
export * from './query-builder/aggregate-function-builder.js'
export * from './query-builder/case-builder.js'
export * from './query-builder/json-path-builder.js'
export * from './query-builder/merge-query-builder.js'
export * from './query-builder/merge-result.js'
export * from './query-builder/order-by-item-builder.js'

export * from './raw-builder/raw-builder.js'
export * from './raw-builder/sql.js'

export * from './query-executor/query-executor.js'
export * from './query-executor/default-query-executor.js'
export * from './query-executor/noop-query-executor.js'
export * from './query-executor/query-executor-provider.js'

export * from './query-compiler/default-query-compiler.js'
export * from './query-compiler/compiled-query.js'

export * from './schema/schema.js'
export * from './schema/builders/create-table-builder.js'
export * from './schema/builders/create-type-builder.js'
export * from './schema/builders/drop-table-builder.js'
export * from './schema/builders/drop-type-builder.js'
export * from './schema/builders/create-index-builder.js'
export * from './schema/builders/drop-index-builder.js'
export * from './schema/builders/create-schema-builder.js'
export * from './schema/builders/drop-schema-builder.js'
export * from './schema/builders/column-definition-builder.js'
export * from './schema/builders/foreign-key-constraint-builder.js'
export * from './schema/builders/alter-table-builder.js'
export * from './schema/builders/create-view-builder.js'
export * from './schema/builders/refresh-materialized-view-builder.js'
export * from './schema/builders/drop-view-builder.js'
export * from './schema/builders/alter-column-builder.js'

export * from './dynamic/dynamic.js'
export * from './dynamic/dynamic-reference-builder.js'
export * from './dynamic/dynamic-table-builder.js'

export * from './driver/driver.js'
export * from './driver/database-connection.js'
export * from './driver/connection-provider.js'
export * from './driver/default-connection-provider.js'
export * from './driver/single-connection-provider.js'
export * from './driver/dummy-driver.js'

export * from './dialect/dialect.js'
export * from './dialect/dialect-adapter.js'
export * from './dialect/dialect-adapter-base.js'
export * from './dialect/database-introspector.js'

export * from './dialect/sqlite/sqlite-dialect.js'
export * from './dialect/sqlite/sqlite-dialect-config.js'
export * from './dialect/sqlite/sqlite-driver.js'
export * from './dialect/sqlite/sqlite-query-compiler.js'
export * from './dialect/sqlite/sqlite-introspector.js'
export * from './dialect/sqlite/sqlite-adapter.js'

export * from './dialect/postgresql/postgresql-dialect.js'
export * from './dialect/postgresql/postgresql-dialect-config.js'
export * from './dialect/postgresql/postgresql-driver.js'
export * from './dialect/postgresql/postgresql-query-compiler.js'
export * from './dialect/postgresql/postgresql-introspector.js'
export * from './dialect/postgresql/postgresql-adapter.js'

export * from './query-compiler/default-query-compiler.js'
export * from './query-compiler/query-compiler.js'

// SQLite Migration System - Focused on SQLite automation and optimization
export * from './sqlite-migration/index.js'

// Database Migration Tools - For SQLite <-> PostgreSQL migrations
export * from './migration/index.js'

export * from './plugin/kysely-plugin.js'
export * from './plugin/camel-case/camel-case-plugin.js'
export * from './plugin/deduplicate-joins/deduplicate-joins-plugin.js'
export * from './plugin/with-schema/with-schema-plugin.js'
export * from './plugin/parse-json-results/parse-json-results-plugin.js'
export * from './plugin/handle-empty-in-lists/handle-empty-in-lists-plugin.js'
export * from './plugin/handle-empty-in-lists/handle-empty-in-lists.js'

export * from './operation-node/add-column-node.js'
export * from './operation-node/add-constraint-node.js'
export * from './operation-node/add-index-node.js'
export * from './operation-node/aggregate-function-node.js'
export * from './operation-node/alias-node.js'
export * from './operation-node/alter-column-node.js'
export * from './operation-node/alter-table-node.js'
export * from './operation-node/and-node.js'
export * from './operation-node/binary-operation-node.js'
export * from './operation-node/case-node.js'
export * from './operation-node/cast-node.js'
export * from './operation-node/check-constraint-node.js'
export * from './operation-node/collate-node.js'
export * from './operation-node/column-definition-node.js'
export * from './operation-node/column-node.js'
export * from './operation-node/column-update-node.js'
export * from './operation-node/common-table-expression-name-node.js'
export * from './operation-node/common-table-expression-node.js'
export * from './operation-node/constraint-node.js'
export * from './operation-node/create-index-node.js'
export * from './operation-node/create-schema-node.js'
export * from './operation-node/create-table-node.js'
export * from './operation-node/create-type-node.js'
export * from './operation-node/create-view-node.js'
export * from './operation-node/refresh-materialized-view-node.js'
export * from './operation-node/data-type-node.js'
export * from './operation-node/default-insert-value-node.js'
export * from './operation-node/default-value-node.js'
export * from './operation-node/delete-query-node.js'
export * from './operation-node/drop-column-node.js'
export * from './operation-node/drop-constraint-node.js'
export * from './operation-node/drop-index-node.js'
export * from './operation-node/drop-schema-node.js'
export * from './operation-node/drop-table-node.js'
export * from './operation-node/drop-type-node.js'
export * from './operation-node/drop-view-node.js'
export * from './operation-node/explain-node.js'
export * from './operation-node/fetch-node.js'
export * from './operation-node/foreign-key-constraint-node.js'
export * from './operation-node/from-node.js'
export * from './operation-node/function-node.js'
export * from './operation-node/generated-node.js'
export * from './operation-node/group-by-item-node.js'
export * from './operation-node/group-by-node.js'
export * from './operation-node/having-node.js'
export * from './operation-node/identifier-node.js'
export * from './operation-node/insert-query-node.js'
export * from './operation-node/join-node.js'
export * from './operation-node/json-operator-chain-node.js'
export * from './operation-node/json-path-leg-node.js'
export * from './operation-node/json-path-node.js'
export * from './operation-node/json-reference-node.js'
export * from './operation-node/limit-node.js'
export * from './operation-node/list-node.js'
export * from './operation-node/matched-node.js'
export * from './operation-node/merge-query-node.js'
export * from './operation-node/modify-column-node.js'
export * from './operation-node/offset-node.js'
export * from './operation-node/on-conflict-node.js'
export * from './operation-node/on-duplicate-key-node.js'
export * from './operation-node/on-node.js'
export * from './operation-node/operation-node-source.js'
export * from './operation-node/operation-node-transformer.js'
export * from './operation-node/operation-node-visitor.js'
export * from './operation-node/operation-node.js'
export * from './operation-node/operator-node.js'
export * from './operation-node/or-action-node.js'
export * from './operation-node/or-node.js'
export * from './operation-node/order-by-item-node.js'
export * from './operation-node/order-by-node.js'
export * from './operation-node/output-node.js'
export * from './operation-node/over-node.js'
export * from './operation-node/parens-node.js'
export * from './operation-node/partition-by-item-node.js'
export * from './operation-node/partition-by-node.js'
export * from './operation-node/primary-key-constraint-node.js'
export * from './operation-node/primitive-value-list-node.js'
export * from './operation-node/query-node.js'
export * from './operation-node/raw-node.js'
export * from './operation-node/reference-node.js'
export * from './operation-node/references-node.js'
export * from './operation-node/rename-column-node.js'
export * from './operation-node/rename-constraint-node.js'
export * from './operation-node/returning-node.js'
export * from './operation-node/schemable-identifier-node.js'
export * from './operation-node/select-all-node.js'
export * from './operation-node/select-modifier-node.js'
export * from './operation-node/select-query-node.js'
export * from './operation-node/selection-node.js'
export * from './operation-node/set-operation-node.js'
export * from './operation-node/simple-reference-expression-node.js'
export * from './operation-node/table-node.js'
export * from './operation-node/top-node.js'
export * from './operation-node/tuple-node.js'
export * from './operation-node/unary-operation-node.js'
export * from './operation-node/unique-constraint-node.js'
export * from './operation-node/update-query-node.js'
export * from './operation-node/using-node.js'
export * from './operation-node/value-list-node.js'
export * from './operation-node/value-node.js'
export * from './operation-node/values-node.js'
export * from './operation-node/when-node.js'
export * from './operation-node/where-node.js'
export * from './operation-node/with-node.js'

export * from './util/column-type.js'
export * from './util/compilable.js'
export * from './util/explainable.js'
export * from './util/streamable.js'
export * from './util/log.js'
export type {
  AnyAliasedColumn,
  AnyAliasedColumnWithTable,
  AnyColumn,
  AnyColumnWithTable,
  Equals,
  UnknownRow,
  Simplify,
  SqlBool,
  Nullable,
  NumbersWhenDataTypeNotAvailable,
  NotNull,
  NumericString,
  ShallowDehydrateObject,
  ShallowDehydrateValue,
  StringsWhenDataTypeNotAvailable,
} from './util/type-utils.js'
export * from './util/infer-result.js'
export { logOnce } from './util/log-once.js'
export { createQueryId } from './util/query-id.js'
export type { QueryId } from './util/query-id.js'

export type {
  SelectExpression,
  SelectCallback,
  SelectArg,
  Selection,
  CallbackSelection,
} from './parser/select-parser.js'
export type {
  ReferenceExpression,
  ReferenceExpressionOrList,
  SimpleReferenceExpression,
  StringReference,
  ExtractTypeFromStringReference,
  ExtractTypeFromReferenceExpression,
} from './parser/reference-parser.js'
export type {
  ValueExpression,
  ValueExpressionOrList,
} from './parser/value-parser.js'
export type {
  SimpleTableReference,
  TableExpression,
  TableExpressionOrList,
} from './parser/table-parser.js'
export type {
  JoinReferenceExpression,
  JoinCallbackExpression,
} from './parser/join-parser.js'
export type { InsertObject } from './parser/insert-values-parser.js'
export type { UpdateObject } from './parser/update-set-parser.js'
export type {
  OrderByExpression,
  OrderByModifiers,
  OrderByDirection,
  OrderByModifiersCallbackExpression,
} from './parser/order-by-parser.js'
export type {
  ComparisonOperatorExpression,
  OperandValueExpression,
  OperandValueExpressionOrList,
  FilterObject,
} from './parser/binary-operation-parser.js'
export type { ExistsExpression } from './parser/unary-operation-parser.js'
export type {
  OperandExpression,
  ExpressionOrFactory,
} from './parser/expression-parser.js'
export type { Collation } from './parser/collate-parser.js'

// NOORMME - No ORM, just magic!
export { NOORMME } from './noormme.js'
export * from './types/index.js'

// Agentic components
export * from './agentic/SessionManager.js'
export * from './agentic/ContextBuffer.js'
export * from './agentic/VectorIndexer.js'
export * from './agentic/Cortex.js'
export * from './agentic/ActionJournal.js'
export * from './agentic/ResourceMonitor.js'
export * from './agentic/EpisodicMemory.js'
export * from './agentic/CapabilityManager.js'
export * from './agentic/PolicyEnforcer.js'
export * from './agentic/SessionCompressor.js'
export * from './agentic/PersonaManager.js'
export * from './agentic/improvement/ReflectionEngine.js'
export * from './agentic/improvement/KnowledgeDistiller.js'
export * from './agentic/improvement/SovereignMetrics.js'
export * from './agentic/improvement/SelfEvolution.js'
export * from './agentic/improvement/EvolutionaryPilot.js'
export * from './agentic/improvement/CortexJanitor.js'
export * from './agentic/improvement/RecursiveReasoner.js'
export * from './agentic/improvement/RuleEngine.js'
export * from './agentic/improvement/ConflictResolver.js'
export * from './agentic/improvement/CuriosityEngine.js'
export * from './agentic/improvement/RitualOrchestrator.js'
export * from './agentic/improvement/ActionRefiner.js'
export * from './agentic/improvement/HiveLink.js'
export * from './agentic/improvement/StrategicPlanner.js'
export * from './agentic/improvement/AblationEngine.js'
export * from './agentic/improvement/SelfTestRegistry.js'
export * from './agentic/improvement/GovernanceManager.js'
export * from './agentic/CognitiveRepository.js'
export * from './helpers/agent-schema.js'
export * from './helpers/schema-evolution.js'

// Error classes
export {
  NoormError,
  TableNotFoundError,
  ColumnNotFoundError,
  ConnectionError,
  DatabaseInitializationError,
  ValidationError,
  RelationshipNotFoundError,
  QueryExecutionError,
  SchemaDiscoveryError,
  MigrationError,
  TypeGenerationError,
} from './errors/NoormError.js'

// CLI commands (for programmatic usage)
export * from './cli/commands/init.js'
export * from './cli/commands/inspect.js'
export * from './cli/commands/generate.js'
