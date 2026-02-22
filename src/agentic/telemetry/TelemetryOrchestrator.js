"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryOrchestrator = void 0;
const EventHarvester_js_1 = require("./EventHarvester.js");
const CognitiveSynthesizer_js_1 = require("./CognitiveSynthesizer.js");
const ResearchAlchemist_js_1 = require("./ResearchAlchemist.js");
class TelemetryOrchestrator {
    db;
    config;
    harvester;
    synthesizer;
    alchemist;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.harvester = new EventHarvester_js_1.EventHarvester(db, config);
        this.synthesizer = new CognitiveSynthesizer_js_1.CognitiveSynthesizer(db, config);
        this.alchemist = new ResearchAlchemist_js_1.ResearchAlchemist(db, config);
    }
    /**
     * Track a raw event and trigger synthesis
     */
    async track(sessionId, type, content, metadata) {
        // Layer A: Harvest
        await this.harvester.harvest(sessionId, type, content, metadata);
        // Layer B: Synthesize
        if (type === 'prompt' || type === 'action') {
            await this.synthesizer.synthesize(sessionId, content);
        }
        // Layer C: Research triggers
        if (type === 'magic') {
            await this.alchemist.recordMagic(sessionId, metadata?.surpriseScore || 1.0);
        }
        if (type === 'pivot' || type === 'error') {
            await this.synthesizer.trackShift(sessionId, type === 'pivot' ? 'pivot' : 'abandonment');
        }
    }
    /**
     * Record interaction metrics
     */
    async logResearchMetric(sessionId, metric, value, metadata) {
        await this.alchemist.transmute(sessionId, metric, value, metadata);
    }
}
exports.TelemetryOrchestrator = TelemetryOrchestrator;
