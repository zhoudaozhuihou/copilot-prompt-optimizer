# Copilot Prompt Optimizer

**Copilot Prompt Optimizer** is a powerful VS Code extension designed to automatically enhance and rewrite your raw prompts into highly effective, context-aware instructions for GitHub Copilot Chat. It leverages advanced Prompt Engineering best practices (derived from tools like Claude Code) to improve Copilot's accuracy, modularity, and code generation quality.

## Features

- 🧠 **Intent Recognition & Semantic Analysis**: Analyzes your raw input (e.g., "fix this") and determines the underlying intent (e.g., "debugging an out-of-bounds error").
- 📄 **Context Awareness**: Automatically injects your active editor's programming language, current selection, and surrounding code into the prompt constraints.
- 📚 **Multi-Version Optimization**: Provides multiple versions of the optimized prompt:
  - **Balanced (Default)**: A strong, general-purpose prompt.
  - **Concise**: A shorter, to-the-point version.
  - **Detailed**: A step-by-step, highly constrained version mimicking Senior Developer thinking processes.
- ⚡ **Direct Copilot LM Integration**: Calls the `vscode.lm` API under the hood, meaning your prompt optimization happens directly through Copilot's powerful models.
- 🕒 **History Management**: Keeps track of your recently optimized prompts.

## How to Use

1. Open a file you want to work on in VS Code.
2. Select a block of code (optional, but highly recommended for better context).
3. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
4. Search for and execute **`Copilot Optimizer: Enhance Prompt`**.
5. Enter your initial, simple prompt idea (e.g., "Refactor this to use async/await").
6. Wait for the optimizer to process the prompt. A Webview panel will open showing the recognized intent, actionable suggestions, and multiple optimized prompt versions.
7. Click **"Send to Copilot"** to automatically inject the prompt into your Copilot Chat window, or click **"Copy to Clipboard"**.

## Requirements

- **VS Code ^1.90.0** or newer.
- **GitHub Copilot Chat** extension installed and authorized. This extension relies on the `vscode.lm` Language Model API provided by Copilot.

## Extension Settings

This extension contributes the following settings:

* `copilotPromptOptimizer.includeContext`: Enable/disable automatic inclusion of active editor text and selections. (Default: `true`)
* `copilotPromptOptimizer.defaultTemplate`: The default persona/template to use (e.g., `senior-developer`, `code-reviewer`).

## Release Notes

### 1.0.0
Initial release of Copilot Prompt Optimizer.

---

*Built with insights from the Claude Code CLI architecture.*
# copilot-prompt-optimizer
