import * as vscode from 'vscode';
import { CodeContext } from './contextManager';

const SUPPORTED_COPILOT_FAMILIES = [
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'claude-3.5-sonnet',
] as const;

export interface OptimizationResult {
    optimizedPrompt: string;
    intent: string;
    suggestions: string[];
    versions: { label: string, prompt: string }[];
    modelInfo: string;
    templateName: string;
    appliedStrategies: string[];
}

type PromptTemplateName =
    | 'general'
    | 'architecture-diagram'
    | 'sql-assistant-architecture'
    | 'sql-optimization';

type PromptAnalysis = {
    intent: string;
    templateName: PromptTemplateName;
    role: string;
    objective: string;
    scope: string[];
    requiredContent: string[];
    constraints: string[];
    outputFormat: string[];
    qualityBar: string[];
    avoid: string[];
    appliedStrategies: string[];
};

export class PromptOptimizer {
    public async optimize(
        rawPrompt: string, 
        context: CodeContext | undefined, 
        providedModel: vscode.LanguageModelChat | undefined,
        token: vscode.CancellationToken
    ): Promise<OptimizationResult> {
        try {
            const candidateModels = await this.getCandidateModels(providedModel);
            const messages = this.buildMessages(rawPrompt, context);

            let lastError: unknown;
            for (const model of candidateModels) {
                try {
                    const result = await this.sendOptimizationRequest(model, messages, token);
                    return {
                        ...result,
                        modelInfo: `Copilot model: ${model.name} (${model.family})`,
                    };
                } catch (e: unknown) {
                    lastError = e;
                }
            }

            if (lastError) {
                return this.buildHeuristicFallback(rawPrompt, context, lastError);
            }
            return this.buildHeuristicFallback(rawPrompt, context);
        } catch (error: unknown) {
            return this.buildHeuristicFallback(rawPrompt, context, error);
        }
    }

    private async getCandidateModels(
        providedModel: vscode.LanguageModelChat | undefined,
    ): Promise<vscode.LanguageModelChat[]> {
        const candidates: vscode.LanguageModelChat[] = [];
        const seen = new Set<string>();

        const addModel = (model: vscode.LanguageModelChat | undefined) => {
            if (!model || seen.has(model.id)) {
                return;
            }
            seen.add(model.id);
            candidates.push(model);
        };

        // If the user explicitly selected a model in the UI, we should strictly 
        // respect their choice and not silently fall back to gpt-4o.
        if (providedModel) {
            addModel(providedModel);
            
            // Also try to get fresh instances of the same model family from the LM API
            // (Sometimes the chat-provided instance has strict context limits or restrictions)
            try {
                const sameFamilyModels = await vscode.lm.selectChatModels({
                    vendor: providedModel.vendor,
                    family: providedModel.family
                });
                sameFamilyModels.forEach(addModel);
            } catch {
                // ignore
            }
            
            return candidates;
        }

        // If no model was provided (e.g. called from command palette instead of chat),
        // then we fallback to our preferred list.
        try {
            for (const family of SUPPORTED_COPILOT_FAMILIES) {
                const models = await vscode.lm.selectChatModels({
                    vendor: 'copilot',
                    family,
                });
                models.forEach(addModel);
            }

            const genericModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            genericModels
                .filter(model =>
                    model.family !== 'embeddings' &&
                    SUPPORTED_COPILOT_FAMILIES.includes(
                        model.family as (typeof SUPPORTED_COPILOT_FAMILIES)[number],
                    ),
                )
                .forEach(addModel);
        } catch {
            // Ignore model discovery errors
        }

        return candidates;
    }

    private buildMessages(
        rawPrompt: string,
        context: CodeContext | undefined,
    ): vscode.LanguageModelChatMessage[] {
        const analysis = this.analyzePrompt(rawPrompt, context);
        // Keep the guidance in-band because the public VS Code LM API doesn't
        // expose a dedicated system-role helper.
        const systemPrompt = `You are an expert AI Prompt Optimizer acting inside VS Code.
Your job is to transform weak prompts into high-precision prompts using a modular structure inspired by agentic coding systems.

Optimization rules:
1. Convert vague requests into explicit sections such as Role, Context, Objective, Scope, Constraints, Output Format, Quality Bar, and Do Not.
2. Prefer directive-style prompts over generic prompts.
3. Make output boundaries explicit so the downstream coding model knows what to include and what to avoid.
4. Preserve user intent while adding technical constraints, acceptance criteria, and context.
5. When the request is about architecture diagrams, explicitly constrain the diagram type, hierarchy depth, component boundaries, and deliverables.

Return ONLY valid JSON using this exact shape:
{
  "intent": "Short recognized intent",
  "templateName": "Applied template name",
  "appliedStrategies": ["strategy 1", "strategy 2"],
  "optimizedPrompt": "Primary optimized prompt",
  "suggestions": ["3-5 concrete suggestions"],
  "versions": [
    { "label": "Concise", "prompt": "Short version" },
    { "label": "Detailed", "prompt": "Detailed version" }
  ]
}`;

        let userMessage = `Raw Prompt: "${rawPrompt}"\n\n`;
        userMessage += `Structured Analysis Draft:\n`;
        userMessage += `- Intent: ${analysis.intent}\n`;
        userMessage += `- Template: ${analysis.templateName}\n`;
        userMessage += `- Role: ${analysis.role}\n`;
        userMessage += `- Objective: ${analysis.objective}\n`;
        userMessage += `- Scope: ${analysis.scope.join(' | ')}\n`;
        userMessage += `- Required Content: ${analysis.requiredContent.join(' | ')}\n`;
        userMessage += `- Constraints: ${analysis.constraints.join(' | ')}\n`;
        userMessage += `- Output Format: ${analysis.outputFormat.join(' | ')}\n`;
        userMessage += `- Quality Bar: ${analysis.qualityBar.join(' | ')}\n`;
        userMessage += `- Do Not: ${analysis.avoid.join(' | ')}\n\n`;
        if (context) {
            userMessage += `Environment Context:\n`;
            userMessage += `- Language: ${context.languageId}\n`;
            userMessage += `- File: ${context.fileName}\n`;
            if (context.relativePath) {
                userMessage += `- Relative Path: ${context.relativePath}\n`;
            }
            if (context.selectionText) {
                userMessage += `- Target Selection:\n\`\`\`${context.languageId}\n${context.selectionText}\n\`\`\`\n`;
            } else {
                userMessage += `- Surrounding Code (Truncated):\n\`\`\`${context.languageId}\n${context.surroundingCode}\n\`\`\`\n`;
            }
        }

        // Many model APIs reject consecutive User messages or unsupported roles (like system).
        // Combining them into a single User message ensures highest compatibility across all Copilot models (including o1).
        const combinedContent = systemPrompt + '\n\n---\n\n' + userMessage;

        return [
            vscode.LanguageModelChatMessage.User(combinedContent)
        ];
    }

    private async sendOptimizationRequest(
        model: vscode.LanguageModelChat,
        messages: vscode.LanguageModelChatMessage[],
        token: vscode.CancellationToken,
    ): Promise<OptimizationResult> {
        try {
            // Some Copilot models require 'justification' to explain to the user why the extension is using the model.
            const options: vscode.LanguageModelChatRequestOptions = {
                justification: 'Optimize user prompt for Copilot'
            };
            const response = await model.sendRequest(messages, options, token);
            let responseText = '';
            for await (const chunk of response.text) {
                responseText += chunk;
            }
            
            // Clean up Markdown JSON blocks if present
            responseText = responseText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
            const result: OptimizationResult = JSON.parse(responseText);
            
            // Add the main optimized prompt as the first version
            result.versions.unshift({ label: 'Balanced (Default)', prompt: result.optimizedPrompt });
            result.templateName = result.templateName || 'general';
            result.appliedStrategies = result.appliedStrategies || [];

            return result;
        } catch (e: any) {
            throw new Error(`Failed to process prompt optimization: ${e.message}`);
        }
    }

    private buildHeuristicFallback(
        rawPrompt: string,
        context: CodeContext | undefined,
        error?: unknown,
    ): OptimizationResult {
        const analysis = this.analyzePrompt(rawPrompt, context);
        const intent = analysis.intent;
        const language = context?.languageId ?? 'current language';
        const target = context?.selectionText
            ? 'the selected code'
            : context?.fileName
              ? `the relevant code in ${context.fileName}`
              : 'the relevant code';

        const contextSection = context
            ? `# Context
- Language: ${language}
- File: ${context.fileName}
- Focus: ${target}`
            : `# Context
- Language: ${language}
- Focus: ${target}`;

        const taskSection = `# Objective
${analysis.objective}`;

        const baseConstraints = [
            'Preserve existing behavior unless explicitly asked to change it.',
            'Explain key trade-offs briefly before large changes.',
            'Prefer minimal, production-ready modifications.',
            context?.selectionText
                ? 'Prioritize the selected code and only expand scope when necessary.'
                : 'Infer scope from the nearby code and avoid unrelated refactors.',
        ];

        const constraints = [...analysis.constraints, ...baseConstraints];

        const optimizedPrompt = [
            `# Role`,
            analysis.role || `Act as a senior ${language} engineer.`,
            contextSection,
            taskSection,
            '# Scope',
            ...analysis.scope.map(item => `- ${item}`),
            '# Required Content',
            ...analysis.requiredContent.map(item => `- ${item}`),
            '# Constraints',
            ...constraints.map(item => `- ${item}`),
            '# Output Format',
            ...analysis.outputFormat.map(item => `- ${item}`),
            '- Start with a short plan.',
            '- Then provide the code change or answer.',
            '- Mention any assumptions or missing context.',
            '# Quality Bar',
            ...analysis.qualityBar.map(item => `- ${item}`),
            '# Do Not',
            ...analysis.avoid.map(item => `- ${item}`),
        ].join('\n');

        return {
            intent,
            optimizedPrompt,
            suggestions: [
                error
                    ? 'Copilot 模型请求不可用，本次结果已自动降级为本地优化策略。'
                    : '当前结果由本地优化策略生成，可继续手动细化需求。',
                '明确说明你希望修改、解释、修复还是重构。',
                '补充预期输出格式，例如“直接给补丁”或“先解释再写代码”。',
                '如果关注性能、安全或测试，请在提示词里显式写出优先级。',
                context?.selectionText
                    ? '你已选择代码，当前优化会优先围绕选中区域展开。'
                    : '选中目标代码后再提问，通常会得到更稳定的结果。',
                '将角色、范围、输出格式和禁止项显式写出，通常能显著提升生成质量。',
            ],
            versions: [
                {
                    label: 'Balanced (Default)',
                    prompt: optimizedPrompt,
                },
                {
                    label: 'Concise',
                    prompt: `Role: ${analysis.role}. Objective: ${analysis.objective} Focus on ${target}. Constraints: ${constraints.slice(0, 3).join(' ')} Output: ${analysis.outputFormat.join(' ')}`,
                },
                {
                    label: 'Detailed',
                    prompt: `${optimizedPrompt}\n- If there are multiple approaches, compare them briefly and choose the safest one.\n- Add acceptance criteria for the final output.\n- Make architectural boundaries and non-goals explicit when applicable.`,
                },
            ],
            modelInfo: error
                ? 'Fallback: local heuristic optimizer (Copilot model request unavailable)'
                : 'Fallback: local heuristic optimizer',
            templateName: analysis.templateName,
            appliedStrategies: analysis.appliedStrategies,
        };
    }

    private detectIntent(rawPrompt: string): string {
        const prompt = rawPrompt.toLowerCase();
        if (/(architecture|架构图|架构|diagram|mermaid|产品架构|system design)/.test(prompt)) {
            return 'Architecture design and diagram generation';
        }
        if (/(fix|bug|报错|错误|修复|debug|排查)/.test(prompt)) {
            return 'Bug fixing and debugging';
        }
        if (/(refactor|重构|优化代码|clean up)/.test(prompt)) {
            return 'Refactoring and code quality improvement';
        }
        if (/(test|测试|单测|unit test)/.test(prompt)) {
            return 'Testing and verification';
        }
        if (/(explain|解释|说明|why)/.test(prompt)) {
            return 'Code explanation and understanding';
        }
        if (/(performance|性能|optimi[sz]e|加速)/.test(prompt)) {
            return 'Performance optimization';
        }
        return 'General coding assistance';
    }

    private rewriteTask(rawPrompt: string, intent: string): string {
        switch (intent) {
            case 'Bug fixing and debugging':
                return `Analyze the issue described by the user and propose a precise fix for: ${rawPrompt}`;
            case 'Refactoring and code quality improvement':
                return `Refactor the relevant implementation for clarity, maintainability, and correctness based on: ${rawPrompt}`;
            case 'Testing and verification':
                return `Design or update tests and verification steps for: ${rawPrompt}`;
            case 'Code explanation and understanding':
                return `Explain the relevant code clearly and answer the user's question: ${rawPrompt}`;
            case 'Performance optimization':
                return `Improve runtime or memory efficiency for the task described here: ${rawPrompt}`;
            default:
                return `Help with the following development request: ${rawPrompt}`;
        }
    }

    private analyzePrompt(rawPrompt: string, context: CodeContext | undefined): PromptAnalysis {
        const lower = rawPrompt.toLowerCase();
        const intent = this.detectIntent(rawPrompt);
        const isArchitecture = /(architecture|架构图|架构|diagram|mermaid|system design)/.test(lower);
        const isSqlAssistant = isArchitecture && /(sql assistant|sql开发|sql assistant component|sql 优化)/.test(lower);
        const isSqlOptimization = /(sql|query|join|index|explain|analyze|database)/.test(lower);

        const templateName: PromptTemplateName = isSqlAssistant
            ? 'sql-assistant-architecture'
            : isSqlOptimization
              ? 'sql-optimization'
              : isArchitecture
                ? 'architecture-diagram'
                : 'general';

        if (templateName === 'sql-optimization') {
            return {
                intent: 'SQL Performance Optimization and Execution Plan Analysis',
                templateName,
                role: 'You are an Expert Database Administrator and Senior SQL Performance Engineer.',
                objective: `Analyze and optimize the provided SQL query: ${rawPrompt}`,
                scope: [
                    'Focus on database engine-level optimization, execution plan reasoning, and structural improvements.',
                    'Assume an OLTP or mixed-workload environment unless stated otherwise.',
                ],
                requiredContent: [
                    'Simulate or reason about EXPLAIN ANALYZE.',
                    'Identify: Scan type (Seq vs Index), Join strategy (Hash / Merge / Nested Loop), and Aggregation type.',
                    'Quantify performance bottlenecks using cost-based reasoning.',
                    'Incorporate Data Distribution Assumptions: e.g. Skew/hot data, relative table sizes, cardinality assumptions.',
                ],
                constraints: [
                    'Optimization priority: 1) Eliminate full table scans 2) Reduce rows before JOIN (pre-aggregation) 3) Avoid re-aggregation 4) Optimize STRING_AGG via deduplication 5) Ensure index-supported joins.',
                    'Index strategy must include: Composite indexes (JOIN + WHERE), Covering indexes, Partial indexes (e.g., is_deleted = 0 AND last 30 days), and Consider index-only scan possibility.',
                    'Do NOT provide generic suggestions without execution plan reasoning.',
                ],
                outputFormat: [
                    '1. Optimized SQL',
                    '2. Index DDL',
                    '3. Expected execution plan change',
                    '4. Estimated cost reduction (%)',
                    '5. Validation steps (EXPLAIN)',
                ],
                qualityBar: [
                    'Must be Agent-ready: strictly structured for automated execution and verification.',
                    'Must rely on explicit data distribution assumptions and plan reasoning.',
                ],
                avoid: [
                    'Do not provide unverified or generic index recommendations.',
                    'Do not omit the risk analysis for write-heavy tables.',
                ],
                appliedStrategies: [
                    'EXPLAIN ANALYZE requirement injection',
                    'Optimization priority constraints',
                    'Data distribution assumptions',
                    'Agent-ready output structure enforcement',
                ],
            };
        }

        if (templateName === 'sql-assistant-architecture') {
            return {
                intent,
                templateName,
                role: 'You are a Senior Product Architect and Data Platform Architecture Designer.',
                objective: 'Design a product architecture diagram for a SQL Assistant inside a multi-language data program optimization platform.',
                scope: [
                    'Focus on the SQL Assistant and its direct integrations only.',
                    'Treat SQL as the primary subject and unified optimization config as a first-class dependency.',
                    'Keep the design product-architecture oriented instead of deployment oriented.',
                    'Include considerations for EXPLAIN ANALYZE, optimization priorities, and data distribution assumptions.',
                ],
                requiredContent: [
                    'Core components: Query Optimizer, Index Advisor, Execution Plan Analyzer.',
                    'Supporting layers: API/Orchestrator, Configuration Management, Monitoring/Evaluation, Logging/Audit.',
                    'External dependencies: database connections, metrics, logging, metadata or execution plan sources.',
                    'End-to-end data flow from user request to optimization output.',
                    'Explicit details on EXPLAIN ANALYZE usage, data distribution assumptions, and optimization priorities.',
                ],
                constraints: [
                    'Use Mermaid syntax compatible with Markdown.',
                    'Keep the diagram to 2-3 hierarchy levels.',
                    'Show clear module boundaries, integration points, and data flow arrows.',
                    'Explicitly include scalability and maintainability considerations.',
                    'Enforce an Agent-ready output structure (strictly formatted for automated downstream parsing).',
                ],
                outputFormat: [
                    'Section 1: Architecture Diagram',
                    'Section 2: Component Responsibilities',
                    'Section 3: EXPLAIN ANALYZE & Data Flow Annotations',
                    'Section 4: Scalability & Maintainability Notes',
                    'Section 5: Optimization Priorities & Data Distribution Assumptions',
                    'Section 6: Agent-ready Output Structure',
                ],
                qualityBar: [
                    'Readable by both product and engineering teams.',
                    'Clearly separates analysis, recommendation, configuration, and evaluation responsibilities.',
                    'Avoids mixing logical product architecture with low-level deployment details.',
                ],
                avoid: [
                    'Do not omit data flow.',
                    'Do not omit external dependencies or config integration.',
                    'Do not turn the result into a generic system design essay.',
                ],
                appliedStrategies: [
                    'Role/Context/Scope modularization',
                    'Architecture-diagram-specific constraint injection',
                    'Explicit deliverable shaping',
                    'Boundary and non-goal definition',
                ],
            };
        }

        if (templateName === 'architecture-diagram') {
            return {
                intent,
                templateName,
                role: 'You are a Senior Architecture Designer.',
                objective: `Design a clear architecture diagram for: ${rawPrompt}`,
                scope: [
                    'Focus on product or logical architecture unless the user explicitly asks for deployment architecture.',
                    'Keep hierarchy depth shallow and component boundaries visible.',
                ],
                requiredContent: [
                    'Core modules and their responsibilities.',
                    'Data flow between modules.',
                    'Integration points, configuration, monitoring, and external dependencies.',
                ],
                constraints: [
                    'Prefer Mermaid syntax unless the user asks for ASCII.',
                    'Use explicit output sections and clear labels.',
                    'State non-goals and keep the scope tight.',
                ],
                outputFormat: [
                    'Architecture Diagram',
                    'Component Responsibilities',
                    'Data Flow Annotations',
                    'Scalability & Maintainability Notes',
                ],
                qualityBar: [
                    'The diagram must be implementation-oriented and easy to scan.',
                    'The textual explanation must be concise and structured.',
                ],
                avoid: [
                    'Do not produce a vague conceptual overview without a diagram.',
                    'Do not exceed the requested hierarchy depth.',
                ],
                appliedStrategies: [
                    'Role/Context/Task structuring',
                    'Output-format enforcement',
                    'Scalability and maintainability explicitness',
                ],
            };
        }

        return {
            intent,
            templateName,
            role: `You are a senior ${context?.languageId ?? 'software'} engineer.`,
            objective: this.rewriteTask(rawPrompt, intent),
            scope: [
                'Solve the stated task without expanding into unrelated refactors.',
                context?.selectionText
                    ? 'Prioritize the selected code or directly referenced artifact.'
                    : 'Infer scope from the prompt and nearby code context only when needed.',
            ],
            requiredContent: [
                'Preserve user intent.',
                'Add practical engineering constraints and a clear output contract.',
            ],
            constraints: [
                'Prefer directive-style phrasing.',
                'Make expected deliverables explicit.',
            ],
            outputFormat: [
                'Short plan',
                'Main output',
                'Assumptions or caveats',
            ],
            qualityBar: [
                'Clear enough for direct use in Copilot Chat or other coding assistants.',
            ],
            avoid: [
                'Do not leave task boundaries ambiguous.',
            ],
            appliedStrategies: [
                'Intent recognition',
                'Context-aware constraint injection',
                'Structured prompt composition',
            ],
        };
    }
}
