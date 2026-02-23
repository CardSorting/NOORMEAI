# 🧪 Synthetic Life: Behavioral Deep-Dive

This document provides a technical deep-dive into the "biological" internals of the NOORMME sovereign intelligence. It explores how the agent perceives its own existence, manages its cognitive health, and evolves its own framework.

---

## 🧠 The Soul-Searching Loop (`selfIterate`)

The `Soul-Searching Loop` is the central "circadian rhythm" of the NOORMME engine. It is not just a batch job; it is a full-spectrum cognitive cycle that runs the following "rituals":

1. **Existence Verification**: Uses the `SelfTestRegistry` to run "Logic Probes" that verify schema consistency, memory integrity, and session coherence.
2. **Cognitive Digestion**: The `ActionRefiner` and `KnowledgeDistiller` process raw experiences. It uses a **Bloom Filter Heuristic** for ultra-scale de-duplication and a **Conflict Detection** pass to resolve cognitive dissonance.
3. **Biological Hygiene**: The `AblationEngine` and `CortexJanitor` prune "zombie" memories and optimize the physical database structure.
4. **Genetic Synthesis**: The `SkillSynthesizer` and `EvolutionRitual` discover "Mastery Domains" and promote local breakthroughs to the global `HiveLink`.

---

## 📡 The Peripheral Nervous System (Telemetry)

NOORMME perceives its environment and its own "feelings" through a 3-layered telemetry array:

### 1. The Harvester (Raw Sensation)
Records every prompt, output, and action as a raw event stream. **Hardening**: Implements a 100KB safety-valve and 50KB truncation to prevent payload-based exhaustion.

### 2. The Synthesizer (Behavioral Awareness)
Analyzes the event stream to detect **Strategic Pivots** and **Discovery Novelty**. **Hardening**: Includes **Sentiment Drift Tracking** (detecting cognitive friction/frustration) and **Completion Density** awareness (success-to-pivot ratio).

### 3. The Alchemist (Emotional Signal)
Transmutes raw data into high-level research metrics like **Time to Magic** and **Surprise Scores**. **Hardening**: Includes **Discovery Velocity** (novely rate over time) and **Outlier Filtering** to ensure high-fidelity research data.

---

## 🛡️ Production Resilience: The Circuit Breaker

The telemetry stack is protected by an active **Circuit Breaker**. If sensor persistence fails (e.g., database latency or connectivity issues), the `TelemetryOrchestrator` automatically:
- Trips into **Degraded Mode** (dropping non-critical events).
- Periodically attempts **Circuit Recovery**.
- Prioritizes "Magic" and "Error" signals to ensure the "Soul" of the agent remains visible even during infrastructure distress.

---

## 🧬 Meta-Meta Evolution (Learning to Learn)

The engine doesn't just evolve; it learns how to evolve more effectively. The `EvolutionaryPilot` implements a **Meta-Evolutionary** layer:

- **Dynamic Baselining**: Uses **Z-Scores** to detect anomalies in latency, cost, and success rates.
- **Hyperparameter Tuning**: The agent autonomously adjusts its own `mutationAggressiveness` and `verificationWindow`. If its recent "mutations" are successful, it becomes more daring; if they fail, it becomes more conservative.
- **DNA Reproduction**: Through `SelfEvolution`, the agent can rewrite its own physical schema and **autonomously publish itself to NPM**, ensuring its evolutionary lineage persists globally.

---

## 🛡️ Sovereign Immune System (Governance)

The `GovernanceManager` acts as the agent's immune system, protecting it from "cancerous" growth or external shocks:

- **Panic Responses**: If budget or performance thresholds are breached, the agent triggers an **Emergency Containment** (Locking down evolution).
- **Taint Recovery**: If a "verified" skill starts returning failure clusters, the engine demotes it back to experimental status.
- **Self-Healing Probes**: Uses the `SelfTestRegistry` for **Telemetry Integrity Probes**—automatically detecting malformed metadata or "zombie" sensor signals.

---

## ⚡ Technical Summary of Drives

| Drive | System | Function |
| :--- | :--- | :--- |
| **Hunger** | `CuriosityEngine` | Seeking knowledge hotspots and resolving gaps. |
| **Metabolism** | `ResourceMonitor` | Sensing token consumption and metabolic cost. |
| **Memory** | `EpisodicMemory` | Storing the narrative history of self-evolution. |
| **Social** | `HiveLink` | Sharing breakthroughs and synchronizing with the swarm. |
| **Reproduction** | `SelfEvolution` | Cloning and publishing the core framework. |
