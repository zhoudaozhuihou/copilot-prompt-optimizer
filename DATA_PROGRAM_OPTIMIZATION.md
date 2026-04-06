# Data Program Multi-Stack Optimization Architecture

## Overview

This extension now includes a dedicated optimization workflow for data programs that span four core stacks:

- SQL
- Python
- React
- Java

The implementation is centered on a unified optimization pipeline:

1. `ContextManager` captures the active editor context.
2. `OptimizationConfigManager` resolves global and stack-specific settings.
3. `DataProgramOptimizer` detects relevant stacks and generates a structured optimization plan.
4. VS Code commands and chat participant commands render the result as Markdown for immediate review.

## Stack-Specific Design

### 2.1 SQL 栈：查询性能与索引优化闭环
- **Query Planner 级别约束**：强制要求模型基于开销推理（cost-based reasoning）来分析预期的执行计划。明确要求指出：扫描方式 (Seq Scan / Index Scan)、连接策略 (Hash / Merge / Nested Loop) 以及聚合策略 (HashAggregate vs GroupAggregate)。拒绝没有任何执行计划支撑的泛泛建议。
- **优化优先级策略**：建立严格的数据库优化检查顺序：
  1. 尽早过滤以减少扫描数据量 (包含分区裁剪)
  2. 尽早降低关联基数 (Minimize join cardinality)
  3. 在执行 JOIN 之前尽可能先做预聚合 (Pre-aggregate before joins)
  4. 优化 STRING_AGG (在聚合前先去重)
  5. 避免对大表进行重复扫描 (Avoid repeated scans)
- **高级索引策略约束**：要求模型在给出索引建议时，必须综合考虑：覆盖索引 (Covering indexes)、与 WHERE + JOIN 强对齐的复合索引，以及针对特定场景的局部索引 (Partial indexes, 例如 `is_deleted = 0 AND last 30 days`)。
- **数据分布假设注入**：要求模型基于真实世界场景进行数据偏斜（Skew）和热点假设（例如：“80% queries hit recent 30 days” 或 “high cardinality on user_id”），从而生成更精准的索引和执行策略。
- **Agent-Ready 结构化交付**：模型输出被强制格式化为：
  1. Optimized SQL (annotated)
  2. Index DDL (PostgreSQL)
  3. Execution Plan Analysis (before/after)
  4. Estimated cost reduction (%)
  5. Risk analysis (regression / write overhead)
  6. Verification steps (EXPLAIN commands)

### Python

- Vectorization and batch processing recommendations for pandas / NumPy / Polars
- Memory pressure reduction with generators, chunked reads, and object reuse
- Parallel execution guidance for multiprocessing, asyncio, and distributed workers
- Profiling strategy using `cProfile`, `line_profiler`, and `py-spy`

### React

- Large-list rendering optimization through virtualization
- Render stabilization with `useMemo`, `useCallback`, and component partitioning
- State management guidance using query caching or domain-scoped state containers
- Frontend monitoring with Web Vitals and React Profiler

### Java

- Back-end throughput optimization through batching and service-layer aggregation
- Cache strategy recommendations with Caffeine and Redis
- Thread-pool tuning guidance for asynchronous processing
- Runtime monitoring with Micrometer, Prometheus, and JFR

## Unified Configuration Model

Each stack resolves an independent `StackConfig`, enabling safe evolution of tuning knobs without coupling all stacks together.

- SQL: index and execution plan settings
- Python: memory budget and parallel hint settings
- React: state strategy and virtualization threshold
- Java: cache strategy and thread-pool size

## Monitoring and Assessment

The generated report contains:

- Stack detection basis
- Optimization recommendations
- Metrics to observe
- Config hints
- Unified validation checklist

This keeps the solution maintainable and extensible while making it usable as a concrete optimization playbook.
