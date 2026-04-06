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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const optimizer_1 = require("./optimizer");
const webview_1 = require("./webview");
const contextManager_1 = require("./contextManager");
const historyManager_1 = require("./historyManager");
const configManager_1 = require("./configManager");
const dataProgramOptimizer_1 = require("./dataProgramOptimizer");
function activate(context) {
    const historyManager = new historyManager_1.HistoryManager(context.globalState);
    const contextManager = new contextManager_1.ContextManager();
    const promptOptimizer = new optimizer_1.PromptOptimizer();
    const webviewProvider = new webview_1.OptimizerWebview(context.extensionUri, historyManager);
    const configManager = new configManager_1.OptimizationConfigManager();
    const dataProgramOptimizer = new dataProgramOptimizer_1.DataProgramOptimizer(configManager);
    let disposable = vscode.commands.registerCommand('copilot-prompt-optimizer.optimize', async () => {
        // 1. Gather raw prompt from user
        const rawPrompt = await vscode.window.showInputBox({
            prompt: 'Enter your initial prompt idea for Copilot',
            placeHolder: 'e.g., refactor this function to be more efficient'
        });
        if (!rawPrompt) {
            return;
        }
        // 2. Gather Context (Language, Selection, Surrounding Code)
        const codeContext = contextManager.gatherContext();
        // 3. Show Progress
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Optimizing prompt with Copilot Model...",
            cancellable: true
        }, async (_progress, token) => {
            try {
                // 4. Optimize using VS Code Language Model API
                const optimizedData = await promptOptimizer.optimize(rawPrompt, codeContext, undefined, token);
                // 5. Save to History
                historyManager.addRecord({
                    timestamp: Date.now(),
                    rawPrompt: rawPrompt,
                    optimizedPrompt: optimizedData.optimizedPrompt,
                    intent: optimizedData.intent,
                    context: codeContext,
                    templateName: optimizedData.templateName,
                    appliedStrategies: optimizedData.appliedStrategies,
                });
                // 6. Display Webview UI for multi-version comparison
                webviewProvider.show(rawPrompt, optimizedData);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Optimization failed: ${error.message}`);
            }
        });
    });
    context.subscriptions.push(disposable);
    const analyzeDataProgram = vscode.commands.registerCommand('copilot-prompt-optimizer.analyzeDataProgram', async () => {
        const rawPrompt = await vscode.window.showInputBox({
            prompt: 'Describe the data program optimization scenario',
            placeHolder: 'e.g., optimize SQL ETL + Python batch processing + React dashboard + Java API',
        });
        if (!rawPrompt) {
            return;
        }
        const codeContext = contextManager.gatherContext();
        const report = dataProgramOptimizer.analyze(rawPrompt, codeContext);
        const document = await vscode.workspace.openTextDocument({
            language: 'markdown',
            content: report.markdown,
        });
        await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
    });
    context.subscriptions.push(analyzeDataProgram);
    // Register Chat Participant
    const optimizerParticipant = vscode.chat.createChatParticipant('copilot-prompt-optimizer.optimizer', async (request, _chatContext, response, token) => {
        const rawPrompt = request.prompt;
        if (!rawPrompt) {
            response.markdown('Please provide a prompt to optimize. Example: `@optimizer refactor this code`');
            return;
        }
        const codeContext = contextManager.gatherContext();
        if (request.command === 'data-program') {
            const report = dataProgramOptimizer.analyze(rawPrompt, codeContext);
            response.markdown(`## Multi-Stack Optimization Report\n\n`);
            response.markdown(`**Context:** ${report.contextSummary}\n\n`);
            response.markdown(`**Overall Score:** ${report.assessment.score}/100\n\n`);
            response.markdown(report.markdown);
            return;
        }
        response.progress('Gathering context and optimizing prompt...');
        try {
            const optimizedData = await promptOptimizer.optimize(rawPrompt, codeContext, request.model, token);
            historyManager.addRecord({
                timestamp: Date.now(),
                rawPrompt: rawPrompt,
                optimizedPrompt: optimizedData.optimizedPrompt,
                intent: optimizedData.intent,
                context: codeContext,
                templateName: optimizedData.templateName,
                appliedStrategies: optimizedData.appliedStrategies,
            });
            response.markdown(`**🎯 Recognized Intent:** ${optimizedData.intent}\n\n`);
            response.markdown(`**🤖 Model Path:** ${optimizedData.modelInfo}\n\n`);
            response.markdown(`**🧩 Template:** ${optimizedData.templateName}\n\n`);
            if (optimizedData.suggestions && optimizedData.suggestions.length > 0) {
                response.markdown(`**💡 Suggestions:**\n`);
                optimizedData.suggestions.forEach((s) => response.markdown(`- ${s}\n`));
                response.markdown(`\n`);
            }
            response.markdown(`### ✨ Optimized Prompt (Balanced)\n`);
            response.markdown(`\`\`\`\n${optimizedData.optimizedPrompt}\n\`\`\`\n\n`);
            response.markdown(`*Tip: Copy the prompt above and paste it in a new chat to get the best result!*`);
        }
        catch (error) {
            response.markdown(`**Error:** Failed to optimize prompt. ${error.message}`);
        }
    });
    optimizerParticipant.iconPath = new vscode.ThemeIcon('sparkle');
    context.subscriptions.push(optimizerParticipant);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map