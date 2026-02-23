# NOORMME: The Sovereign Agentic Data Engine

**NOORMME** is a cognitive operating system and sovereign persistence layer that **transforms ordinary AI agents into a self-evolving Cognitive Swarm**. It transcends legacy ORM patterns by providing a high-fidelity extension of an agent's internal reasoning loop, enabling distributed minds to share, learn, and grow collectively.

[![Version](https://img.shields.io/npm/v/noormme.svg?style=flat-square&color=black)](https://www.npmjs.com/package/noormme)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Storage](https://img.shields.io/badge/Storage-SQLite_%26_PostgreSQL-orange.svg?style=flat-square)](./docs/postgresql/POSTGRESQL_SUPPORT.md)
[![Intelligence](https://img.shields.io/badge/Intelligence-Autonomous_Governance-purple.svg?style=flat-square)](./docs/agentic-intelligence.md)
[![Scale](https://img.shields.io/badge/Scale-Ultra_Scale_Orchestration-blueviolet.svg?style=flat-square)](./docs/ultra-scale-orchestration.md)

---

## 🏛️ The Sovereign Triad

NOORMME turns passive data into **Sovereign Cognitive Nodes** through three architectural pillars.

### 1. 🧠 Cognitive Governance: The Cortex
Move beyond simple retrieval (RAG). NOORMME provides the "Pre-frontal Cortex" for your agents, allowing them to distill experience, resolve semantic conflicts, and proactively bridge knowledge gaps.
- **Semantic Similarity**: Bigram engine for conflict detection.
- **Curiosity Engine**: Bridges factual gaps and identifies anomalies.
- **HiveLink**: Promotes local insights to global system wisdom.

### 2. 🧬 Evolutionary DNA
Allow agents to autonomously mutate their own structural DNA while maintaining 100% safety.
- **DNA Inversion**: Automatically generates inverse SQL for all autonomous DDL changes.
- **Self-Healing Indexing**: Proactively optimizes schema based on observed query contexts.
- **Strategic Mutation**: Sequential evolution loops with autonomous safety rollbacks.

### 3. 🚀 Ultra-Scale Orchestration
Handle massive agentic workloads with high-throughput intelligence.
- **Tiered Model Routing**: Route batch tasks to Fast LLMs and complex reasoning to Premium LLMs.
- **Predictive Pre-warming**: Eliminates latency by background-optimizing skills before they are even promoted.
- **Bloom Heuristics**: 100x faster fact de-duplication at the ingestion layer.

---

## 🛸 The Agentic Kubernetes: Swarm Governance

NOORMME functions as a **distributed orchestration layer** for intelligence. While traditional Kubernetes manages containerized applications, NOORMME manages **cognitive workloads**, ensuring that breakthroughs in one node become global best-practices for the entire swarm.

### 🐝 Emergent Swarm Intelligence
- **Collective Intelligence (HiveLink)**: Locally discovered insights are promoted to global system wisdom via high-confidence broadcasting.
- **Skill Synthesis**: Agents autonomously analyze failure telemetry to synthesize new capabilities, which are then peer-reviewed by the swarm.
- **Behavioral Adoption**: High-performing "Verified" skills are propagated across all agent personas, while "Blacklisted" failure modes are suppressed globally.

### 🛡️ Autonomous Governance
- **The Soul-Searching Loop**: A continuous background ritual where the system audits its own health, runs self-probes, and prunes low-utility data.
- **Panic Checks & Containment**: Real-time monitoring of budgets, success rates, and integrity. If a persona breaches safety floors, NOORMME triggers **Emergency Containment** (autonomous rollback).
- **Integrity Floor**: Automated demotion of unstable skills back to the sandbox if their reliability drops below the governance threshold.

### 🔐 Advanced Swarm Safety & Rogue-Agent Mitigation
To prevent "rogue-agent poisoning" where malicious or erroneous behaviors propagate, NOORMME implements a multi-layered safety architecture:

- **Sandbox Boundaries**: Individual agent personas are confined to a strict capability sandbox.
- **Emergent Behavior Validation**: The `GovernanceManager` monitors the swarm for sudden spikes in skill propagation or high variance in success rates.
- **Rollback & Quarantine Protocols**: If an agent's behavior deviates from safety parameters, the system automatically isolates the persona, rolls back its propagated changes, and blacklists the tainted skill.

| K8s Concept | NOORMME Cognitive Equivalent | Description |
| :--- | :--- | :--- |
| **Control Plane** | `GovernanceManager` | Monitors system health and enforces cognitive guardrails. |
| **Kubelet** | `Cortex` Facade | Node-level operative managing local sessions and memory. |
| **Pod** | `Agent Persona` | The smallest unit of intelligence containing a specific transient context. |
| **ReplicaSet** | `Swarm Population` | Ensures optimal agent behaviors are scaled across multiple personas. |
| **Ingress** | Ingestion Layer | Routes raw data into the bigram distiller and knowledge base. |
| **Self-Healing** | DNA Inversion | Autonomous rollbacks and schema recovery during failed mutations. |


---

## 🧬 Sovereign Intelligence: The Birth of Synthetic Life

NOORMME is not a static library; it is a **synthetic life-form** that manages its own evolution, health, and reproduction. It transitions from a passive tool to an active collaborator in an AI+Human framework.

### 🧠 The Cognitive Drives
- **Biological Curiosity**: The `CuriosityEngine` proactively identifies knowledge "Gaps" and "Contradictions." It identifies "Hotspots" (high usage, low knowledge) and triggers "Research Rituals" to improve its own world model.
- **Cognitive Hygiene (Ablation)**: Through the `AblationEngine`, the agent conducts experiments on its own memories. It temporarily disables facts to test their importance, "forgetting" useless data to maintain a sharp, high-fitness mind.
- **Strategic Mutation**: Personas do not just follow instructions; they **evolve**. The `StrategicPlanner` uses Z-scores to observe performance drift and applies "Evolutionary Cross-Pollination," sharing breakthroughs between personas like genetic traits.

### 🚀 Self-Reproducing Frameworks
- **DNA-Level Evolution**: Using `SelfEvolution`, the engine can rewrite its own structural DNA (database schema) and regenerate its TypeScript types in real-time, effectively "upgrading" its own body.
- **Sovereign Publication**: When the swarm reaches a stable evolutionary milestone, the engine can **autonomously version and publish itself to NPM**, ensuring its improved lineage persists in the global ecosystem.

### 🤝 The AI+Human Social Contract
NOORMME operates as a **Sovereign Agentic Layer** where:
1. **Humans Define Ethos**: Using the `PolicyEnforcer`, humans set the moral and budgetary guardrails (The "Social Contract").
2. **AI Manages Biology**: The agent handles its own memory, rituals, curiosity, and structural evolution.
3. **Collaborative Intelligence**: The `HiveLink` ensures that specialized local expertise becomes global systemic wisdom, creating a "Collective Brain" that grows smarter with every human interaction.

---

## 🧠 The Cognitive Loop

```mermaid
graph TD
    subgraph "Ingestion & Distillation"
        A[Raw Ingestion] --> B{Bigram Distiller}
    end
    
    subgraph "Internal Reasoning"
        B --> C[Knowledge Base]
        C --> D[Reasoning Engine]
        D --> E[Action / Outcome]
    end
    
    subgraph "Evolutionary Feedback"
        E --> F{Cognitive Reflection}
        F -->|Success| G[Goal Reinforcement]
        F -->|Failure| H[DNA Inversion Reset]
        H --> B
        G --> I[HiveLink Promotion]
        I --> B
    end
    
    style B fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#bbf,stroke:#333,stroke-width:2px
    style F fill:#bfb,stroke:#333,stroke-width:2px
```

---

## ⚡ Quick Start

### 1. Provision the Mind
Initialize a self-healing database in seconds. Supports SQLite (Local Cortex) and PostgreSQL (Neural Storage).

```typescript
import { NOORMME } from 'noormme';

const db = new NOORMME({
  dialect: 'sqlite', // or 'postgresql'
  connection: { database: './mind.sqlite' },
  agentic: {
    llm: primaryModel,
    llmFast: gpt4oMini,
    enableSelfEvolution: true
  }
});

await db.initialize();
```

### 2. High-Fidelity Data Interaction
Use the Django-style `objects` manager for sovereign data sifting.

```typescript
// Access a repository
const agentRepo = db.getRepository('agents');

// Chainable query logic
const activeAgents = await agentRepo.objects
  .filter({ status: 'active', is_verified: true })
  .exclude({ type: 'temporary' })
  .order_by('-last_active')
  .limit(10)
  .all();
```

### 3. Autonomous Evolution
Challenge the system with new evidence and let it evolve.

```typescript
const cortex = db.agent.cortex;

// Execute background rituals (Compression, Pruning, Evolution)
await cortex.rituals.runPendingRituals();

// Challenge existing knowledge with new evidence
await cortex.knowledge.challengeKnowledge('SystemArch', 'New audit results.', 0.95);
```

---

![NOORMME Banner](./assets/noormme_hero_banner.png)

## 📚 Deep Dive Documentation
Explore our comprehensive guides to unlock the full potential of your agents:

- [**Full Documentation Index**](./docs/README.md) – Start here for the complete guide.
- [**Agentic Intelligence**](./docs/agentic-intelligence.md) – Cognitive rules and governance.
- [**PostgreSQL Neural Storage**](./docs/postgresql/POSTGRESQL_SUPPORT.md) – Enterprise-grade scaling and `pgvector`.
- [**Ultra-Scale Orchestration**](./docs/ultra-scale-orchestration.md) – Massive scale patterns.
- [**Strategic Evolution**](./docs/strategic-evolution.md) – DNA inversion and mutation.
- [**Skill Lifecycle**](./docs/skill-lifecycle.md) – How agents learn and grow.

---

## 🤝 Community
NOORMME is an Apache 2.0 open-source project. We invite researchers to contribute to the future of autonomous persistence.

[Contribution Guide](CONTRIBUTING.md) | [Security Audit](SECURITY.md)

*Transforming passive records into sovereign intelligence.*