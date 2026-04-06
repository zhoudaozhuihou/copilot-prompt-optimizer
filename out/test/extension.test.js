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
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const contextManager_1 = require("../contextManager");
const optimizer_1 = require("../optimizer");
suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    test('ContextManager gathers undefined without editor', () => {
        const contextManager = new contextManager_1.ContextManager();
        const ctx = contextManager.gatherContext();
        // Since we run this in an empty environment initially, it should be undefined
        assert.strictEqual(ctx, undefined);
    });
    test('Optimizer returns a structured fallback result when no model is available', async () => {
        const optimizer = new optimizer_1.PromptOptimizer();
        const tokenSource = new vscode.CancellationTokenSource();
        const result = await optimizer.optimize('test prompt', undefined, undefined, tokenSource.token);
        assert.ok(result.optimizedPrompt.length > 0);
        assert.ok(result.templateName.length > 0);
    });
    test('Optimizer applies architecture template for SQL assistant architecture prompts', async () => {
        const optimizer = new optimizer_1.PromptOptimizer();
        const tokenSource = new vscode.CancellationTokenSource();
        const result = await optimizer.optimize('生成一个sql assistant的产品架构图，需要 mermaid，体现 query optimizer、index advisor 和 execution plan analyzer', undefined, undefined, tokenSource.token);
        assert.strictEqual(result.templateName, 'sql-assistant-architecture');
        assert.ok(result.optimizedPrompt.includes('# Role'));
        assert.ok(result.optimizedPrompt.includes('# Output Format'));
        assert.ok(result.appliedStrategies.length > 0);
    });
});
//# sourceMappingURL=extension.test.js.map