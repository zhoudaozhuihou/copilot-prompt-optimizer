export interface HistoryRecord {
    timestamp: number;
    rawPrompt: string;
    optimizedPrompt: string;
    intent: string;
    context: any;
}

export class HistoryManager {
    private readonly STORAGE_KEY = 'copilotPromptOptimizer.history';

    constructor(private globalState: any) {}

    public getHistory(): HistoryRecord[] {
        return this.globalState.get(this.STORAGE_KEY, []);
    }

    public addRecord(record: HistoryRecord) {
        const history = this.getHistory();
        // Keep last 50 records
        if (history.length >= 50) {
            history.pop();
        }
        history.unshift(record);
        this.globalState.update(this.STORAGE_KEY, history);
    }

    public clearHistory() {
        this.globalState.update(this.STORAGE_KEY, []);
    }
}
