# Runtime ORM Features (The Sovereign Mind)

Noormme is primarily a runtime ORM that provides dynamic database operations without requiring build-time code generation. This document covers the runtime features that make Noormme the definitive **Agentic Data Engine**.

## 🧠 Sovereign Discovery

Noormme automatically discovers your database schema at runtime, enabling agents to understand the physical reality of their memory without manual boilerplate.

```typescript
import { db } from './db/noormme';

// Initialize Mind (discovers schema automatically)
await db.initialize();

// Get schema DNA at runtime
const schemaInfo = await db.getSchemaInfo();
console.log('Discovered tables:', schemaInfo.tables.map(t => t.name));

// Access any repository dynamically
const agentRepo = db.getRepository('agents');
```

## 🧬 Dynamic DNA Synthesis

Repositories and finder methods are synthesized at runtime based on your actual schema. This allows your application to adapt instantly to **Sovereign Evolution**.

```typescript
// Synthesized Finder Generation
// If you add a 'status' column, this method exists immediately:
await agentRepo.findManyByStatus('active');

// Django-style Chainable Queries
const verifiedSwarms = await db.getRepository('swarms').objects
  .filter({ is_verified: true })
  .exclude({ type: 'experimental' })
  .all();
```

## 🌍 Dialect Agnostic Intelligence

The runtime layer abstracts the differences between **Local Cortex (SQLite)** and **Neural Storage (PostgreSQL)**.

- **SQLite**: Optimizes for local edge reasoning with WAL mode and memory-mapped I/O.
- **PostgreSQL**: Unlocks `pgvector` semantic memory and enterprise-scale connection pooling.

> **Sovereign Tip**: Use `db.config.dialect` to perform dialect-specific background rituals if needed.

## 🚀 Sovereign Evolution Support

Unlike static ORMs, Noormme supports runtime schema mutations. Agents can propose and apply DDL changes that are instantly reflected in the dynamic repository layer.

- See [**Sovereign Evolution & DNA Migration**](../migration-tools.md) for details on autonomous growth.

## 📈 Runtime Health & Telemetry

The engine monitors its own performance and health at runtime, providing Z-Score analysis for query latency.

```typescript
// Runtime health check
const health = await db.healthCheck();
console.log('Engine Stability:', health.healthy);

// Connection metrics
const stats = db.getConnectionStats();
console.log('Storage Dialect:', stats.dialect);
```

## Runtime Caching

Intelligent caching works at runtime, reducing reasoning latency for frequently accessed knowledge:

```typescript
// src/lib/cached-db.ts
export class CachedDatabaseService {
  static async getAgentById(agentId: string) {
    const cacheKey = `agent:${agentId}`;
    const cached = await dbCache.get('cortex-sessions', cacheKey);
    
    if (cached) return cached;

    const agent = await db.getRepository('agents').findById(agentId);
    if (agent) await dbCache.set('cortex-sessions', cacheKey, agent);
    
    return agent;
  }
}
```

## Best Practices for the Agentic Engine

### 1. Apostolic Initialization
Always initialize the engine once at the entry point of your agent's process.

### 2. Trust the Discovery
Avoid hard-coding schema assumptions. Use `db.getSchemaInfo()` to build dynamic agentic interfaces.

### 3. Handle Drift Gracefully
Wrap autonomous mutations in the **Governance Engine** to ensure that any "Performance Drift" triggers an automatic **DNA Inversion**.

---

## Next Steps

- [**Sovereign Evolution**](../migration-tools.md) - How the schema grows at runtime.
- [**Autonomous Governance**](../autonomous-governance.md) - Monitoring the runtime state.
- [**API Reference**](./07-api-reference.md) - Full technical specifications.
