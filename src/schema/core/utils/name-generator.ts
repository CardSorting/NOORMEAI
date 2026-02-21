/**
 * Utility class for generating relationship names and handling naming conventions
 */
export class NameGenerator {
  /**
   * Generate relationship name from foreign key column
   */
  static generateRelationshipName(columnName: string, referencedTable: string): string {
    // Handle undefined/null inputs gracefully
    if (!columnName) {
      console.warn('generateRelationshipName called with undefined columnName')
      return 'unknown'
    }
    
    // Remove common foreign key suffixes
    let name = columnName
    if (name.endsWith('_id')) {
      name = name.slice(0, -3)
    }
    if (name.endsWith('Id')) {
      name = name.slice(0, -2)
    }

    // Convert to camelCase
    return this.toCamelCase(name)
  }

  /**
   * Generate reverse relationship name
   */
  static generateReverseRelationshipName(tableName: string, columnName: string): string {
    // Convert table name to plural for one-to-many relationships
    const pluralTableName = this.pluralize(this.toCamelCase(tableName))
    return pluralTableName
  }

  /**
   * Convert string to camelCase
   */
  static toCamelCase(str: string): string {
    // Handle undefined/null inputs gracefully
    if (!str) {
      return ''
    }
    
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase()
      })
      .replace(/\s+/g, '')
      .replace(/[_-]/g, '')
  }

  /**
   * Simple pluralization (basic implementation)
   */
  static pluralize(str: string): string {
    // Handle undefined/null inputs gracefully
    if (!str) {
      return ''
    }
    
    // Handle words that are already plural
    // Common plural endings that shouldn't be pluralized further
    if (str.endsWith('ses') || str.endsWith('xes') || str.endsWith('zes') || 
        str.endsWith('ches') || str.endsWith('shes') || 
        str.endsWith('ies') || str.endsWith('ves')) {
      return str
    }
    
    // Handle words ending in 's' - likely already plural
    // Exception: words ending in 'ss' should get 'es'
    if (str.endsWith('ss')) {
      return str + 'es'
    }
    if (str.endsWith('s')) {
      // Already plural, return as-is
      return str
    }
    
    // Handle words ending in 'y' preceded by a consonant
    if (str.endsWith('y') && str.length > 1 && !'aeiou'.includes(str[str.length - 2])) {
      return str.slice(0, -1) + 'ies'
    }
    
    // Handle words ending in sh, ch, x, z
    if (str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
      return str + 'es'
    }
    
    // Default: add 's'
    return str + 's'
  }
}
