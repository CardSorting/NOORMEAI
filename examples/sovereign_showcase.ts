/**
 * NOORMME: The Sovereign Showcase
 * 
 * This demonstration showcases the definitive feature set of the Agentic Data Engine:
 * - Sovereign Personas & Identity
 * - Evolutionary DNA (Autonomous Schema Growth)
 * - Cognitive Governance (Performance Drift Probes)
 * - Ultra-Scale Orchestration (Tiered Model Routing)
 */

import { NOORMME } from '../dist/index.js';

async function main() {
  console.log('🏛️ Initializing Sovereign Persistence Layer...');

  const db = new NOORMME({
    dialect: 'sqlite',
    connection: { database: './sovereign.sqlite' },
    agentic: {
      enableSelfEvolution: true,
      evolution: {
        mutationAggressiveness: 0.7,
        verificationWindow: 10,
        enableHiveLink: true
      },
      performance: {
        enableAutoOptimization: true,
        rollbackThresholdZ: 2.5
      }
    }
  });

  try {
    // 1. Manifest the Agentic Mind
    await db.initialize();
    console.log('🧠 Mind Provisioned: 25+ Tables specialized for Goals, Knowledge, and Evolution.');

    // 2. Define a Sovereign Persona
    const cortex = db.agent.cortex;
    const persona = await cortex.personas.upsertPersona('Archon-1', {
      role: 'Systemic Strategist',
      capabilities: ['dna_mutation', 'hive_learning', 'drift_monitoring']
    });
    console.log(`👤 Persona Manifested: ${persona.name} (Role: ${persona.role})`);

    // 3. Cognitive Loop: Knowledge Distillation
    console.log('🧪 Distilling high-fidelity knowledge...');
    const session = await db.agent.sessions.createSession('Strategic Onboarding');
    await cortex.knowledge.distill(
      'Sovereignty',
      'The state of self-governed persistence and structural autonomy.',
      0.98,
      session.id
    );

    // 4. Evolutionary DNA: Autonomous Mutation
    console.log('🧬 Proposing structural DNA mutation...');
    const suggestion = db.agent.evolution.suggestAddColumn('agent_knowledge_base', 'semantic_hash', 'text');
    console.log(`💡 Evolution Suggested: ${suggestion}`);
    
    // In a real autonomous loop, the agent verifies and applies:
    await db.agent.evolution.applySuggestion(suggestion);
    console.log('✅ DNA Upgraded: Physical schema mutated autonomously.');

    // 5. Autonomous Governance: Registering Performance Probes
    console.log('🕵️ Registering Drift Probes for Autonomous Governance...');
    await cortex.registerProbe('latency_guard', 'audit:check_performance_drift');
    
    // Run background rituals (Compression, Vacuum, Analysis)
    await cortex.rituals.runPendingRituals();
    console.log('🧘 Background Rituals executed. System state optimized.');

    // 6. Ultra-Scale: Differentiated Routing simulation
    console.log('🚀 Orchestrating Tiered Intelligence...');
    // Real-world logic would route based on metadata:
    // await orchestrator.routeTask(task, { priority: 'high', model: 'premium' });

    console.log('\n✨ SYSTEM MATURITY REACHED: The agent is now sovereign, self-improving, and architecturally stable.');

  } catch (error) {
    console.error('❌ Sovereign initialization failed:', error);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
