# Predictive Pre-warming

Predictive Pre-warming is a "Just-In-Time" optimization strategy that prepares skills for permanence before they are officially promoted.

## The Verification Gap
Normally, a skill moves from `experimental` to `verified` once a performance threshold is met. However, the first few invocations of a newly verified skill often use the "experimental" description, which might be slightly unpolished.

## The Pre-warm Ritual

1. **Threshold Monitoring**: `CapabilityManager` monitors skills nearing their `minSampleSize`.
2. **Predictive Trigger**: When a skill reaches **80% of its sample size** with a >80% win rate (or a 4-success streak), the `preWarmSkill` ritual begins.
3. **Background Optimization**: While the skill is still finishing its experimental phase, the **Premium LLM** is tasked with generating its "final form" description based on the aggregate failure patterns it has successfully navigated.
4. **Instant Promotion**: When the 100% threshold is reached, the skill is promoted with a perfected description already in place.

## Lifecycle Diagram

| Status | Phase | Activity |
| :--- | :--- | :--- |
| `Sandbox` | 0-25% | Initial mutation and hardening. |
| `Experimental` | 25-80% | Reliability tracking and edge-case discovery. |
| **Experimental (Pre-warming)** | **80-100%** | **Background AI optimization for final verification.** |
| `Verified` | 100%+ | Production use with peak-optimized description. |

## Metadata Tracking
You can check if a skill has been pre-warmed by inspecting its metadata:
```json
{
  "totalCount": 18,
  "winRate": 0.95,
  "pre_warmed": true,
  "pre_warmed_at": "2026-02-21T23:00:00Z"
}
```
