export type TechStack = 'sql' | 'python' | 'react' | 'java';

export interface StackConfig {
    enabled: boolean;
    parameters: Record<string, string | number | boolean>;
}

export interface OptimizationRecommendation {
    title: string;
    summary: string;
    actions: string[];
    metrics: string[];
    configHints: string[];
}

export interface StackOptimizationPlan {
    stack: TechStack;
    summary: string;
    detectedBy: string[];
    config: StackConfig;
    recommendations: OptimizationRecommendation[];
}

export interface PerformanceAssessment {
    score: number;
    expectedBenefits: string[];
    monitoring: string[];
    validationChecks: string[];
}

export interface DataProgramOptimizationReport {
    title: string;
    prompt: string;
    contextSummary: string;
    stacks: StackOptimizationPlan[];
    assessment: PerformanceAssessment;
    configSummary: string[];
    markdown: string;
}
