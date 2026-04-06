import * as vscode from 'vscode';

export interface CodeContext {
    languageId: string;
    fileName: string;
    selectionText: string;
    surroundingCode: string;
}

export class ContextManager {
    public gatherContext(): CodeContext | undefined {
        const config = vscode.workspace.getConfiguration('copilotPromptOptimizer');
        if (!config.get<boolean>('includeContext', true)) {
            return undefined;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }

        const document = editor.document;
        const selection = editor.selection;

        // Get selected text
        const selectionText = document.getText(selection);

        // Get surrounding code (Context compression technique: Limit to max 50 lines around selection)
        const startLine = Math.max(0, selection.start.line - 25);
        const endLine = Math.min(document.lineCount - 1, selection.end.line + 25);
        const surroundingCode = document.getText(new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length));

        return {
            languageId: document.languageId,
            fileName: document.fileName.split(/[/\\]/).pop() || 'Unknown',
            selectionText,
            surroundingCode
        };
    }
}
