# Copilot Prompt Optimizer - 技术文档 (Technical Document)

## 1. 架构概述

Copilot Prompt Optimizer 旨在为 VS Code Copilot Chat 提供智能提示词优化功能。本扩展的架构设计深度借鉴了 `claude-code-source-code` 项目的底层实现理念，特别是其**上下文压缩 (Context Compaction)**、**系统提示词模块化 (System Prompt Architecture)** 和 **Agent意图隔离** 等机制。

扩展主要包含以下核心模块：
1. **Context Manager (上下文管理模块)**
2. **Prompt Optimizer (提示词优化核心引擎)**
3. **History Manager (历史记录与评估管理)**
4. **Webview Provider (UI/UX 交互层)**

## 2. 核心模块详解

### 2.1 Context Manager (`src/contextManager.ts`)
负责获取当前开发环境的代码上下文。
- **机制**: 采用类似于上下文压缩技术的策略，如果用户没有显式选中代码，工具会自动截取光标前后各 25 行的代码（共 50 行）作为 `surroundingCode`。这避免了将整个巨型文件传递给模型导致 `Prompt Too Long` 错误，有效控制了 Token 预算。
- **采集信息**: `languageId`, `fileName`, `selectionText`, `surroundingCode`。

### 2.2 Prompt Optimizer (`src/optimizer.ts`)
核心推理引擎，通过 VS Code 官方的 Language Model API (`vscode.lm.selectChatModels`) 直接调用 Copilot 的底层大模型。
- **System Prompt 架构**: 采用高度模块化的提示词设计。
  - **角色定义**: 定义为 "Expert AI Prompt Optimizer acting inside VS Code"。
  - **规则约束**: 强制要求输出严格的 JSON 格式，便于程序解析。要求进行意图识别、上下文注入和模块化（Context, Task, Constraints）。
- **多版本生成**: 借鉴了多 Agent 协同思想中的“多重验证”，模型一次性输出 `Balanced`、`Concise` 和 `Detailed` 三个版本的提示词，供开发者对比选择。

### 2.3 Webview Provider (`src/webview.ts`)
提供富文本 UI，展示优化结果。
- **动态渲染**: 将 Optimizer 返回的 JSON 数据（包含意图分析、修改建议、多版本提示词）渲染为 HTML。
- **API 通信**: 通过 `acquireVsCodeApi()` 与 VS Code 主进程通信，实现“复制到剪贴板”以及“直接发送到 Copilot Chat” (`workbench.action.chat.open`) 的功能。

### 2.4 History Manager (`src/historyManager.ts`)
基于 VS Code 的 `globalState` 存储优化历史。
- **存储结构**: 记录时间戳、原始 Prompt、优化后 Prompt、意图和当时的上下文。
- **空间控制**: 采用 LRU (Least Recently Used) 类似策略，最大保留 50 条记录。

## 3. API 集成机制

本项目深度集成了 VS Code 1.90 引入的 `LanguageModel` API：
```typescript
const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
const response = await models[0].sendRequest(messages, {}, token);
```
**优势**：无需开发者自备 API Key，直接复用用户已授权的 GitHub Copilot 额度，安全且合规。

## 4. 测试与构建

- **构建命令**: `npm run compile` (使用 tsc 编译)
- **测试命令**: `npm run test` (使用 Mocha 和 vscode-test 框架进行集成测试)
- 单元测试涵盖了核心模块的健壮性（例如无 Editor 时的上下文提取，以及 Copilot 模型未授权时的优雅降级）。

## 5. 最佳实践总结

- **意图前置**: 在优化过程中，始终把“意图识别”放在第一位，确保优化方向不偏离用户本意。
- **约束明确**: 优化后的提示词普遍增加了对输出格式、安全边界和代码风格的显式约束。
- **性能优化**: 对代码块的智能截取，保证了 LLM 响应速度和 Token 成本控制。
