# NOORMME: The Agentic Data Engine

**NOORMME** is a sovereign persistence layer and cognitive operating system designed for **Autonomous AI Agents**. It transcends legacy ORM patterns by providing a self-healing, evolutionary data infrastructure that functions as an extension of the agent's internal reasoning loop.

[![Version](https://img.shields.io/npm/v/noormme.svg)](https://www.npmjs.com/package/noormme)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Cognitive](https://img.shields.io/badge/Intelligence-Autonomous_Governance-purple.svg)](#-autonomous-governance)

---

## 🏗 The Agentic Data Loop

NOORMME implements a closed-loop system where data is not merely "stored" but continuously distilled, questioned, and evolved.

### 🧠 Cognitive Orchestration
- **Strategic Planner**: Proactively suggests and applies persona mutations (roles, policies, capabilities) based on real-time success/latency telemetry.
- **Knowledge Distiller**: Extracts structured entities and facts from raw history using Jaccard similarity-based consolidation and confidence gradients.
- **Curiosity Engine**: Identifies "Knowledge Gaps" and "Factual Contradictions," generating research hypotheses and active questions for the agent to resolve.
- **Ablation Labs**: Conducts "Zombie Pruning" and "Impact Tests"—temporarily disabling knowledge to evaluate its necessity in the reasoning path.

---

## 💎 Technical Moats

### 🧬 Evolutionary Infrastructure & "DNA Inversion"
NOORMME allows agents to autonomously mutate their own schema.
- **Dynamic DDL**: Agents can propose `CREATE TABLE`, `ADD COLUMN`, or `CREATE INDEX` mutations via the **Evolutionary Pilot**.
- **Structural Rollback**: The **DNA Inverter** automatically generates inverse SQL for any DDL mutation (e.g., inverting an `ADD COLUMN` to a `DROP COLUMN`) to ensure safe structural experimentation.
- **Real-Time Type Synthesis**: TypeScript interfaces and types are regenerated and written to disk the moment a structural change is committed.

### 🚥 Autonomous Governance (Logic Probes)
The **Self-Test Registry** enables agents to maintain their own integrity through automated "probes":
- **Integrity Audits**: Detects orphaned records and semantic memory failures.
- **Performance Drift**: Detects when autonomous schema changes cause query latency to drift more than 50% from a rolling 100-query baseline.
- **Consistency Probes**: Verifies that new knowledge doesn't contradict established "Hive" facts.

### 📊 Deep Behavioral Telemetry
A three-layered telemetry stack for research and production observation:
1. **Raw Event Harvester**: High-fidelity capture of every interaction, pivot, and failure.
2. **Cognitive Synthesizer**: Serializes the strategic "Evolution Path" and calculates dynamic **Autonomy Levels**.
3. **Research Alchemist**: Transmutes events into high-order metrics like **Time-to-Magic**, **Discovery Index**, and **Trust Signals**.

---

## ⚡ Performance Engineering

### Query Intelligence
- **N+1 Detection**: Real-time pattern analysis to identify and warn about inefficient recursive queries.
- **Semantic Caching**: Context-aware result caching that understands query patterns rather than just raw SQL.
- **Dialect Optimization**: Native WAL-mode management for SQLite and optimized JSONB/Vector operations for PostgreSQL.

### High-Fidelity Infrastructure
- **Unified Vector Abstraction**: Seamless semantic search across `PGVector`, `SQLite-vss`, and a optimized **Manual Cosine Fallback**.
- **Ritual Orchestration**: Automated background "rituals" for semantic compression, stale history pruning, and database vacuuming.

---

## 🚀 Implementation

### Initializing the Mind
```typescript
import { NOORMME } from 'noormme';

const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './mind.sqlite' },
  agentic: {
    enableSelfEvolution: true,
    enableSelfHealing: true
  }
});

// Provisions 20+ tables for goals, knowledge, episodes, and logic probes
await db.initialize();
```

### Strategic Interaction
```typescript
// Access the higher-order cognitive facade
const cortex = db.agent.cortex;

// Execute a background knowledge distillation ritual
await cortex.rituals.runPendingRituals();

// Challenge existing knowledge with new evidence
await cortex.knowledge.challengeKnowledge('SystemArchitecture', 'New facts contradict old.', 0.95);
```

---

## 🗄 Dialect Matrix

| Feature | SQLite (Edge) | PostgreSQL (Enterprise) |
| :--- | :--- | :--- |
| **Search** | `sqlite-vss` / Fallback | `pgvector` |
| **Persistence** | WAL Mode | Native Pooling / SSL |
| **Evolution** | DNA Inversion | Structural Migrations |
| **Reliability** | Local Atomicity | Multi-Tenant Isolation |

---

## 🤝 Community & Contribution
NOORMME is an Apache 2.0 open-source project. We invite AI researchers and data engineers to contribute to the future of autonomous persistence.

[Contribution Guide](CONTRIBUTING.md) | [Security Audit](SECURITY.md)

---

*Transforming passive records into sovereign intelligence.*