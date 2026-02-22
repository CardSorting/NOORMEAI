# Goal Cross-Pollination

Goal Cross-Pollination is NOORMME's mechanism for systemic hive-learning. It allows successful breakthroughs discovered by individual agent personas to be propagated as global "best practices."

## How It Works

### 1. Stability Detection
The `RecursiveReasoner` scans the `agent_personas` table for personas that have achieved an "evolution_status" of `stable`. This indicates a persona mutation that has consistently outperformed its baseline.

### 2. Reasoning Distillation
The system extracts the `mutation_reasoning` from the persona's metadata. This represents the "lesson learned" by the AI during its self-improvement cycle.

### 3. Global Injection
If the reasoning is unique, it is "cross-pollinated" into the `agent_goals` table as a **Systemic Best-Practice**. 

```typescript
// Example distilled Goal
{
  description: "Systemic Best-Practice: Use localized context caching for high-frequency search queries.",
  priority: 5,
  metadata: { cross_pollinated: true, source_persona: "pers_alpha_1" }
}
```

## Impact on Multi-Agent Systems
- **Rapid Adaptation**: One agent's discovery of a more efficient workflow immediately informs the strategy of all other agents.
- **Systemic Guardrails**: If a persona discovers a way to avoid certain classes of errors, that knowledge is enforced as a goal for future reasoning cycles across the entire mission.

## Configuration
Cross-pollination happens automatically during the `RecursiveReasoner` audit cycles. You can tune the distillation frequency via the `EvolutionConfig`.
