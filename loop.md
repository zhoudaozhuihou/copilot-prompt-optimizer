# VSCode Copilot Human-in-the-Loop (HITL) Agent 工程实践指南

## 1. 概述

本方案目标：

> 将 VSCode + Copilot 升级为 **Human-in-the-Loop（人类参与闭环）AI 开发系统**

实现：

* 持续迭代开发（Iterative Development）
* 人类反馈驱动优化
* PRD + Code 联动
* Agent 自动收敛

---

## 2. HITL 核心理念

```
User Goal
   ↓
Agent（生成）
   ↓
Human Review（人类审阅）
   ↓
Structured Feedback（结构化反馈）
   ↓
Agent Revision（自动优化）
   ↓
Repeat（直到收敛）
```

---

## 3. 关键原则

### ✅ 必须结构化反馈

❌ 错误：

```
这里不太好，改一下
```

✅ 正确：

```yaml
feedback:
  target: login-form.tsx
  type: UX
  issue: 错误提示不明显
  suggestion: 使用 inline error + 红色边框
  priority: high
```

---

## 4. 项目结构设计

```
project-root/
├── .github/
│   └── copilot-instructions.md
│
├── .feedback/
│   └── current.yaml
│
├── .iterations/
│   ├── v1/
│   ├── v2/
│   └── v3/
│
├── .memory/
│   ├── decisions.json
│   └── context.md
│
├── src/
│   └── ...
```

---

## 5. Copilot HITL 配置

### `.github/copilot-instructions.md`

```
# HITL Mode

When user provides feedback:

1. Parse feedback into structured format
2. Identify affected code
3. Apply minimal diff changes
4. Preserve original structure
5. Output updated code + diff summary

Rules:
- Do NOT rewrite entire file
- Only modify necessary parts
- Always iterate
```

---

## 6. Feedback 系统（核心）

### `.feedback/current.yaml`

```yaml
iteration: 3

feedback:
  - target: user-table.tsx
    type: performance
    issue: 渲染过慢
    suggestion: 使用 memo + virtualization
    priority: high

  - target: api.ts
    type: reliability
    issue: 没有 retry
    suggestion: 增加 exponential backoff
    priority: medium
```

---

## 7. Iteration 版本记录

### `.iterations/v3.md`

```
# Iteration 3

## Changes
- 优化 table 渲染性能
- 增加 API retry

## Feedback Applied
- performance
- reliability

## Notes
- 使用 React.memo
- 引入 retry 机制
```

---

## 8. Agent 架构设计

### 8.1 Generator Agent

职责：

* 生成代码 / PRD

---

### 8.2 Critic Agent（自动审查）

```
你是代码评审专家，请输出：

- issue
- severity
- suggestion
- affected area
```

---

### 8.3 Refiner Agent（修改器）

```
根据 feedback 修改代码：

- 只修改必要部分
- 保持原结构
- 输出 diff
```

---

## 9. Agent 工作流

```
Code
 ↓
Critic Agent（自动发现问题）
 ↓
Human（补充反馈）
 ↓
Refiner Agent（执行修改）
 ↓
New Code
```

---

## 10. VSCode 自动化实现

### 10.1 Apply Feedback Command

```ts
vscode.commands.registerCommand("ai.applyFeedback", async () => {
  const feedback = readFile(".feedback/current.yaml");

  const prompt = `
Apply the following feedback to code:

${feedback}
`;

  // 调用 LLM
});
```

---

### 10.2 Code Review Command

```ts
vscode.commands.registerCommand("ai.review", async () => {
  const code = getCurrentFile();

  const prompt = `
Review this code and output structured issues:
- issue
- severity
- fix suggestion
`;
});
```

---

## 11. PRD + Code 联动（高级能力）

### 工作流

```
Code Change
   ↓
PRD Diff
   ↓
Human Review
   ↓
确认 or 修改
   ↓
同步（Notion / Jira）
```

---

### 示例

```yaml
prd_diff:
  feature: 登录系统
  change: 增加二次验证
  impact:
    - UI
    - API
    - 数据埋点
```

---

## 12. Memory 系统

### `.memory/decisions.json`

```json
{
  "decisions": [
    "使用 React Query",
    "所有 API 必须有 retry"
  ],
  "patterns": [
    "避免 class component"
  ]
}
```

---

### 使用方式

```
@workspace consider memory decisions
```

---

## 13. 最小可运行方案（MVP）

只需实现：

1. `.feedback/current.yaml`
2. Copilot instructions（HITL规则）
3. 一个 VSCode command（apply feedback）
4. 一个 review prompt（critic）

---

## 14. 高级扩展

### 14.1 Diff-aware Editing

* 只改动变更部分

### 14.2 AST 修改（推荐）

* 使用 Babel / TS AST

### 14.3 自动测试生成

* 单元测试
* E2E测试

### 14.4 自动 PR

* Git 集成
* 自动生成 PR 描述

---

## 15. 常见问题

### ❌ 非结构化反馈

→ Agent 无法理解

### ❌ 每次重写代码

→ 必须 diff-based 修改

### ❌ 无 Memory

→ 每轮无学习能力

---

## 16. 系统本质

> **AI Pair Programming System（带人类反馈闭环）**

具备：

* 自迭代能力
* 可收敛能力
* 产品级输出能力

---

## 17. 总结

通过本方案你可以实现：

* Copilot → Agent System
* 单轮生成 → 持续迭代
* 人类参与 → 自动
