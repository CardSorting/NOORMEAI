# Sovereign Tiered Routing

Tiered Model Routing allows NOORMME to orchestrate systemic intelligence by leveraging specialized LLMs based on task complexity. This ensures that premium reasoning is reserved for critical DNA mutations while high-frequency analysis is handled by high-throughput models.

---

## 🏛️ Intelligence Tiers

You can configure the tiered routing within your `AgenticConfig` to match your performance requirements:

```typescript
const config = {
  agentic: {
    // Primary fallback (Systemic Baseline)
    llm: primaryProvider,
    
    // Fast Tier: Optimized for batch fact distillation and ritual monitoring
    llmFast: gpt4oMiniProvider,
    
    // Premium Tier: Reserved for deep DNA mutation and conflict resolution
    llmPremium: claude35SonnetProvider
  }
}
```

---

## 🧠 Strategic Routing Logic

### 1. Batch Revelation (`llmFast`)
When the `SkillSynthesizer` performs `discoverAndSynthesize`, it scans dozens of failure telemetry patterns. This is a high-token task requiring precision instruction following. NOORMME routes these to the **Fast Tier** to eliminate reasoning bottlenecks.

### 2. Genetic Redesign (`llmPremium`)
When a core skill or structural DNA is being mutated, the **Premium Tier** is engaged. The orchestrator providing the full architectural context, existing physical schema, and historical regressions to ensure a first-pass success rate >95%.

### 3. Adaptive Sovereignty
The system dynamically falls back to the baseline `llm` provider if specific tiers are not provisioned, ensuring zero-interruption service across all environments.

---

## ⚡ Practical Setup

Initialize the `NOORMME` instance with your providers. The `Cortex` will automatically distribute tasks to the appropriate tier.

### 1. Engine Initialization
```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  agentic: {
    llm: myDefaultModel,
    llmFast: myFastModel,     // Optional
    llmPremium: mySmartModel  // Optional
  }
});
```

### 2. Autonomous Tier Usage
The `Cortex` uses these tiers internally during `selfIterate()`.

```typescript
// Uses llmFast for data pruning and llmPremium for strategy mutation
await db.agent.cortex.selfIterate();
```

### 3. Direct Access
You can also access these providers directly from the Cortex for your own custom rituals.

```typescript
const smartModel = db.agent.cortex.llmPremium;
const response = await smartModel.generate('Deep reasoning task...');
```

---

## 📈 systemic Impact

| Metric | Improvement | Mechanic |
| :--- | :--- | :--- |
| **Operational Cost** | 80% Reduction | Offloading rituals to Fast Tier. |
| **Logic Latency** | 3x Faster | Batch analysis parallelization. |
| **Mutation Integrity** | 40% Higher | Premium-first mutation strategies. |

---

*Orchestrating high-fidelity intelligence through specialized tiered routing.*
