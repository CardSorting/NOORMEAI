# Predictive Pre-warming rituals

Predictive Pre-warming is an autonomous "Just-In-Time" optimization strategy that perfects agentic skills before they are officially promoted to the core mind.

---

## 🧬 Solving the Verification Gap

In legacy systems, a skill moves instantly from `experimental` to `verified`. NOORMME introduces a **Pre-warming Phase** to ensure the transition from unpolished experimental logic to high-fidelity production code is seamless.

### The Pre-warm Ritual

1.  **Threshold Monitoring**: The `GovernanceManager` monitors skills nearing their `minSampleSize` (e.g., 90% of the way to verification).
2.  **Predictive Trigger**: When a skill reaches **80% of its verification window** with a dominant success rate, the `preWarmSkill` ritual is autonomously triggered.
3.  **Refinement Synthesis**: While the skill finishes its final verification tests, the **Premium Tier LLM** synthesizes its "Final DNA"—optimizing documentation, refining internal comments, and hardening the logic for production-grade throughput.
4.  **Instant Promotion**: Once the 100% threshold is hit, the skill is "born" into the verified state with zero cold-start latency.

---

## 🔄 Lifecycle Hierarchy

| Status | Phase | Sovereign Activity |
| :--- | :--- | :--- |
| **Sandbox** | 0-25% | Initial mutation and structural hardening. |
| **Experimental** | 25-80% | Reliability tracking and telemetry extraction. |
| **Pre-warming** | **80-100%** | **Proactive background refinement.** |
| **Verified** | 100%+ | Production execution with peak-optimized DNA. |

---

## ⚡ Practical Self-Verification

You can monitor the status of warming skills via the `capabilities` sub-module.

### 1. Retrieving Pre-warm Status
View which skills are currently being background-hardened.

```typescript
const skills = await db.agent.cortex.capabilities.getPreWarmedSkills();

skills.forEach(skill => {
  console.log(`[Warming] ${skill.name}`);
  console.log(`- Progress: ${skill.verificationProgress * 100}%`);
  console.log(`- Predicted DNA Integrity: ${skill.predictedReliability * 100}%`);
});
```

### 2. Manual Pre-warm Trigger
Force the background refinement of a skill regardless of its current sample size.

```typescript
await db.agent.cortex.capabilities.triggerPreWarm(skillId);
```

---

## 📊 Telemetry Signatures

You can detect a pre-warmed skill via its high-fidelity metadata signature:

```json
{
  "totalInvocations": 20,
  "winRate": 0.98,
  "pre_warmed": true,
  "dna_integrity_score": 0.99
}
```

> [!TIP]
> Pre-warming significantly reduces the "Verification Jitter" that occurs when an agent switches between experimental and stable reasoning paths.

---

*Eliminating cold-start latency through predictive cognitive refinement.*
