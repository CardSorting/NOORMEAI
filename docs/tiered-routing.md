# Tiered Model Routing

Tiered Model Routing allows NOORMME to leverage the strengths of different LLM providers based on the complexity and volume of the task. This ensures that premium reasoning is reserved for critical mutations while high-volume analysis is handled by cost-effective models.

## Configuration

You can configure the tiered providers in your `AgenticConfig`:

```typescript
const config = {
  agentic: {
    // Primary default fall-back
    llm: primaryProvider,
    
    // Fast model for batch processing and failure clustering
    llmFast: gpt4oMiniProvider,
    
    // Premium model for complex skill mutations and reasoning
    llmPremium: claude35SonnetProvider
  }
}
```

## How It Works

### 1. Batch Discovery (`llmFast`)
When the `SkillSynthesizer` performs `discoverAndSynthesize`, it often scans dozens of failure patterns. This is a high-token task that requires instruction following but not deep creative reasoning. NOORMME routes these to the **Fast Tier**.

### 2. High-Quality Mutation (`llmPremium`)
When a specific tool is being redesigned, the **Premium Tier** is engaged. The system provides the full failure context, existing code, and evolutionary constraints to the high-reasoning model.

### 3. Adaptive Fallback
If `llmFast` or `llmPremium` are not explicitly defined, the system automatically falls back to the base `llm` provider, ensuring seamless operation across different configuration levels.

## Performance Impact
- **Cost reduction**: Up to 80% on high-frequency evolution tasks.
- **Latency**: Batch analysis speed increased by ~3x.
- **Reliability**: Higher-quality mutations from premium models lead to faster skill verification.
