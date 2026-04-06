import * as vscode from 'vscode';
import { OptimizationResult } from './optimizer';
import { HistoryManager } from './historyManager';

export class OptimizerWebview {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        private extensionUri: vscode.Uri,
        private historyManager: HistoryManager
    ) {}

    public show(rawPrompt: string, data: OptimizationResult) {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'copilotPromptOptimizer',
                'Prompt Optimizer Results',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            });
        }

        this.panel.webview.html = this.getHtmlContent(rawPrompt, data);
        
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'copyToClipboard':
                    vscode.env.clipboard.writeText(message.text);
                    vscode.window.showInformationMessage('Copied to clipboard!');
                    return;
                case 'sendToCopilot':
                    // We can directly send to the Copilot Interactive session
                    vscode.commands.executeCommand('workbench.action.chat.open', { query: message.text });
                    return;
            }
        });
    }

    private getHtmlContent(rawPrompt: string, data: OptimizationResult): string {
        const versionsHtml = data.versions.map((v, index) => `
            <div class="version-card">
                <h3>${v.label}</h3>
                <textarea readonly id="prompt-${index}">${this.escapeHtml(v.prompt)}</textarea>
                <div class="actions">
                    <button onclick="copyText('prompt-${index}')">Copy to Clipboard</button>
                    <button onclick="sendToCopilot('prompt-${index}')" class="primary">Send to Copilot</button>
                </div>
            </div>
        `).join('');

        const suggestionsHtml = data.suggestions.map(s => `<li>${this.escapeHtml(s)}</li>`).join('');
        const strategiesHtml = data.appliedStrategies
            .map(strategy => `<li>${this.escapeHtml(strategy)}</li>`)
            .join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt Optimizer</title>
    <style>
        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
        h1, h2, h3 { color: var(--vscode-editor-foreground); }
        .section { margin-bottom: 20px; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: var(--vscode-editor-inactiveSelectionBackground); }
        .version-card { margin-top: 10px; padding: 10px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border); border-radius: 4px; }
        textarea { width: 100%; height: 120px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; font-family: monospace; resize: vertical; box-sizing: border-box; }
        .actions { margin-top: 10px; display: flex; gap: 10px; }
        button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; cursor: pointer; border-radius: 2px; }
        button:hover { background: var(--vscode-button-secondaryHoverBackground); }
        button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
        button.primary:hover { background: var(--vscode-button-hoverBackground); }
        ul { margin: 0; padding-left: 20px; }
    </style>
</head>
<body>
    <h1>Copilot Prompt Optimizer</h1>
    
    <div class="section">
        <h2>Intent Analysis</h2>
        <p><strong>Recognized Intent:</strong> ${this.escapeHtml(data.intent)}</p>
        <p><strong>Applied Template:</strong> ${this.escapeHtml(data.templateName)}</p>
        <p><strong>Model Path:</strong> ${this.escapeHtml(data.modelInfo)}</p>
        <p><strong>Original Prompt:</strong> ${this.escapeHtml(rawPrompt)}</p>
    </div>

    <div class="section">
        <h2>Actionable Suggestions</h2>
        <ul>${suggestionsHtml}</ul>
    </div>

    <div class="section">
        <h2>Applied Strategies</h2>
        <ul>${strategiesHtml}</ul>
    </div>

    <h2>Optimized Versions</h2>
    ${versionsHtml}

    <script>
        const vscode = acquireVsCodeApi();

        function copyText(id) {
            const text = document.getElementById(id).value;
            vscode.postMessage({ command: 'copyToClipboard', text: text });
        }

        function sendToCopilot(id) {
            const text = document.getElementById(id).value;
            vscode.postMessage({ command: 'sendToCopilot', text: text });
        }
    </script>
</body>
</html>`;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
}
