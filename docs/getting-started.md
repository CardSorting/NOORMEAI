# Getting Started with NOORMME (The Agentic Data Engine)

Welcome to the future of high-fidelity persistence. NOORMME is designed to be the backbone of your autonomous agent's memory, reasoning loops, and strategic operations.

## 🚀 Apostolic Initialization

Initialize **The Agentic Data Engine** in your project in minutes.

### Installation
```bash
# Core package
npm install noormme

# Technical moats (Recommended for high-end deployments)
npm install -D typescript @types/node tsx
```

---

## 🏛️ Provisioning the Mind

When you call `db.initialize()`, NOORMME orchestrates a sophisticated structural setup:

1.  **Sovereign Provisioning**: Automatically creates **20+ core agentic tables** (Memories, Sessions, Goals, Knowledge, Logic Probes, and Telemetry).
2.  **Autonomous Discovery**: Scans and maps your existing application schema without manual boilerplate or static models.
3.  **DNA Synthesis**: Generates real-time TypeScript definitions matching your database state.
4.  **Performance Hardening**: Automatically enables WAL mode, optimizes cache sizes, and registers performance drift probes.

---

## 📝 Basic Setup

Create a database configuration file. You can use either SQLite (Local Cortex) or PostgreSQL (Enterprise Neural Storage).

### 1. Database Configuration

#### SQLite Configuration (Local Cortex)
```typescript
// lib/db.ts
import { NOORMME } from 'noormme';

const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/agent_mind.db'
  },
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true
  },
  agentic: {
    enableSelfEvolution: true // Enable sovereign schema growth
  }
});
```

#### PostgreSQL Configuration (Neural Storage)
```typescript
// lib/db.ts
import { NOORMME } from 'noormme';

const db = new NOORMME({
  dialect: 'postgresql',
  connection: {
    host: 'localhost',
    database: 'myapp',
    username: 'postgres',
    password: 'password',
    pool: { max: 20 }
  }
});

// Or using a connection string
// const db = new NOORMME('postgresql://postgres:password@localhost:5432/myapp');
```

### 2. Database Initialization

```typescript
async function main() {
  // Initialize the Mind & Discover Schema
  try {
    await db.initialize();
    console.log('✅ Agentic Engine: Online');
    
    // Access a Sovereign Repository
    const userRepo = db.getRepository('users');
    
    // High-fidelity data interaction
    const users = await userRepo.findAll();
    console.log('Discovered Users:', users);
  } catch (error) {
    console.error('❌ Failed to initialize engine:', error);
  }
}

main();
```

---

## 🧬 Understanding Autonomous Repositories

NOORMME repositories are not static wrappers; they are dynamically generated, high-fidelity neural portals to your data that grow with your agent.

- **Dynamic Finder Generation**: `userRepo.findByEmail('...')` and `findManyByStatus('...')` are synthesized at runtime based on your schema DNA.
- **The `objects` Manager**: Use the Django-style chaining API for complex sifting:
  ```typescript
  const activeAgents = await db.getRepository('agents').objects
    .filter({ status: 'active', is_verified: true })
    .order_by('-last_active')
    .all();
  ```
- **Relational Intelligence**: Use `findWithRelations(id, ['posts'])` to load deep context with optimized batching.

> [!TIP]
> Use `.paginate()` for high-throughput fact streams to maintain memory safety and systemic performance.

---

## 🚥 Navigation Paths

Continue your journey into the sovereign persistence layer:

- **[Installation Details](./getting-started/installation.md)** – Deep dive into environment setup.
- **[Autonomous Governance](./autonomous-governance.md)** – Monitoring performance drift and rituals.
- **[Strategic Evolution](./strategic-evolution.md)** – Sequential DNA mutation and rollbacks.
- **[PostgreSQL Mastery](./postgresql/POSTGRESQL_SUPPORT.md)** – Neural storage with `pgvector`.

---

*Transforming passive records into sovereign intelligence.*
