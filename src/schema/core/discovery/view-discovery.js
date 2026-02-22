"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewDiscovery = void 0;
/**
 * Specialized service for discovering database views
 */
class ViewDiscovery {
    static instance;
    static getInstance() {
        if (!ViewDiscovery.instance) {
            ViewDiscovery.instance = new ViewDiscovery();
        }
        return ViewDiscovery.instance;
    }
    /**
     * Discover views in the database
     */
    async discoverViews(introspector) {
        try {
            // Get views using the introspector's getTables method with view filter
            const tables = await introspector.getTables();
            const views = [];
            // Filter for views (this depends on the specific introspector implementation)
            for (const table of tables) {
                // Check if this is a view (different databases handle this differently)
                if (this.isView(table)) {
                    views.push({
                        name: table.name,
                        schema: table.schema,
                        definition: (await this.getViewDefinition(introspector, table.name)) ?? undefined,
                        columns: [] // Views don't have explicit columns in this context
                    });
                }
            }
            return views;
        }
        catch (error) {
            console.warn('Failed to discover views:', error);
            return [];
        }
    }
    /**
     * Get view definition for a specific view
     */
    async getViewDefinition(introspector, viewName) {
        try {
            // Delegate to dialect-specific introspector
            return await introspector.getViewDefinition(viewName);
        }
        catch (error) {
            console.warn(`Failed to get definition for view ${viewName}:`, error);
            return null;
        }
    }
    /**
     * Check if a table metadata represents a view
     */
    isView(table) {
        // Different databases indicate views differently
        // PostgreSQL: table.isView or table.table_type === 'v'
        // MySQL: table.table_type === 'VIEW'
        // SQLite: table.type === 'view'
        return (table.isView === true ||
            table.table_type === 'v' ||
            table.table_type === 'VIEW' ||
            table.type === 'view');
    }
    /**
     * Validate view metadata
     */
    validateView(view) {
        const issues = [];
        if (!view.name) {
            issues.push('View name is required');
        }
        if (!view.definition || view.definition.trim() === '') {
            issues.push('View definition is required');
        }
        // Check for SQL injection patterns in view definition
        const dangerousPatterns = [
            /DROP\s+TABLE/i,
            /DELETE\s+FROM/i,
            /UPDATE\s+SET/i,
            /INSERT\s+INTO/i,
            /TRUNCATE/i,
            /ALTER\s+TABLE/i
        ];
        if (view.definition) {
            for (const pattern of dangerousPatterns) {
                if (pattern.test(view.definition)) {
                    issues.push(`View definition contains potentially dangerous SQL: ${pattern.source}`);
                }
            }
        }
        return {
            isValid: issues.length === 0,
            issues
        };
    }
    /**
     * Analyze view dependencies
     */
    analyzeViewDependencies(views) {
        const dependencies = new Map();
        for (const view of views) {
            if (view.definition) {
                const deps = this.extractTableReferences(view.definition);
                dependencies.set(view.name, deps);
            }
        }
        return dependencies;
    }
    /**
     * Extract table references from SQL definition
     */
    extractTableReferences(sql) {
        // Robust regex to extract table references, handling quoted identifiers and schema prefixes
        // Matches: FROM table, FROM "table", FROM schema.table, FROM "schema"."table", JOIN ...
        const referenceRegex = /(?:FROM|JOIN)\s+((?:(?:"[^"]+")|(?:[a-zA-Z_][a-zA-Z0-9_]*))(?:\.(?:(?:"[^"]+")|(?:[a-zA-Z_][a-zA-Z0-9_]*)))?)/gi;
        const references = [];
        let match;
        while ((match = referenceRegex.exec(sql)) !== null) {
            let fullRef = match[1];
            // Handle schema.table -> just take table name for simplicity in discovery
            // or keep the last part
            const parts = fullRef.split('.');
            const tablePart = parts[parts.length - 1];
            // Strip quotes
            const cleanRef = tablePart.replace(/^"|"$/g, '');
            references.push(cleanRef);
        }
        // Remove duplicates
        return [...new Set(references)];
    }
}
exports.ViewDiscovery = ViewDiscovery;
