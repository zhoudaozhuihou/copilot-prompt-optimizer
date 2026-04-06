import { CodeContext } from './contextManager';
import { OptimizationConfigManager } from './configManager';
import {
    DataProgramOptimizationReport,
    OptimizationRecommendation,
    PerformanceAssessment,
    StackOptimizationPlan,
    TechStack,
} from './optimizationTypes';

export class DataProgramOptimizer {
    constructor(private readonly configManager: OptimizationConfigManager) {}

    public analyze(prompt: string, context: CodeContext | undefined): DataProgramOptimizationReport {
        const stacks = this.detectStacks(prompt, context);
        const plans = stacks.map(stack => this.buildPlan(stack, prompt, context));
        const configSummary = this.configManager.getConfigSummary(stacks);
        const assessment = this.buildAssessment(plans);

        const contextSummary = [
            context?.workspaceName ? `Workspace: ${context.workspaceName}` : undefined,
            context?.relativePath ? `File: ${context.relativePath}` : undefined,
            context?.languageId ? `Language: ${context.languageId}` : undefined,
            context ? `Editor lines: ${context.lineCount}` : 'No active editor context',
        ]
            .filter((value): value is string => Boolean(value))
            .join(' | ');

        const markdown = this.renderMarkdown(prompt, contextSummary, plans, assessment, configSummary);

        return {
            title: 'Data Program Multi-Stack Optimization Report',
            prompt,
            contextSummary,
            stacks: plans,
            assessment,
            configSummary,
            markdown,
        };
    }

    private detectStacks(prompt: string, context: CodeContext | undefined): TechStack[] {
        const defaultStacks = this.configManager.getDefaultStacks();
        const matches = new Set<TechStack>();
        const text = `${prompt}\n${context?.languageId ?? ''}\n${context?.selectionText ?? ''}`.toLowerCase();

        if (/(sql|query|table|join|index|database|etl|warehouse)/.test(text)) matches.add('sql');
        if (/(python|pandas|numpy|polars|notebook|ml|spark|py)/.test(text)) matches.add('python');
        if (/(react|tsx|jsx|frontend|ui|component|hook|state)/.test(text)) matches.add('react');
        if (/(java|spring|jvm|backend|thread|cache|service)/.test(text)) matches.add('java');

        switch (context?.languageId) {
            case 'sql':
                matches.add('sql');
                break;
            case 'python':
                matches.add('python');
                break;
            case 'javascriptreact':
            case 'typescriptreact':
                matches.add('react');
                break;
            case 'java':
                matches.add('java');
                break;
        }

        return matches.size > 0 ? Array.from(matches) : defaultStacks;
    }

    private buildPlan(stack: TechStack, _prompt: string, context: CodeContext | undefined): StackOptimizationPlan {
        const config = this.configManager.getStackConfig(stack);
        const detectedBy = this.buildDetectors(stack, context);

        switch (stack) {
            case 'sql':
                return {
                    stack,
                    summary: '聚焦查询计划、索引布局、扫描范围与数据访问模式的数据库层优化。',
                    detectedBy,
                    config,
                    recommendations: [
                        this.rec(
                            '查询性能优化',
                            '优先减少全表扫描、回表和不必要排序，提升 OLTP/分析查询吞吐。',
                            [
                                '对高频过滤列、关联列和排序列建立复合索引，并按 where/join/order by 顺序设计索引前缀。',
                                '避免 `select *`，仅返回下游处理真正需要的列，减少 I/O 与网络传输。',
                                '将复杂子查询改写为可下推谓词的形式，必要时拆分为物化中间表或增量汇总表。',
                            ],
                            ['P95 query latency', 'logical reads / buffer gets', 'rows scanned vs rows returned'],
                            [
                                `maxIndexSuggestions=${config.parameters.maxIndexSuggestions}`,
                                `analyzeExecutionPlan=${config.parameters.analyzeExecutionPlan}`,
                            ],
                        ),
                        this.rec(
                            '索引与执行计划分析',
                            '建立“索引建议 + explain 计划 + 回归验证”的闭环，避免只加索引不验证。',
                            [
                                '对慢 SQL 固化 `EXPLAIN`/`EXPLAIN ANALYZE` 输出，关注扫描方式、回表次数、hash join/sort spill。',
                                '对多条件查询推荐覆盖索引或包含列索引，降低 bookmark lookup 成本。',
                                '对于大表统计分析，评估分区裁剪、聚簇键设计和冷热分层策略。',
                            ],
                            ['index hit ratio', 'execution plan cost', 'temp spill count'],
                            [
                                '在 CI 或 DBA review 流程中附带 explain plan 快照。',
                                '对索引变更设置回滚窗口与写放大监控。',
                            ],
                        ),
                    ],
                };
            case 'python':
                return {
                    stack,
                    summary: '聚焦数据处理链路中的算法复杂度、对象分配、批处理与并行执行。',
                    detectedBy,
                    config,
                    recommendations: [
                        this.rec(
                            '算法与数据处理优化',
                            '优先用向量化、批量处理与流式管道替代逐行 Python 解释器循环。',
                            [
                                'Pandas/NumPy/Polars 场景优先使用向量化表达式、groupby-agg、批量 merge，减少 Python for-loop。',
                                '对超大数据集采用分块读取、生成器与懒加载，避免一次性将全部数据载入内存。',
                                '对热点函数使用 `cProfile`、`line_profiler` 或 `py-spy` 定位复杂度瓶颈。',
                            ],
                            ['records/sec', 'peak RSS', 'CPU utilization'],
                            [
                                `memoryBudgetMb=${config.parameters.memoryBudgetMb}`,
                                `enableParallelHints=${config.parameters.enableParallelHints}`,
                            ],
                        ),
                        this.rec(
                            '内存管理与并行计算',
                            '减少中间对象复制，并在 CPU/IO 场景下分别选择合适的并行模型。',
                            [
                                '对 CPU 密集型任务使用 multiprocessing、joblib 或 Ray；对 I/O 密集型任务使用 asyncio / concurrent.futures。',
                                '使用 `__slots__`、数据类压缩、对象复用和 inplace 操作降低临时对象数量。',
                                '针对 ETL 管道引入批次大小配置和失败重试策略，兼顾吞吐与内存上限。',
                            ],
                            ['worker efficiency', 'GC pause frequency', 'batch completion time'],
                            [
                                '对并行任务设置输入切分策略和顺序一致性约束。',
                                '对内存上限建立采样告警与 OOM 预案。',
                            ],
                        ),
                    ],
                };
            case 'react':
                return {
                    stack,
                    summary: '聚焦数据密集型前端页面的渲染、状态流、网络缓存与大表展示性能。',
                    detectedBy,
                    config,
                    recommendations: [
                        this.rec(
                            '数据展示与渲染性能优化',
                            '针对大数据表、图表与筛选交互，降低重复渲染和长列表卡顿。',
                            [
                                '列表/表格超过阈值时启用 virtualization，避免一次性挂载全部节点。',
                                '将昂贵计算通过 `useMemo` 缓存，将稳定回调通过 `useCallback` 固定，减少子组件重渲染。',
                                '图表层按交互频率拆分组件，使用懒加载和骨架屏减少首屏阻塞。',
                            ],
                            ['commit duration', 'render count', 'time to interactive'],
                            [
                                `stateStrategy=${config.parameters.stateStrategy}`,
                                `virtualizationThreshold=${config.parameters.virtualizationThreshold}`,
                            ],
                        ),
                        this.rec(
                            '状态管理与数据获取改进',
                            '用服务端状态缓存与局部状态拆分降低全局状态竞争。',
                            [
                                '优先使用 TanStack Query / SWR 处理服务端数据缓存、失效与重取，避免自建复杂请求状态机。',
                                '按页面域拆分状态容器，避免 Context 大范围广播导致整树刷新。',
                                '对高频筛选与搜索加入防抖、分页与增量获取策略。',
                            ],
                            ['cache hit ratio', 'state update fan-out', 'API request count'],
                            [
                                '对关键页面启用 React Profiler 与 Web Vitals。',
                                '为表格/图表交互建立 FPS 与长任务统计。',
                            ],
                        ),
                    ],
                };
            case 'java':
                return {
                    stack,
                    summary: '聚焦后端数据服务的吞吐、缓存命中、多线程调度与 JVM 运行时稳定性。',
                    detectedBy,
                    config,
                    recommendations: [
                        this.rec(
                            '后端数据处理与批量化优化',
                            '减少单请求重复计算和远程调用开销，提升服务吞吐与稳定性。',
                            [
                                '对批处理场景引入批量查询、批量写入和流式返回，避免 N+1 与逐条数据库访问。',
                                '在服务层构建 DTO 聚合与数据预取策略，减少跨服务重复序列化与反序列化。',
                                '对高成本计算链路增加异步编排与超时控制，防止线程长时间阻塞。',
                            ],
                            ['request throughput', 'database round trips', 'queue wait time'],
                            [
                                `threadPoolSize=${config.parameters.threadPoolSize}`,
                                `cacheStrategy=${config.parameters.cacheStrategy}`,
                            ],
                        ),
                        this.rec(
                            '缓存与多线程处理增强',
                            '结合 JVM 线程池、缓存层和指标采集建立稳定的服务端优化闭环。',
                            [
                                '本地热点缓存优先使用 Caffeine，跨实例共享缓存使用 Redis，并设置明确的 TTL/失效策略。',
                                '按 CPU 核数和任务类型设置专用线程池，避免公共线程池被阻塞任务耗尽。',
                                '通过 Micrometer + Prometheus + JFR/Async Profiler 持续观察 GC、锁竞争和线程利用率。',
                            ],
                            ['cache hit ratio', 'thread pool saturation', 'GC pause time'],
                            [
                                '为缓存击穿与降级路径设计熔断/限流策略。',
                                '为线程池拒绝策略和队列长度配置告警阈值。',
                            ],
                        ),
                    ],
                };
        }
    }

    private buildDetectors(stack: TechStack, context: CodeContext | undefined): string[] {
        const detectors = [`prompt:${stack}`];
        if (context?.languageId) {
            detectors.push(`language:${context.languageId}`);
        }
        if (context?.relativePath) {
            detectors.push(`file:${context.relativePath}`);
        }
        if (context?.selectionText) {
            detectors.push('selection:present');
        }
        return detectors;
    }

    private buildAssessment(plans: StackOptimizationPlan[]): PerformanceAssessment {
        const recommendationCount = plans.reduce((total, plan) => total + plan.recommendations.length, 0);
        const monitoring = [
            '建立优化前后基线：吞吐、P95/P99 延迟、峰值内存、错误率。',
            '按技术栈分别接入数据库监控、应用指标、前端性能指标和 JVM 指标。',
            '对每项优化建立回滚条件，防止吞吐提升但资源消耗失控。',
        ];

        const validationChecks = [
            'SQL: 对核心慢查询保留 explain plan 与索引变更前后对比。',
            'Python: 对热点 ETL 或分析任务保留基准数据集和峰值内存记录。',
            'React: 对关键页面保留 render profiler、Web Vitals 和长任务日志。',
            'Java: 对关键接口保留压测结果、GC 日志和线程池饱和情况。',
        ];

        return {
            score: Math.min(100, 60 + plans.length * 8 + recommendationCount * 4),
            expectedBenefits: [
                '减少跨层数据处理中的重复扫描、重复渲染和重复计算。',
                '通过统一配置和监控体系提升多技术栈协作时的可维护性。',
                '为后续新增 Spark、Flink、Go、Node.js 等技术栈保留扩展槽位。',
            ],
            monitoring: this.configManager.isMonitoringEnabled() ? monitoring : ['Monitoring disabled by configuration.'],
            validationChecks,
        };
    }

    private renderMarkdown(
        prompt: string,
        contextSummary: string,
        plans: StackOptimizationPlan[],
        assessment: PerformanceAssessment,
        configSummary: string[],
    ): string {
        const stackSections = plans.map(plan => {
            const recommendationSections = plan.recommendations.map(recommendation => [
                `### ${recommendation.title}`,
                recommendation.summary,
                '',
                '**建议动作**',
                ...recommendation.actions.map(action => `- ${action}`),
                '',
                '**观测指标**',
                ...recommendation.metrics.map(metric => `- ${metric}`),
                '',
                '**配置提示**',
                ...recommendation.configHints.map(hint => `- ${hint}`),
            ].join('\n')).join('\n\n');

            return [
                `## ${plan.stack.toUpperCase()} 优化方案`,
                `- 结论: ${plan.summary}`,
                `- 检测依据: ${plan.detectedBy.join(', ')}`,
                recommendationSections,
            ].join('\n\n');
        }).join('\n\n');

        return [
            '# Data Program 多语言开发优化报告',
            '',
            '## 目标说明',
            `- 原始需求: ${prompt}`,
            `- 上下文: ${contextSummary}`,
            '',
            '## 统一配置摘要',
            ...configSummary.map(line => `- ${line}`),
            '',
            '## 技术栈优化方案',
            stackSections,
            '',
            '## 性能监控与效果评估',
            `- 综合评分: ${assessment.score}/100`,
            '- 预期收益:',
            ...assessment.expectedBenefits.map(item => `- ${item}`),
            '- 监控机制:',
            ...assessment.monitoring.map(item => `- ${item}`),
            '- 验证清单:',
            ...assessment.validationChecks.map(item => `- ${item}`),
        ].join('\n');
    }

    private rec(
        title: string,
        summary: string,
        actions: string[],
        metrics: string[],
        configHints: string[],
    ): OptimizationRecommendation {
        return { title, summary, actions, metrics, configHints };
    }
}
