import * as vscode from 'vscode';
import { PromptOptimizer } from './optimizer';
import { OptimizerWebview } from './webview';
import { ContextManager } from './contextManager';
import { HistoryManager } from './historyManager';

export function activate(context: vscode.ExtensionContext) {
    const historyManager = new HistoryManager(context.globalState);
    const contextManager = new ContextManager();
    const promptOptimizer = new PromptOptimizer();
    const webviewProvider = new OptimizerWebview(context.extensionUri, historyManager);

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
        }, async (progress, token) => {
            try {
                // 4. Optimize using VS Code Language Model API
                const optimizedData = await promptOptimizer.optimize(rawPrompt, codeContext, undefined, token);
                
                // 5. Save to History
                historyManager.addRecord({
                    timestamp: Date.now(),
                    rawPrompt: rawPrompt,
                    optimizedPrompt: optimizedData.optimizedPrompt,
                    intent: optimizedData.intent,
                    context: codeContext
                });

                // 6. Display Webview UI for multi-version comparison
                webviewProvider.show(rawPrompt, optimizedData);

            } catch (error: any) {
                vscode.window.showErrorMessage(`Optimization failed: ${error.message}`);
            }
        });
    });

    context.subscriptions.push(disposable);

    // Register Chat Participant
    const optimizerParticipant = vscode.chat.createChatParticipant('copilot-prompt-optimizer.optimizer', async (request, chatContext, response, token) => {
        const rawPrompt = request.prompt;
        
        if (!rawPrompt) {
            response.markdown('Please provide a prompt to optimize. Example: `@optimizer refactor this code`');
            return;
        }

        const codeContext = contextManager.gatherContext();
        
        response.progress('Gathering context and optimizing prompt...');
        
        try {
            const optimizedData = await promptOptimizer.optimize(rawPrompt, codeContext, request.model, token);
            
            historyManager.addRecord({
                timestamp: Date.now(),
                rawPrompt: rawPrompt,
                optimizedPrompt: optimizedData.optimizedPrompt,
                intent: optimizedData.intent,
                context: codeContext
            });

            response.markdown(`**🎯 Recognized Intent:** ${optimizedData.intent}\n\n`);
            response.markdown(`**🤖 Model Path:** ${optimizedData.modelInfo}\n\n`);
            
            if (optimizedData.suggestions && optimizedData.suggestions.length > 0) {
                response.markdown(`**💡 Suggestions:**\n`);
                optimizedData.suggestions.forEach((s: string) => response.markdown(`- ${s}\n`));
                response.markdown(`\n`);
            }

            response.markdown(`### ✨ Optimized Prompt (Balanced)\n`);
            response.markdown(`\`\`\`\n${optimizedData.optimizedPrompt}\n\`\`\`\n\n`);
            
            response.markdown(`*Tip: Copy the prompt above and paste it in a new chat to get the best result!*`);

        } catch (error: any) {
            response.markdown(`**Error:** Failed to optimize prompt. ${error.message}`);
        }
    });

    optimizerParticipant.iconPath = new vscode.ThemeIcon('sparkle');
    context.subscriptions.push(optimizerParticipant);
}

export function deactivate() {}
