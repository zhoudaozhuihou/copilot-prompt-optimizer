import * as assert from 'assert';
import { DataProgramOptimizer } from '../dataProgramOptimizer';
import { CodeContext } from '../contextManager';
import { TechStack } from '../optimizationTypes';

suite('Data Program Optimizer', () => {
    const optimizer = new DataProgramOptimizer({
        getDefaultStacks: (): TechStack[] => ['sql', 'python', 'react', 'java'],
        isMonitoringEnabled: (): boolean => true,
        getConfigSummary: (stacks: TechStack[]): string[] => stacks.map(stack => `${stack}: enabled=true`),
        getStackConfig: (stack: TechStack) => ({
            enabled: true,
            parameters: { stack },
        }),
    } as any);

    test('detects SQL and Python stacks from prompt and context', () => {
        const context: CodeContext = {
            languageId: 'python',
            fileName: 'pipeline.py',
            selectionText: 'df.groupby("country").sum()',
            surroundingCode: 'import pandas as pd',
            workspaceName: 'demo',
            relativePath: 'src/pipeline.py',
            lineCount: 120,
        };

        const report = optimizer.analyze('Optimize SQL ETL and Python batch processing', context);
        const stacks = report.stacks.map(stack => stack.stack);

        assert.ok(stacks.includes('sql'));
        assert.ok(stacks.includes('python'));
        assert.ok(report.markdown.includes('SQL 优化方案'));
    });

    test('falls back to default stacks when prompt is generic', () => {
        const report = optimizer.analyze('Improve the whole data platform', undefined);
        assert.strictEqual(report.stacks.length, 4);
        assert.ok(report.assessment.score >= 60);
    });
});
