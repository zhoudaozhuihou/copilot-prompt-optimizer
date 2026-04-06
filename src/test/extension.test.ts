import * as assert from 'assert';
import * as vscode from 'vscode';
import { ContextManager } from '../contextManager';
import { PromptOptimizer } from '../optimizer';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('ContextManager gathers undefined without editor', () => {
		const contextManager = new ContextManager();
		const ctx = contextManager.gatherContext();
		// Since we run this in an empty environment initially, it should be undefined
		assert.strictEqual(ctx, undefined);
	});

    test('Optimizer returns a structured fallback result when no model is available', async () => {
        const optimizer = new PromptOptimizer();
        const tokenSource = new vscode.CancellationTokenSource();
        const result = await optimizer.optimize('test prompt', undefined, undefined, tokenSource.token);
        assert.ok(result.optimizedPrompt.length > 0);
        assert.ok(result.templateName.length > 0);
    });

    test('Optimizer applies architecture template for SQL assistant architecture prompts', async () => {
        const optimizer = new PromptOptimizer();
        const tokenSource = new vscode.CancellationTokenSource();
        const result = await optimizer.optimize(
            '生成一个sql assistant的产品架构图，需要 mermaid，体现 query optimizer、index advisor 和 execution plan analyzer',
            undefined,
            undefined,
            tokenSource.token,
        );

        assert.strictEqual(result.templateName, 'sql-assistant-architecture');
        assert.ok(result.optimizedPrompt.includes('# Role'));
        assert.ok(result.optimizedPrompt.includes('# Output Format'));
        assert.ok(result.appliedStrategies.length > 0);
    });
});
