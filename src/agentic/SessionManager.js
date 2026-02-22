"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
/**
 * SessionManager handles the lifecycle of agentic sessions, including
 * message history, goal tracking, and memory persistence.
 */
class SessionManager {
    db;
    config;
    telemetry;
    sessionsTable;
    messagesTable;
    memoriesTable;
    goalsTable;
    constructor(db, config = {}, telemetry) {
        this.db = db;
        this.config = config;
        this.telemetry = telemetry;
        this.sessionsTable = config.sessionsTable || 'agent_sessions';
        this.messagesTable = config.messagesTable || 'agent_messages';
        this.memoriesTable = config.memoriesTable || 'agent_memories';
        this.goalsTable = config.goalsTable || 'agent_goals';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Create a new agent session
     */
    async createSession(name, metadata) {
        const session = await this.typedDb
            .insertInto(this.sessionsTable)
            .values({
            name: name || null,
            status: 'active',
            metadata: metadata ? JSON.stringify(metadata) : null,
            created_at: new Date(),
            updated_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseSession(session);
    }
    /**
     * Retrieve a session by ID
     */
    async getSession(id) {
        const session = await this.typedDb
            .selectFrom(this.sessionsTable)
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();
        return session ? this.parseSession(session) : null;
    }
    /**
     * Mark a session as archived.
     */
    async archiveSession(id) {
        const session = await this.typedDb
            .updateTable(this.sessionsTable)
            .set({ status: 'archived', updated_at: new Date() })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseSession(session);
    }
    /**
     * Delete a session and all associated data (messages, goals, memories).
     */
    async deleteSession(id) {
        await this.db.transaction().execute(async (trx) => {
            // Delete associated data first
            await trx.deleteFrom(this.messagesTable).where('session_id', '=', id).execute();
            await trx.deleteFrom(this.goalsTable).where('session_id', '=', id).execute();
            await trx.deleteFrom(this.memoriesTable).where('session_id', '=', id).execute();
            // Delete the session itself
            await trx.deleteFrom(this.sessionsTable).where('id', '=', id).execute();
        });
    }
    /**
     * Add a message to a session
     */
    async addMessage(sessionId, role, content, metadata) {
        return await this.db.transaction().execute(async (trx) => {
            const message = await trx
                .insertInto(this.messagesTable)
                .values({
                session_id: sessionId,
                role,
                content,
                metadata: metadata ? JSON.stringify(metadata) : null,
                created_at: new Date()
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            // Update session's updated_at
            await trx
                .updateTable(this.sessionsTable)
                .set({ updated_at: new Date() })
                .where('id', '=', sessionId)
                .execute();
            return this.parseMessage(message);
        });
    }
    /**
     * Get message history for a session
     */
    async getHistory(sessionId, limit = 50) {
        const messages = await this.typedDb
            .selectFrom(this.messagesTable)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'asc')
            .limit(limit)
            .execute();
        return messages.map(m => this.parseMessage(m));
    }
    /**
     * Set or update a goal for a session
     */
    async upsertGoal(sessionId, description, options = {}) {
        const { status = 'pending', priority = 0, parentId, metadata } = options;
        return await this.db.transaction().execute(async (trx) => {
            const existing = await trx
                .selectFrom(this.goalsTable)
                .selectAll()
                .where('session_id', '=', sessionId)
                .where('description', '=', description)
                .executeTakeFirst();
            if (existing) {
                const updated = await trx
                    .updateTable(this.goalsTable)
                    .set({
                    status,
                    priority,
                    metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
                    updated_at: new Date()
                })
                    .where('id', '=', existing.id)
                    .returningAll()
                    .executeTakeFirstOrThrow();
                return this.parseGoal(updated);
            }
            const created = await trx
                .insertInto(this.goalsTable)
                .values({
                session_id: sessionId,
                parent_id: parentId || null,
                description,
                status,
                priority,
                metadata: metadata ? JSON.stringify(metadata) : null,
                created_at: new Date(),
                updated_at: new Date()
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            const parsed = this.parseGoal(created);
            // Telemetry: Track goal discovery
            if (this.telemetry) {
                await this.telemetry.track(sessionId, 'pivot', `New goal: ${description}`, { goalId: parsed.id });
            }
            return parsed;
        });
    }
    /**
     * Get goals for a session.
     */
    async getGoals(sessionId, status) {
        let query = this.typedDb
            .selectFrom(this.goalsTable)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('priority', 'desc');
        if (status) {
            query = query.where('status', '=', status);
        }
        const goals = await query.execute();
        return goals.map(g => this.parseGoal(g));
    }
    /**
     * Clear message history for a session.
     */
    async clearHistory(sessionId) {
        const result = await this.typedDb
            .deleteFrom(this.messagesTable)
            .where('session_id', '=', sessionId)
            .executeTakeFirst();
        return Number(result.numDeletedRows || 0);
    }
    /**
     * Mark a message as a semantic anchor to prevent it from being pruned
     */
    async markMessageAsAnchor(messageId) {
        const message = await this.typedDb
            .selectFrom(this.messagesTable)
            .selectAll()
            .where('id', '=', messageId)
            .executeTakeFirstOrThrow();
        const metadata = typeof message.metadata === 'string'
            ? JSON.parse(message.metadata)
            : (message.metadata || {});
        const updatedMetadata = { ...metadata, anchor: true };
        const updated = await this.typedDb
            .updateTable(this.messagesTable)
            .set({
            metadata: JSON.stringify(updatedMetadata)
        })
            .where('id', '=', messageId)
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseMessage(updated);
    }
    parseSession(session) {
        return {
            id: session.id,
            name: session.name,
            status: session.status,
            metadata: typeof session.metadata === 'string' ? JSON.parse(session.metadata) : (session.metadata || {}),
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at)
        };
    }
    parseMessage(message) {
        return {
            id: message.id,
            sessionId: message.session_id,
            role: message.role,
            content: message.content,
            metadata: typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {}),
            createdAt: new Date(message.created_at)
        };
    }
    parseGoal(goal) {
        return {
            id: goal.id,
            sessionId: goal.session_id,
            parentId: goal.parent_id,
            description: goal.description,
            status: goal.status,
            priority: goal.priority,
            metadata: typeof goal.metadata === 'string' ? JSON.parse(goal.metadata) : (goal.metadata || {}),
            createdAt: new Date(goal.created_at),
            updatedAt: new Date(goal.updated_at)
        };
    }
}
exports.SessionManager = SessionManager;
