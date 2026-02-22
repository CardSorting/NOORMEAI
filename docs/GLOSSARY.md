# NOORMME Glossary of Terms

This document defines the core concepts and terminology used throughout the NOORMME ecosystem.

## Core Concepts

### Agentic Data Engine
The primary identity of NOORMME. Unlike a traditional ORM which is a passive mapping layer, an **Agentic Data Engine** is an active, self-aware persistence layer that participates in the agent's reasoning loops.

### Apostolic Initialization
The mandatory process of calling `await db.initialize()` before any data interaction. This triggers schema discovery, provision of agentic tables, and dialect-specific performance hardening.

### Sovereign Persistence
The principle that an AI agent should have absolute control over its own data structures, memory, and evolutionary path, without being constrained by static, human-defined schemas.

### DNA Inversion
A safety mechanism for autonomous schema evolution. For every structural change (mutation) an agent proposes, NOORMME automatically generates the inverse operation. If the system detects a performance regression or logic failure, it can "invert" the DNA back to a known stable state.

---

## Storage Layers

### Local Cortex (SQLite)
The edge-optimized storage layer. Ideal for individual agents, local development, and high-performance single-node deployments. Uses WAL mode for high concurrency.

### Neural Storage Layer (PostgreSQL)
The enterprise-grade storage layer. Required for multi-agent synchronization (Hive-Mind), semantic memory (`pgvector`), and high-capacity transactional telemetry.

### DNA (Schema)
The structural representation of the database. NOORMME treats the schema as living code that can be discovered, synthesized into TypeScript types, and mutated at runtime.

---

## Cognitive Architecture

### Cortex
The unified entry point for all agentic operations (`db.agent.cortex`). It coordinates sessions, episodic memory, knowledge distillation, and self-improvement rituals.

### Episodic Memory
Short-term, session-specific logs of interactions. These are "raw" sensory inputs that haven't yet been promoted to global knowledge.

### Factual Knowledge
Verified, long-term wisdom distilled from episodic memories. Knowledge is dialect-agnostic and serves as the agent's "ground truth."

### HiveLink
The protocol used to synchronize intelligence across multiple agent nodes. It allows local breakthroughs to be promoted to the global Neural Storage Layer.

### Rituals
Background maintenance tasks (Compression, Refinement, Evolution) performed by the Cortex to maintain system health and performance.

---

## Intelligence & Governance

### Autonomous Governance
The system's ability to self-monitor and self-heal. Includes performance drift detection, proactive indexing, and automated repair rituals.

### Conflict Resolver
A cognitive sub-module that identifies semantic contradictions within the knowledge base and initiates reasoning loops to reconcile them.

### Curiosity Engine
A proactive discovery module that identifies gaps in the agent's knowledge or logic and drives "exploratory" queries.

### Tiered Routing
The strategy of directing different cognitive tasks to different LLM providers (Fast vs. Premium) based on complexity and cost-efficiency.

### Z-Score Sensitivity
A statistical threshold used by the Governance engine to detect performance "drift." A lower Z-Score makes the system more protective of stability.
