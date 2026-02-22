"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSchemaHelper = void 0;
const sql_js_1 = require("../raw-builder/sql.js");
/**
 * AgentSchemaHelper provides utilities to initialize the database
 * with tables required for AI agent persistence.
 */
class AgentSchemaHelper {
    db;
    config;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
    }
    /**
     * Initialize all agentic tables
     */
    async initializeSchema() {
        const sessionsTable = this.config.sessionsTable || 'agent_sessions';
        const messagesTable = this.config.messagesTable || 'agent_messages';
        const goalsTable = this.config.goalsTable || 'agent_goals';
        const memoriesTable = this.config.memoriesTable || 'agent_memories';
        const reflectionsTable = this.config.reflectionsTable || 'agent_reflections';
        const knowledgeTable = this.config.knowledgeTable || 'agent_knowledge_base';
        const actionsTable = this.config.actionsTable || 'agent_actions';
        const episodesTable = this.config.episodesTable || 'agent_episodes';
        const resourcesTable = this.config.resourcesTable || 'agent_resource_usage';
        const capabilitiesTable = this.config.capabilitiesTable || 'agent_capabilities';
        const policiesTable = this.config.policiesTable || 'agent_policies';
        const metricsTable = this.config.metricsTable || 'agent_metrics';
        const personasTable = this.config.personasTable || 'agent_personas';
        const epochsTable = this.config.epochsTable || 'agent_epochs';
        const ritualsTable = this.config.ritualsTable || 'agent_rituals';
        const rulesTable = this.config.rulesTable || 'agent_rules';
        const snapshotsTable = 'agent_snapshots';
        const knowledgeLinksTable = 'agent_knowledge_links';
        // 1. Sessions Table
        await this.db.schema
            .createTable(sessionsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('name', 'text')
            .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .addColumn('updated_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 2. Messages Table
        await this.db.schema
            .createTable(messagesTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('role', 'text', (col) => col.notNull())
            .addColumn('content', 'text', (col) => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 3. Goals Table
        await this.db.schema
            .createTable(goalsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('parent_id', 'integer', (col) => col.references(`${goalsTable}.id`).onDelete('cascade'))
            .addColumn('description', 'text', (col) => col.notNull())
            .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
            .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .addColumn('updated_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 4. Memories Table (Basic)
        await this.db.schema
            .createTable(memoriesTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('content', 'text', (col) => col.notNull())
            .addColumn('embedding', 'text') // In Postgres with pgvector, this would be 'vector(D)'
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 5. Reflections Table
        await this.db.schema
            .createTable(reflectionsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('outcome', 'text', (col) => col.notNull())
            .addColumn('lessons_learned', 'text', (col) => col.notNull())
            .addColumn('suggested_actions', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 6. Knowledge Base Table
        await this.db.schema
            .createTable(knowledgeTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('entity', 'text', (col) => col.notNull())
            .addColumn('fact', 'text', (col) => col.notNull())
            .addColumn('confidence', 'real', (col) => col.notNull().defaultTo(1.0))
            .addColumn('source_session_id', 'integer', (col) => col.references(`${sessionsTable}.id`).onDelete('set null'))
            .addColumn('tags', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .addColumn('updated_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 7. Actions Table
        await this.db.schema
            .createTable(actionsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.notNull().references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('message_id', 'integer', (col) => col.references(`${messagesTable}.id`).onDelete('set null'))
            .addColumn('tool_name', 'text', (col) => col.notNull())
            .addColumn('arguments', 'text', (col) => col.notNull())
            .addColumn('outcome', 'text')
            .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
            .addColumn('duration_ms', 'integer')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 8. Episodes Table
        await this.db.schema
            .createTable(episodesTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.notNull().references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('name', 'text', (col) => col.notNull())
            .addColumn('summary', 'text')
            .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
            .addColumn('start_time', 'timestamp', (col) => col.notNull())
            .addColumn('end_time', 'timestamp')
            .addColumn('metadata', 'text')
            .execute();
        // 9. Resource Usage Table
        await this.db.schema
            .createTable(resourcesTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.notNull().references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('agent_id', 'text')
            .addColumn('model_name', 'text', (col) => col.notNull())
            .addColumn('input_tokens', 'integer', (col) => col.notNull().defaultTo(0))
            .addColumn('output_tokens', 'integer', (col) => col.notNull().defaultTo(0))
            .addColumn('cost', 'real', (col) => col.notNull().defaultTo(0))
            .addColumn('currency', 'text', (col) => col.notNull().defaultTo('USD'))
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 10. Capabilities Table
        await this.db.schema
            .createTable(capabilitiesTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('name', 'text', (col) => col.notNull())
            .addColumn('version', 'text', (col) => col.notNull())
            .addColumn('description', 'text')
            .addColumn('status', 'text', (col) => col.notNull().defaultTo('experimental'))
            .addColumn('reliability', 'real', (col) => col.notNull().defaultTo(1.0))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .addColumn('updated_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 11. Policies Table
        await this.db.schema
            .createTable(policiesTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('name', 'text', (col) => col.notNull())
            .addColumn('type', 'text', (col) => col.notNull())
            .addColumn('definition', 'text', (col) => col.notNull())
            .addColumn('isEnabled', 'integer', (col) => col.notNull().defaultTo(1))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .addColumn('updated_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 12. Metrics Table
        await this.db.schema
            .createTable(metricsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.references(`${sessionsTable}.id`).onDelete('set null'))
            .addColumn('agent_id', 'text')
            .addColumn('metric_name', 'text', (col) => col.notNull())
            .addColumn('metric_value', 'real', (col) => col.notNull())
            .addColumn('unit', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 13. Personas Table
        await this.db.schema
            .createTable(personasTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('name', 'text', (col) => col.notNull().unique())
            .addColumn('role', 'text')
            .addColumn('capabilities', 'text')
            .addColumn('policies', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .addColumn('updated_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 14. Epochs Table
        await this.db.schema
            .createTable(epochsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', (col) => col.notNull().references(`${sessionsTable}.id`).onDelete('cascade'))
            .addColumn('summary', 'text', (col) => col.notNull())
            .addColumn('start_message_id', 'integer', (col) => col.notNull())
            .addColumn('end_message_id', 'integer', (col) => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 15. Rituals Table
        await this.db.schema
            .createTable(ritualsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('name', 'text', (col) => col.notNull())
            .addColumn('type', 'text', (col) => col.notNull())
            .addColumn('definition', 'text') // The script or command to run
            .addColumn('frequency', 'text') // hourly, daily, weekly
            .addColumn('last_run', 'timestamp')
            .addColumn('next_run', 'timestamp')
            .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
            .addColumn('metadata', 'text')
            .execute();
        // 16. Rules Table
        await this.db.schema
            .createTable(rulesTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('tableName', 'text', (col) => col.notNull())
            .addColumn('operation', 'text', (col) => col.notNull())
            .addColumn('action', 'text', (col) => col.notNull())
            .addColumn('script', 'text')
            .addColumn('isEnabled', 'integer', (col) => col.notNull().defaultTo(1))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 17. Snapshots Table
        await this.db.schema
            .createTable(snapshotsTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('name', 'text', (col) => col.notNull())
            .addColumn('dna', 'text', (col) => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 19. Logic Probes Table (Self-Verification)
        await this.db.schema
            .createTable('agent_logic_probes')
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('name', 'text', (col) => col.notNull().unique())
            .addColumn('script', 'text', (col) => col.notNull())
            .addColumn('expected_outcome', 'text')
            .addColumn('last_run', 'timestamp')
            .addColumn('last_status', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
        // 20. Knowledge Links Table
        await this.db.schema
            .createTable(knowledgeLinksTable)
            .ifNotExists()
            .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
            .addColumn('source_id', 'integer', (col) => col.notNull().references(`${knowledgeTable}.id`).onDelete('cascade'))
            .addColumn('target_id', 'integer', (col) => col.notNull().references(`${knowledgeTable}.id`).onDelete('cascade'))
            .addColumn('relationship', 'text', (col) => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', (col) => col.notNull())
            .execute();
    }
    /**
     * Enable vector extensions if supported
     */
    async enableVectorSupport() {
        // This is dialect-specific and usually requires superuser permissions in Postgres
        try {
            await (0, sql_js_1.sql) `CREATE EXTENSION IF NOT EXISTS vector`.execute(this.db);
        }
        catch (e) {
            console.warn('Failed to enable pgvector extension. Ensure it is installed on your Postgres server.');
        }
    }
}
exports.AgentSchemaHelper = AgentSchemaHelper;
