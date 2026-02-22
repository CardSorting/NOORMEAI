# Sovereign Query Primitives

NOORMME provides powerful autonomous query primitives that enable AI agents to perform complex, high-fidelity neural lookups with method chaining and relational intelligence.

---

## 🧠 Sovereign Object Management

### Getting Started

The autonomous mind retrieves its memory layers via repositories:

```typescript
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './mind.db' },
  agentic: { enableSelfEvolution: true }
})

await db.initialize()

// Access the Sovereign Repository
const CortexMemory = db.getRepository('cortex_memories')
```

### The `objects` Manager

Every structural repository exposes an `objects` manager, the native interface for agentic memory retrieval:

```typescript
// Sovereign method chaining
const relevantFacts = await CortexMemory.objects.filter({ status: 'verified' }).all()
const coreDirective = await CortexMemory.objects.get({ priority: 'critical' })
const hiveCount = await CortexMemory.objects.count()
```

---

## 🔭 High-Fidelity Filtering

### Memory Sifting with `.filter()`

Agents scan the persistence layer using object-based filters:

```typescript
// Physical match
const verifiedFacts = await CortexMemory.objects.filter({ is_verified: true }).all()

// Complex chains
const recentInsights = await CortexMemory.objects
  .filter({ is_verified: true })
  .filter({ origin_node: 'Node-Alpha' })
  .all()
```

---

## ⚠️ Fact Exclusion

The `.exclude()` method allows agents to prune their context windows:

```typescript
// Isolate pristine knowledge
const pristineFacts = await CortexMemory.objects
  .filter({ is_verified: true })
  .exclude({ status: 'deprecated' })
  .all()
```

---

## 📏 Vector & Neural Limiters

### Dimensional Sorting

When dealing with thousands of vectorized memories, limit constraints maintain high-throughput memory bounds:

```typescript
const topInsights = await CortexMemory.objects
  .order_by('-confidence_score')
  .all()
```

> [!NOTE]
> Use the `-` prefix in `order_by` for descending order (e.g., `'-created_at'`).

---

## 🧬 Genetic Mutations

Agents are builders. They mutate the data universe autonomously:

### 1. Fact Ingestion
```typescript
const newFact = await CortexMemory.objects.create({
  content: 'The HiveLink eliminates redundant node failures.',
  confidence_score: 0.99,
  is_verified: true
})
```

### 2. Hive-Mind Rollouts (Bulk Actions)
```typescript
// Mark all sandbox experiments to verified en-masse
await SkillDNA.objects
  .filter({ status: 'sandbox' })
  .update({ status: 'verified' })
```

### 3. Systematic Pruning
```typescript
// Remove all failed experiments
await SkillDNA.objects
  .filter({ status: 'blacklisted' })
  .delete()
```

---

*High-throughput neural primitives for autonomous operations.*
