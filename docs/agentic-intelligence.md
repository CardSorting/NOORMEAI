# Agentic Intelligence & Cognitive Governance

NOORMME v1.1 introduces a revolutionary **Agentic Intelligence** layer, designed specifically to support autonomous AI agents in managing long-term memories, resolving logical conflicts, and maintaining factual integrity.

## 🧠 The Cortex Facade

The `Cortex` is the unified entrance to all agentic capabilities. It orchestrates:
- **Memory Management**: Vector-indexed long-term storage.
- **Session Tracking**: Context-aware conversation history.
- **Cognitive Rules**: High-level governance that dictates how the agent interacts with data.

## 🔍 Semantic Similarity Utility

Unlike traditional ORMs that rely on exact string matching, NOORMME uses a robust **Bigram Similarity** engine (`src/util/similarity.ts`). This allows the agent to:
- Detect overlapping constraints even if they use different wording.
- Identify potential factual contradictions in a knowledge base.
- Cluster similar lessons or observations across multi-session interactions.

### Example: Semantic Comparison
```typescript
import { calculateSimilarity } from 'noormme/util'

const s1 = "User prefers dark mode in the dashboard"
const s2 = "The dashboard should use a dark theme for this user"

const similarity = calculateSimilarity(s1, s2)
// returns > 0.8 (Highly Similar)
```

## ⚔️ Conflict Resolution

The `ConflictResolver` scans your **Cognitive Rules** for semantic overlaps. If two rules govern the same table with similar conditions, the resolver flags them for audit.

- **Trigger**: Automatic on schema discovery or rule update.
- **Threshold**: Similarity > 0.6 flags a potential overlap.

## 🕵️ Curiosity Engine

The `CuriosityEngine` is responsible for **Autonomous Revelation**. It identifies:
1.  **Factual Gaps**: Missing information required by a rule.
2.  **Contradictions**: Entities with competing facts (e.g., "User is active" vs "User is suspended").
3.  **Anomalies**: Unexpected patterns in metrics or metadata.

## 🚥 Self-Test Registry & Governance

The `SelfTestRegistry` allows agents to register **Logic Probes** that verify system integrity after autonomous changes.

### Key Probes:
- **`check_schema_consistency`**: Verifies that the physical database matches the agent's mental model.
- **`check_performance_drift`**: Monitors query latency. If execution time increases by > 50% compared to historical baselines, a repair ritual is triggered.
- **`check_memory_integrity`**: Ensures all vector embeddings are valid and searchable.

## 🏛️ Collective Intelligence (HiveLink)

The `HiveLink` facilitates the promotion of local, session-specific facts to a global, session-agnostic **Hive Mind**.
- **Knowledge Promotion**: High-confidence interactions are "promoted" to global status, allowing different agent personas to share the same fundamental wisdom.
- **Domain Mastery**: Agents can "sync" entire domains (e.g., "security", "database_ops") to boost the confidence of all related knowledge items.

## 🧪 Ablation & Pruning

The `AblationEngine` keeps the agent's world model lean and efficient.
- **Zombie Pruning**: Automatically identifies and removes items that have not been retrieved or updated within a 30-day window.
- **Ablation Testing**: Temporarily reduces the confidence of a fact to zero to evaluate its impact on the agent's reasoning capabilities before permanent deletion.

## 🧬 Self-Evolution & DNA Inversion

NOORMME allows for safe, structural experimentation through the `SelfEvolution` module.
- **DNA Inversion**: A sophisticated logic that can automatically generate the "Inverse SQL" of a DDL change (e.g., inverting `CREATE INDEX` to `DROP INDEX`), enabling structural rollbacks.
- **Sequential Directed Mutation**: The agent's persona (roles, policies) evolves through a verified sequential loop with autonomous safety rollbacks. For a deep dive, see the **[Strategic Evolution Guide](./strategic-evolution.md)**.
- **Proactive Optimization**: Suggests and applies performance indexes based on the agent's own observation of "slow" query contexts.

## 📊 Deep Telemetry & Behavioral Analysis

NOORMME introduces a 3-layer deep telemetry system for research-grade agent monitoring:

1. **Raw Event Stream**: Captures full context of every prompt, output, and tool interaction.
2. **Behavioral Summaries**: Infers high-level goals and maintains a serialized **Evolution Path** of strategic shifts.
3. **Research Metrics**: Transmutes interaction data into actionable signals like **Autonomy Gradient**, **Discovery Index**, and **Time-to-Magic**.

By tracking the evolution of an agent's strategy through transactional persistence, NOORMME provides the perfect dataset for understanding human-agent co-evolution.
