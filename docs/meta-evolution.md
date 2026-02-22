# Meta-Evolution: Tuning the Tuner

**Meta-Meta Evolution** is the most advanced layer of the NOORMME intelligence stack. It allows the system to autonomously adjust its own evolutionary hyperparameters based on systemic success and failure rates.

## The Problem: Hyperparameter Drift
In a dynamic environment, static values for `mutationAggressiveness` or `verificationWindow` are rarely optimal. 
- Too aggressive: The system produces frequently failing "breakthroughs."
- Too conservative: The system stagnates and fails to optimize.

## The Solution: EvolutionaryPilot
The `EvolutionaryPilot` monitors the **Systemic Success Rate** (the ratio of sandbox skills that reach `verified` status).

### 📈 The Positive Reinforcement Loop
If the mutation success rate is **High (>70%)**, the system assumes it has found a "stable innovation ridge." 
- **Increases `mutationAggressiveness`**: Encourages more radical, creative mutations.
- **Increases `maxSandboxSkills`**: Expands the agent's capacity for parallel experimentation.
- **Decreases `verificationWindow`**: Speeds up the promotion of new skills.

### 📉 The Conservative Correction
If the success rate is **Low (<30%)**, the system initiates a "Strategic Retreat."
- **Decreases `mutationAggressiveness`**: Forces the LLM to stay closer to proven stable patterns.
- **Decreases `maxSandboxSkills`**: Focuses resources on a smaller number of high-quality attempts.
- **Increases `verificationWindow`**: Demands more rigorous evidence of stability before promotion.

## Trait Evolution Logic

| Signal | Trait Change | Rationale |
| :--- | :--- | :--- |
| **High Success** | `aggression += 0.1` | Exploit the stable innovation context. |
| **High Success** | `patience -= 2` | Accelerate time-to-value for proven paths. |
| **Low Success** | `aggression -= 0.1` | Reduce risk of destructive mutations. |
| **Low Success** | `patience += 5` | Increase rigor due to systemic instability. |

## Visibility
Meta-evolution events are logged in the `agent_telemetry_events` table with the type `pivot`. You can monitor these shifts to see how your agent's "personality" is changing over time.

```typescript
// Example Telemetry Entry
{
  type: "pivot",
  content: "Increased mutation aggressiveness to 0.7 due to high systemic success (85%)."
}
```
