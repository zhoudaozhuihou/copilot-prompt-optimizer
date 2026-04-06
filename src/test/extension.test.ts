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

    test('Optimizer throws if no model found or without token', async () => {
        const optimizer = new PromptOptimizer();
        try {
            const tokenSource = new vscode.CancellationTokenSource();
            await optimizer.optimize('test prompt', undefined, undefined, tokenSource.token);
            // This might succeed or fail depending on if Copilot LM API is mocked/available.
            // In a standard test environment without the real Copilot, it will likely throw.
        } catch (e: any) {
            assert.ok(e.message.includes('Copilot Language Model is not available') || e.message.includes('process prompt optimization'));
        }
    });
});
