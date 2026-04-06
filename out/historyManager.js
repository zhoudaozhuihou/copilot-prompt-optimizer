"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryManager = void 0;
class HistoryManager {
    globalState;
    STORAGE_KEY = 'copilotPromptOptimizer.history';
    constructor(globalState) {
        this.globalState = globalState;
    }
    getHistory() {
        return this.globalState.get(this.STORAGE_KEY, []);
    }
    addRecord(record) {
        const history = this.getHistory();
        // Keep last 50 records
        if (history.length >= 50) {
            history.pop();
        }
        history.unshift(record);
        this.globalState.update(this.STORAGE_KEY, history);
    }
    clearHistory() {
        this.globalState.update(this.STORAGE_KEY, []);
    }
}
exports.HistoryManager = HistoryManager;
//# sourceMappingURL=historyManager.js.map