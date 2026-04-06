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
exports.ContextManager = void 0;
const vscode = __importStar(require("vscode"));
class ContextManager {
    gatherContext() {
        const config = vscode.workspace.getConfiguration('copilotPromptOptimizer');
        if (!config.get('includeContext', true)) {
            return undefined;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return undefined;
        }
        const document = editor.document;
        const selection = editor.selection;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
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
            surroundingCode,
            workspaceName: workspaceFolder?.name,
            relativePath: workspaceFolder
                ? vscode.workspace.asRelativePath(document.uri, false)
                : undefined,
            lineCount: document.lineCount
        };
    }
}
exports.ContextManager = ContextManager;
//# sourceMappingURL=contextManager.js.map