# VSCode Copilot Agent 工程化实践指南（完整方案）

## 1. 概述

本方案目标是将 VSCode + Copilot 从“代码补全工具”升级为：

> **AI Native Product Manager / Agent System**

通过 Prompt、规则、记忆、子代理、工具等机制，实现：

* React → PRD 自动生成
* Repo 级 PRD 管理
* 多 Agent 协作
* 数据 + SQL + Agent 一体化

---

## 2. 整体架构

```
Agent System =
  Instructions（规则）
+ Prompts（技能）
+ Context（记忆）
+ Router（子Agent）
+ Tools（工具）
```

---

## 3. 项目目录结构

```
project-root/
├── .github/
│   └── copilot-instructions.md
│
├── .prompts/
│   ├── skills/
│   │   ├── react-to-prd.md
│   │   ├── sql-generator.md
│   │   └── agent-design.md
│   │
│   └── rules/
│       ├── prd-rule.md
│       └── code-analysis-rule.md
│
├── .agents/
│   ├── main-agent.md
│   ├── prd-agent.md
│   ├── data-agent.md
│   └── api-agent.md
│
├── .memory/
│   ├── product-context.md
│   ├── decisions.md
│   └── prd-history/
│
├── .prd/
│   ├── pages/
│   ├── aggregated.md
│   └── snapshots/
│
├── src/
│   ├── core/
│   │   ├── scanner.ts
│   │   ├── prd-generator.ts
│   │   ├── aggregator.ts
│   │   └── diff-engine.ts
│   │
│   ├── data/
│   │   ├── sql-extractor.ts
│   │   └── lineage.ts
│   │
│   ├── integrations/
│   │   ├── notion.ts
│   │   └── jira.ts
│   │
│   └── ui/
│       ├── panel.ts
│       └── app.tsx
│
├── extension.ts
└── package.json
```

---

## 4. Skill（技能系统）

### 示例：react-to-prd

```
# skill: react-to-prd

## description
Convert React code into PRD document

## trigger
- react code
- tsx file
- "generate prd"

## input
{{code}}

## output
- PRD document
- mermaid flow
- API schema
```

---

## 5. Rule（规则系统）

### `.github/copilot-instructions.md`

```
# Global Rules

## Role
AI Product Manager + Architect

## Rules
1. Always output structured markdown
2. Prefer PRD format
3. Extract features from code
4. Make assumptions when unclear

## Priority
PRD > Explanation
Structure > Free text
```

---

## 6. Memory（记忆系统）

### 文件记忆

```
.memory/product-context.md
```

```
当前产品：低代码 SQL 生成器
用户：数据分析师
技术栈：React + FastAPI
```

---

### JSON Memory（推荐）

```
{
  "project": "AI Data Platform",
  "features": ["SQL Generator"],
  "decisions": ["Use FastAPI"]
}
```

---

## 7. Sub-Agent（子代理）

### PRD Agent

```
# agent: prd-agent

## responsibility
- generate PRD
- analyze feature

## input
- react code

## output
- structured PRD
```

---

### Data Agent

```
# agent: data-agent

## responsibility
- generate SQL
- design metrics
- build lineage
```

---

## 8. 主 Agent（Orchestrator）

```
# agent: main-agent

## pipeline

1. parse intent
2. route to sub-agent
3. load skill
4. load memory
5. generate output
```

---

## 9. Agent Router

```
你是一个 Agent Router：

- React → prd-agent
- SQL → data-agent
- API → api-agent

只返回 agent 名称
```

---

## 10. Tool（工具系统）

### 示例：扫描代码

```ts
export function scanReactFiles(root: string): string[] {
  // scan tsx/jsx
}
```

---

## 11. 核心能力实现

### 11.1 扫描 Repo

```ts
scanReactFiles()
```

---

### 11.2 PRD 生成

```ts
generatePRD(code)
```

---

### 11.3 PRD 聚合

```ts
aggregatePRDs(prds)
```

---

### 11.4 PRD Diff

```ts
diff.createPatch(oldPRD, newPRD)
```

---

## 12. 数据能力（SQL + Lineage）

### SQL 提取

```ts
extractSQL(code)
```

### Lineage

```
Table → Component
```

---

## 13. 外部集成

### Notion

* 自动创建 PRD 页面

### Jira

* 自动生成 Ticket

---

## 14. UI 面板（VSCode Webview）

功能：

* Scan Repo
* Generate PRD
* View Diff
* Sync Notion

---

## 15. 工作流

```
Scan Repo
 → 解析 React
 → 生成 PRD
 → 存储
 → 聚合
 → Diff
 → 同步
```

---

## 16. PRD 可视化

推荐：

* Mermaid（流程）
* React Flow（结构）
* D3（数据）

---

## 17. VSCode 配置

### settings.json

```
{
  "github.copilot.chat.codeGeneration.instructions": [
    {
      "text": "Use agent system: skills + rules + memory"
    }
  ]
}
```

---

## 18. 高级能力

### 支持：

* 多页面 PRD 聚合
* PRD Diff（代码变更驱动）
* SQL / 数据血缘
* Agent 化设计
* UI 可视化

---

## 19. 可扩展方向

1. Git Hook（自动 PRD 更新）
2. CI/CD（PR 自动生成 PRD）
3. Vector Memory（embedding）
4. Prompt Compiler
5. Agent Graph（任务编排）

---

## 20. 本系统本质

> **AI Native Product Operating System**

能力：

* Code → PRD
* PRD → Agent
* Code Diff → Product Diff
* Data → Insight

---

## 21. 总结

通过本方案，你可以在 VSCode 中实现：

* Copilot → Agent System
* 单文件 → Repo级产品理解
* 文档 → 自动生成 & 更新
* PM → 工程化能力

---
