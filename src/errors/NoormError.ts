/**
 * Enhanced error class with context-aware information
 */
export class NoormError extends Error {
  constructor(
    message: string,
    public context: {
      table?: string;
      operation?: string;
      suggestion?: string;
      availableOptions?: string[];
      originalError?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'NoormError';

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NoormError);
    }
  }

  /**
   * Get a formatted error message with context
   */
  getFormattedMessage(): string {
    let formatted = this.message;

    if (this.context.table) {
      formatted += `\n  Table: ${this.context.table}`;
    }

    if (this.context.operation) {
      formatted += `\n  Operation: ${this.context.operation}`;
    }

    if (this.context.suggestion) {
      formatted += `\n  Suggestion: ${this.context.suggestion}`;
    }

    if (this.context.availableOptions && this.context.availableOptions.length > 0) {
      formatted += `\n  Available options: ${this.context.availableOptions.join(', ')}`;
    }

    if (this.context.originalError) {
      formatted += `\n  Original error: ${this.context.originalError.message}`;
    }

    return formatted;
  }

  /**
   * Convert to JSON for logging/debugging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Specific error types for common scenarios
 */
export class TableNotFoundError extends NoormError {
  constructor(tableName: string, availableTables: string[] = []) {
    const message = availableTables.length > 0
      ? `Table '${tableName}' not found. Available tables: ${availableTables.join(', ')}`
      : `Table '${tableName}' not found. Check your table name or run schema discovery.`
    
    super(
      message,
      {
        table: tableName,
        operation: 'table_lookup',
        suggestion: availableTables.length > 0 
          ? `Available tables: ${availableTables.join(', ')}`
          : 'Check your table name or run schema discovery',
        availableOptions: availableTables
      }
    )
    this.name = 'TableNotFoundError'
  }
}

export class ColumnNotFoundError extends NoormError {
  constructor(columnName: string, tableName: string, availableColumns: string[] = []) {
    // Find similar column names for better suggestions
    const similarColumns = availableColumns.filter(col => 
      col.toLowerCase().includes(columnName.toLowerCase()) ||
      columnName.toLowerCase().includes(col.toLowerCase()) ||
      ColumnNotFoundError.calculateSimilarity(col, columnName) > 0.6
    )

    let suggestion = 'Check your column name or run schema discovery'
    if (availableColumns.length > 0) {
      suggestion = `Available columns: ${availableColumns.join(', ')}`
      if (similarColumns.length > 0) {
        suggestion += `\n  → Did you mean '${similarColumns[0]}'? (${Math.round(ColumnNotFoundError.calculateSimilarity(similarColumns[0], columnName) * 100)}% similarity)`
      }
    }

    super(
      `Column '${columnName}' not found in table '${tableName}'`,
      {
        table: tableName,
        operation: 'column_lookup',
        suggestion: suggestion,
        availableOptions: availableColumns
      }
    )
    this.name = 'ColumnNotFoundError'
  }

  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = ColumnNotFoundError.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }
}

export class ConnectionError extends NoormError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      {
        operation: 'connection',
        suggestion: 'Check your database connection settings and ensure the database server is running',
        originalError
      }
    )
    this.name = 'ConnectionError'
  }
}

export class DatabaseInitializationError extends NoormError {
  constructor(originalError: Error, databasePath: string) {
    super(
      `Failed to initialize database at ${databasePath}: ${originalError.message}`,
      {
        operation: 'initialization',
        suggestion: 'Check database permissions, path validity, and connection settings',
        originalError
      }
    )
    this.name = 'DatabaseInitializationError'
  }
}

export class ValidationError extends NoormError {
  constructor(message: string, validationIssues: string[] = []) {
    super(
      message,
      {
        operation: 'validation',
        suggestion: 'Check your input data and ensure it matches the expected schema',
        availableOptions: validationIssues
      }
    )
    this.name = 'ValidationError'
  }
}

export class RelationshipNotFoundError extends NoormError {
  constructor(relationshipName: string, tableName: string, availableRelationships: string[] = []) {
    super(
      `Relationship '${relationshipName}' not found on table '${tableName}'`,
      {
        table: tableName,
        operation: 'relationship_lookup',
        suggestion: availableRelationships.length > 0
          ? `Available relationships: ${availableRelationships.join(', ')}`
          : 'No relationships defined for this table',
        availableOptions: availableRelationships
      }
    )
    this.name = 'RelationshipNotFoundError'
  }
}

export class QueryExecutionError extends NoormError {
  constructor(query: string, originalError: Error, context?: { table?: string; operation?: string }) {
    super(
      `Query execution failed: ${originalError.message}`,
      {
        operation: context?.operation || 'query_execution',
        table: context?.table,
        suggestion: QueryExecutionError.getQuerySuggestion(query, originalError),
        originalError
      }
    )
    this.name = 'QueryExecutionError'
  }

  private static getQuerySuggestion(query: string, error: Error): string {
    const errorMsg = error.message.toLowerCase()
    
    if (errorMsg.includes('syntax error')) {
      return 'Check your SQL syntax. Common issues: missing commas, unclosed quotes, or invalid keywords.'
    }
    
    if (errorMsg.includes('no such table')) {
      return 'Table does not exist. Check table name or run schema discovery to see available tables.'
    }
    
    if (errorMsg.includes('no such column')) {
      return 'Column does not exist. Check column name or run schema discovery to see available columns.'
    }
    
    if (errorMsg.includes('constraint failed')) {
      return 'Data constraint violation. Check for required fields, unique constraints, or foreign key references.'
    }
    
    if (errorMsg.includes('database is locked')) {
      return 'Database is locked. Enable WAL mode for better concurrency: optimization: { enableWALMode: true }'
    }
    
    return 'Review your query and check the original error message for specific details.'
  }
}

export class SchemaDiscoveryError extends NoormError {
  constructor(tableName: string, originalError: Error) {
    super(
      `Failed to discover schema for table '${tableName}': ${originalError.message}`,
      {
        table: tableName,
        operation: 'schema_discovery',
        suggestion: 'Check table permissions, table name validity, or database connection',
        originalError
      }
    )
    this.name = 'SchemaDiscoveryError'
  }
}

export class MigrationError extends NoormError {
  constructor(migrationName: string, originalError: Error, context?: { step?: string }) {
    super(
      `Migration '${migrationName}' failed${context?.step ? ` at step: ${context.step}` : ''}: ${originalError.message}`,
      {
        operation: 'migration',
        suggestion: 'Check migration SQL syntax, database permissions, or rollback the migration',
        originalError
      }
    )
    this.name = 'MigrationError'
  }
}

export class TypeGenerationError extends NoormError {
  constructor(tableName: string, originalError: Error) {
    super(
      `Failed to generate types for table '${tableName}': ${originalError.message}`,
      {
        table: tableName,
        operation: 'type_generation',
        suggestion: 'Check table schema, column types, or custom type mappings configuration',
        originalError
      }
    )
    this.name = 'TypeGenerationError'
  }
}

/**
 * Helper function to find similar column names using simple string similarity
 */
function findSimilarColumns(columns: string[], target: string): string[] {
  const lowerTarget = target.toLowerCase();

  // First, try exact case-insensitive match
  const exactMatch = columns.find(col => col.toLowerCase() === lowerTarget);
  if (exactMatch) return [exactMatch];

  // Then try substring matches
  const substringMatches = columns.filter(col =>
    col.toLowerCase().includes(lowerTarget) || lowerTarget.includes(col.toLowerCase())
  );

  if (substringMatches.length > 0) {
    return substringMatches.slice(0, 3); // Return up to 3 matches
  }

  // Finally, try simple Levenshtein-like similarity
  const similarities = columns.map(col => ({
    name: col,
    score: calculateSimilarity(lowerTarget, col.toLowerCase())
  }));

  return similarities
    .filter(s => s.score > 0.5) // Only return if similarity > 50%
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.name);
}

/**
 * Simple similarity calculation (Dice coefficient)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;

  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);

  const intersection = bigrams1.filter(bigram => bigrams2.includes(bigram));

  return (2 * intersection.length) / (bigrams1.length + bigrams2.length);
}

function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}