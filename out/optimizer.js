"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptOptimizer = void 0;
const vscode = __importStar(require("vscode"));
const SUPPORTED_COPILOT_FAMILIES = [
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
    'claude-3.5-sonnet',
];
class PromptOptimizer {
    async optimize(rawPrompt, context, providedModel, token) {
        try {
            const candidateModels = await this.getCandidateModels(providedModel);
            const messages = this.buildMessages(rawPrompt, context);
            let lastError;
            for (const model of candidateModels) {
                try {
                    const result = await this.sendOptimizationRequest(model, messages, token);
                    return {
                        ...result,
                        modelInfo: `Copilot model: ${model.name} (${model.family})`,
                    };
                }
                catch (e) {
                    lastError = e;
                }
            }
            if (lastError) {
                return this.buildHeuristicFallback(rawPrompt, context, lastError);
            }
            return this.buildHeuristicFallback(rawPrompt, context);
        }
        catch (error) {
            return this.buildHeuristicFallback(rawPrompt, context, error);
        }
    }
    async getCandidateModels(providedModel) {
        const candidates = [];
        const seen = new Set();
        const addModel = (model) => {
            if (!model || seen.has(model.id)) {
                return;
            }
            seen.add(model.id);
            candidates.push(model);
        };
        // Prefer the exact model selected in Copilot Chat.
        addModel(providedModel);
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
                .filter(model => model.family !== 'embeddings' &&
                SUPPORTED_COPILOT_FAMILIES.includes(model.family))
                .forEach(addModel);
        }
        catch {
            // Ignore model discovery errors and continue with whatever model was
            // already provided by the chat request.
        }
        return candidates;
    }
    buildMessages(rawPrompt, context) {
        // Keep the guidance in-band because the public VS Code LM API doesn't
        // expose a dedicated system-role helper.
        const systemPrompt = `You are an expert AI Prompt Optimizer acting inside VS Code. 
Your goal is to rewrite the user's raw prompt into a highly effective, context-aware prompt for GitHub Copilot Chat.

Follow these Prompt Optimization Principles:
1. Intent Recognition: Clarify what the user actually wants to achieve (e.g., refactoring, debugging, documentation).
2. Context Awareness: Inject constraints based on the provided language and surrounding code.
3. Modularity: Structure the optimized prompt with clear headings (e.g., "Context", "Task", "Constraints").
4. Role-based: Apply the best persona for the task (e.g., Senior Developer, Security Expert).

Output ONLY a valid JSON object with this exact structure:
{
    "intent": "Short description of recognized intent",
    "optimizedPrompt": "The primary, most balanced optimized prompt",
    "suggestions": ["3-4 actionable tips for the user"],
    "versions": [
        { "label": "Concise", "prompt": "A shorter version of the optimized prompt" },
        { "label": "Detailed", "prompt": "A highly detailed version with step-by-step thinking instructions" }
    ]
}`;
        let userMessage = `Raw Prompt: "${rawPrompt}"\n\n`;
        if (context) {
            userMessage += `Environment Context:\n`;
            userMessage += `- Language: ${context.languageId}\n`;
            userMessage += `- File: ${context.fileName}\n`;
            if (context.selectionText) {
                userMessage += `- Target Selection:\n\`\`\`${context.languageId}\n${context.selectionText}\n\`\`\`\n`;
            }
            else {
                userMessage += `- Surrounding Code (Truncated):\n\`\`\`${context.languageId}\n${context.surroundingCode}\n\`\`\`\n`;
            }
        }
        return [
            vscode.LanguageModelChatMessage.User(systemPrompt),
            vscode.LanguageModelChatMessage.User(userMessage)
        ];
    }
    async sendOptimizationRequest(model, messages, token) {
        try {
            const response = await model.sendRequest(messages, {}, token);
            let responseText = '';
            for await (const chunk of response.text) {
                responseText += chunk;
            }
            // Clean up Markdown JSON blocks if present
            responseText = responseText.replace(/```json\n?/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(responseText);
            // Add the main optimized prompt as the first version
            result.versions.unshift({ label: 'Balanced (Default)', prompt: result.optimizedPrompt });
            return result;
        }
        catch (e) {
            throw new Error(`Failed to process prompt optimization: ${e.message}`);
        }
    }
    buildHeuristicFallback(rawPrompt, context, error) {
        const intent = this.detectIntent(rawPrompt);
        const language = context?.languageId ?? 'current language';
        const target = context?.selectionText
            ? 'the selected code'
            : context?.fileName
                ? `the relevant code in ${context.fileName}`
                : 'the relevant code';
        const contextSection = context
            ? `Context:
- Language: ${language}
- File: ${context.fileName}
- Focus: ${target}`
            : `Context:
- Language: ${language}
- Focus: ${target}`;
        const taskSection = `Task:
${this.rewriteTask(rawPrompt, intent)}`;
        const constraints = [
            'Preserve existing behavior unless explicitly asked to change it.',
            'Explain key trade-offs briefly before large changes.',
            'Prefer minimal, production-ready modifications.',
            context?.selectionText
                ? 'Prioritize the selected code and only expand scope when necessary.'
                : 'Infer scope from the nearby code and avoid unrelated refactors.',
        ];
        const optimizedPrompt = [
            `Act as a senior ${language} engineer.`,
            contextSection,
            taskSection,
            'Constraints:',
            ...constraints.map(item => `- ${item}`),
            'Output Format:',
            '- Start with a short plan.',
            '- Then provide the code change or answer.',
            '- Mention any assumptions or missing context.',
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
            ],
            versions: [
                {
                    label: 'Balanced (Default)',
                    prompt: optimizedPrompt,
                },
                {
                    label: 'Concise',
                    prompt: `As a senior ${language} engineer, ${this.rewriteTask(rawPrompt, intent)} Focus on ${target}. Preserve behavior, keep changes minimal, and mention assumptions.`,
                },
                {
                    label: 'Detailed',
                    prompt: `${optimizedPrompt}\n- Validate edge cases.\n- If there are multiple approaches, compare them briefly and choose the safest one.\n- Include tests or verification steps when relevant.`,
                },
            ],
            modelInfo: error
                ? 'Fallback: local heuristic optimizer (Copilot model request unavailable)'
                : 'Fallback: local heuristic optimizer',
        };
    }
    detectIntent(rawPrompt) {
        const prompt = rawPrompt.toLowerCase();
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
    rewriteTask(rawPrompt, intent) {
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
}
exports.PromptOptimizer = PromptOptimizer;
//# sourceMappingURL=optimizer.js.map