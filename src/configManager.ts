import * as vscode from 'vscode';
import { StackConfig, TechStack } from './optimizationTypes';

export class OptimizationConfigManager {
    private readonly config = vscode.workspace.getConfiguration('copilotPromptOptimizer');

    public getDefaultStacks(): TechStack[] {
        const raw = this.config.get<string[]>('dataProgram.defaultStacks', ['sql', 'python', 'react', 'java']);
        return raw.filter((value): value is TechStack =>
            value === 'sql' || value === 'python' || value === 'react' || value === 'java',
        );
    }

    public isMonitoringEnabled(): boolean {
        return this.config.get<boolean>('dataProgram.monitoringEnabled', true);
    }

    public getStackConfig(stack: TechStack): StackConfig {
        switch (stack) {
            case 'sql':
                return {
                    enabled: true,
                    parameters: {
                        maxIndexSuggestions: this.config.get<number>('sql.maxIndexSuggestions', 3),
                        analyzeExecutionPlan: this.config.get<boolean>('sql.analyzeExecutionPlan', true),
                    },
                };
            case 'python':
                return {
                    enabled: true,
                    parameters: {
                        memoryBudgetMb: this.config.get<number>('python.memoryBudgetMb', 1024),
                        enableParallelHints: this.config.get<boolean>('python.enableParallelHints', true),
                    },
                };
            case 'react':
                return {
                    enabled: true,
                    parameters: {
                        stateStrategy: this.config.get<string>('react.stateStrategy', 'query-cache'),
                        virtualizationThreshold: this.config.get<number>('react.virtualizationThreshold', 200),
                    },
                };
            case 'java':
                return {
                    enabled: true,
                    parameters: {
                        threadPoolSize: this.config.get<number>('java.threadPoolSize', 16),
                        cacheStrategy: this.config.get<string>('java.cacheStrategy', 'caffeine+redis'),
                    },
                };
        }
    }

    public getConfigSummary(stacks: TechStack[]): string[] {
        const lines = [
            `Monitoring enabled: ${this.isMonitoringEnabled() ? 'yes' : 'no'}`,
        ];

        for (const stack of stacks) {
            const config = this.getStackConfig(stack);
            const summary = Object.entries(config.parameters)
                .map(([key, value]) => `${key}=${value}`)
                .join(', ');
            lines.push(`${stack}: ${summary}`);
        }

        return lines;
    }
}
