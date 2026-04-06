# Data Program Configuration Guide

## Configuration Entry

All settings are exposed under `copilotPromptOptimizer`.

## Global Settings

```json
{
  "copilotPromptOptimizer.dataProgram.monitoringEnabled": true,
  "copilotPromptOptimizer.dataProgram.defaultStacks": [
    "sql",
    "python",
    "react",
    "java"
  ]
}
```

## SQL Settings

```json
{
  "copilotPromptOptimizer.sql.maxIndexSuggestions": 3,
  "copilotPromptOptimizer.sql.analyzeExecutionPlan": true
}
```

Recommended usage:

- Increase `maxIndexSuggestions` for exploratory tuning sessions
- Keep `analyzeExecutionPlan` enabled in most environments

## Python Settings

```json
{
  "copilotPromptOptimizer.python.memoryBudgetMb": 1024,
  "copilotPromptOptimizer.python.enableParallelHints": true
}
```

Recommended usage:

- Lower `memoryBudgetMb` for notebook or constrained container environments
- Disable `enableParallelHints` when execution must remain single-process

## React Settings

```json
{
  "copilotPromptOptimizer.react.stateStrategy": "query-cache",
  "copilotPromptOptimizer.react.virtualizationThreshold": 200
}
```

Recommended usage:

- Use `query-cache` for server-state heavy dashboards
- Use `redux-toolkit` when workflow state spans many views
- Lower virtualization threshold for slower client devices

## Java Settings

```json
{
  "copilotPromptOptimizer.java.threadPoolSize": 16,
  "copilotPromptOptimizer.java.cacheStrategy": "caffeine+redis"
}
```

Recommended usage:

- Tune `threadPoolSize` according to CPU cores and blocking ratio
- Prefer `caffeine+redis` when you need both local speed and cross-node consistency

## Execution Modes

You can invoke the feature in two ways:

- Command Palette: `Copilot Optimizer: Analyze Data Program`
- Copilot Chat: `@optimizer /data-program ...`
