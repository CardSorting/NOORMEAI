import { NoormError, ColumnNotFoundError, TableNotFoundError, ConnectionError } from '../errors/NoormError.js';

/**
 * Wraps Kysely errors with more context-aware NoormError instances
 */
export function wrapKyselyError(
  error: any,
  context: {
    table?: string;
    operation?: string;
    availableColumns?: string[];
    availableTables?: string[];
  }
): NoormError {
  const message = error.message || String(error);

  // Handle column not found errors
  if (message.includes('column') && message.includes('does not exist')) {
    const columnName = extractColumnName(message);
    if (columnName && context.table && context.availableColumns) {
      return new ColumnNotFoundError(columnName, context.table, context.availableColumns);
    }
  }

  // Handle table not found errors
  if (message.includes('relation') && message.includes('does not exist')) {
    const tableName = extractTableName(message);
    if (tableName && context.availableTables) {
      return new TableNotFoundError(tableName, context.availableTables);
    }
  }

  // Handle connection errors
  if (message.includes('connect') || message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
    return new ConnectionError(message, error);
  }

  // Handle authentication errors
  if (message.includes('authentication') || message.includes('password') || message.includes('SASL')) {
    return new ConnectionError('Authentication failed. Check your username and password.', error);
  }

  // Handle syntax errors
  if (message.includes('syntax error') || message.includes('near')) {
    return new NoormError(
      `SQL syntax error: ${message}`,
      {
        table: context.table,
        operation: context.operation,
        suggestion: 'Check your query syntax or report this as a bug if you\'re using NOORMME methods',
        originalError: error
      }
    );
  }

  // Handle constraint violations
  if (message.includes('constraint') || message.includes('duplicate') || message.includes('unique')) {
    return new NoormError(
      `Database constraint violation: ${extractConstraintMessage(message)}`,
      {
        table: context.table,
        operation: context.operation,
        suggestion: 'Check for duplicate values or foreign key violations',
        originalError: error
      }
    );
  }

  // Generic wrapper for other errors
  return new NoormError(
    message,
    {
      table: context.table,
      operation: context.operation,
      suggestion: 'Check the database connection and query parameters',
      originalError: error
    }
  );
}

/**
 * Extract column name from PostgreSQL/MySQL error messages
 */
export function extractColumnName(errorMessage: string): string | null {
  // PostgreSQL: column "column_name" does not exist
  let match = errorMessage.match(/column "([^"]+)" does not exist/i);
  if (match) return match[1];

  // MySQL: Unknown column 'column_name' in 'field list'
  match = errorMessage.match(/Unknown column '([^']+)'/i);
  if (match) return match[1];

  // SQLite: no such column: column_name
  match = errorMessage.match(/no such column: (\w+)/i);
  if (match) return match[1];

  return null;
}

/**
 * Extract table name from database error messages
 */
export function extractTableName(errorMessage: string): string | null {
  // PostgreSQL: relation "table_name" does not exist
  let match = errorMessage.match(/relation "([^"]+)" does not exist/i);
  if (match) return match[1];

  // MySQL: Table 'database.table_name' doesn't exist
  match = errorMessage.match(/Table '[^.]+\.([^']+)' doesn't exist/i);
  if (match) return match[1];

  // SQLite: no such table: table_name
  match = errorMessage.match(/no such table: (\w+)/i);
  if (match) return match[1];

  return null;
}

/**
 * Extract constraint information from error messages
 */
export function extractConstraintMessage(errorMessage: string): string {
  // Try to extract a more user-friendly constraint message
  if (errorMessage.includes('duplicate key')) {
    return 'Duplicate value violates unique constraint';
  }

  if (errorMessage.includes('foreign key')) {
    return 'Foreign key constraint violation';
  }

  if (errorMessage.includes('check constraint')) {
    return 'Check constraint violation';
  }

  if (errorMessage.includes('not null')) {
    return 'Required field cannot be null';
  }

  return errorMessage;
}

/**
 * Suggests corrections for typos in table/column names
 */
export function suggestCorrections(input: string, available: string[], maxSuggestions = 3): string[] {
  const suggestions: Array<{ name: string; score: number }> = [];

  for (const option of available) {
    const score = calculateSimilarity(input.toLowerCase(), option.toLowerCase());
    if (score > 0.3) { // Only suggest if similarity > 30%
      suggestions.push({ name: option, score });
    }
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions)
    .map(s => s.name);
}

/**
 * Calculate string similarity using Jaro-Winkler algorithm (simplified)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchWindow < 0) return 0;

  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Find transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Jaro-Winkler bonus for common prefix
  let prefix = 0;
  for (let i = 0; i < Math.min(len1, len2, 4); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + 0.1 * prefix * (1 - jaro);
}