"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionEngine = void 0;
/**
 * ReflectionEngine enables agents to perform "post-mortems" on sessions,
 * storing lessons learned and evaluating outcomes to improve future performance.
 */
class ReflectionEngine {
    db;
    config;
    reflectionsTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.reflectionsTable = config.reflectionsTable || 'agent_reflections';
    }
    /**
     * Record a reflection for a session
     */
    async reflect(sessionId, outcome, lessonsLearned, suggestedActions, metadata) {
        const reflection = await this.db
            .insertInto(this.reflectionsTable)
            .values({
            session_id: sessionId,
            outcome,
            lessons_learned: lessonsLearned,
            suggested_actions: suggestedActions ? JSON.stringify(suggestedActions) : null,
            metadata: metadata ? JSON.stringify(metadata) : null,
            created_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseReflection(reflection);
    }
    /**
     * Get reflections for a specific session
     */
    async getSessionReflections(sessionId) {
        const reflections = await this.db
            .selectFrom(this.reflectionsTable)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'desc')
            .execute();
        return reflections.map(r => this.parseReflection(r));
    }
    /**
     * Get recent lessons learned across all sessions
     */
    async getRecentLessons(limit = 10) {
        const reflections = await this.db
            .selectFrom(this.reflectionsTable)
            .select('lessons_learned')
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();
        return reflections.map((r) => r.lessons_learned);
    }
    parseReflection(reflection) {
        return {
            ...reflection,
            sessionId: reflection.session_id,
            lessonsLearned: reflection.lessons_learned,
            suggestedActions: typeof reflection.suggested_actions === 'string'
                ? JSON.parse(reflection.suggested_actions)
                : reflection.suggested_actions,
            metadata: typeof reflection.metadata === 'string'
                ? JSON.parse(reflection.metadata)
                : reflection.metadata,
            createdAt: new Date(reflection.created_at)
        };
    }
}
exports.ReflectionEngine = ReflectionEngine;
