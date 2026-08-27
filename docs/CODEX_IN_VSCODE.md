# Using Codex in Visual Studio Code for HuddleCanvas

## What Codex is

Codex is OpenAI's coding agent. In the IDE it can use the files you have open and code you select as context, explain the codebase, edit files, help debug, review diffs, run commands when permitted, and delegate longer tasks to cloud workflows.

OpenAI's current Codex IDE documentation supports VS Code and compatible editors. The official quickstart says to install/enable the Codex extension, open the Codex sidebar, sign in, and start a chat with the project already open.

## 1. Install the official extension

In VS Code:

1. Open **Extensions** with `Ctrl+Shift+X`.
2. Search for **Codex – OpenAI's coding agent**.
3. Confirm the publisher is OpenAI. The Marketplace identifier is currently `openai.chatgpt`.
4. Install it.

Official Marketplace page:
https://marketplace.visualstudio.com/items?itemName=openai.chatgpt

## 2. Open Codex

After installation, click the **Codex** icon in the Activity Bar. If it is not visible:

1. Press `Ctrl+Shift+P`.
2. Run **Codex: Open Codex Sidebar**.

Sign in with your ChatGPT account when prompted. OpenAI currently makes Codex available through ChatGPT plans with plan-dependent limits.

## 3. Give Codex the right project context

Open this repository as a folder, not just `index.html`. Codex can then use repository context.

Before asking for feature work, point Codex to:
- `AGENTS.md`
- `docs/WORK_PROJECT_CONTEXT.md`
- `docs/PRODUCT_PROJECT_TRACKER.md`

A strong first prompt is:

> Read AGENTS.md, docs/WORK_PROJECT_CONTEXT.md, and docs/PRODUCT_PROJECT_TRACKER.md. Then inspect index.html. Summarize the architecture, current milestone, top risks, and the next highest-priority engineering task. Do not edit anything yet.

## 4. Use Codex in two passes

### Pass A — Analyze/plan
Ask it to inspect the relevant code and produce a plan before editing.

Example:

> Investigate why vote feedback is not obvious for first-time users. Trace the event flow and current UI state. Propose a minimal change that improves discoverability without adding toolbar clutter. Do not edit yet.

### Pass B — Implement/test
After you agree with the plan:

> Implement the approved change. Preserve existing behavior. Run every locally available validation you can, then give me a concise diff summary and manual QA checklist.

This is safer than asking an agent to make a broad unreviewed rewrite.

## 5. Use open-file and selection context

OpenAI's IDE docs emphasize that Codex can use open files, selected code, and recent chats as context. For a focused bug:

1. Open `index.html`.
2. Select the relevant function.
3. Ask: `Explain this selection and identify any state-management bugs that could affect grouping.`

## 6. Review every edit

Codex can show focused diffs beside your code. Review them before keeping changes. Always inspect `git diff` before committing.

Useful terminal commands:

```bash
git status
git diff
git diff --staged
```

## 7. Use Git checkpoints

OpenAI's current IDE quickstart explicitly recommends Git checkpoints before and after tasks so changes can be reverted. For HuddleCanvas:

```bash
git add .
git commit -m "Checkpoint before lasso refactor"
```

After validated work:

```bash
git add .
git commit -m "Improve lasso selection and grouping"
```

## 8. Good HuddleCanvas prompts

### QA bug
> Read AGENTS.md. Reproduce and trace this bug: [describe bug]. Identify root cause first. Make the smallest safe fix. Then give me a regression checklist that includes boards, templates, ink, images, timer, backgrounds, and export.

### UI improvement
> Treat the current UI as a high-end collaboration product. Improve [component] without increasing permanent toolbar density. Use the existing GETITECH/HuddleCanvas design language and SVG icon style. Preserve keyboard accessibility.

### Refactor preparation
> Analyze index.html and propose boundaries for extracting board state, rendering, persistence, tools, and UI into a future React/TypeScript architecture. Do not rewrite the app yet. Produce an incremental migration plan that keeps the prototype working at every step.

### Hosted Alpha
> Using the product tracker, design the Hosted Alpha architecture for auth, workspaces, board storage, media storage, realtime collaboration, guest links, version history, and server-side AI. Separate must-have alpha scope from later enterprise scope.

### Test plan
> Build a release QA matrix for HuddleCanvas covering Chrome/Edge/Firefox/Safari, desktop viewport sizes, keyboard-only interaction, pen/mouse/touch assumptions, long board lists, localStorage exhaustion, imports/exports, and failure recovery.

## 9. Security rules

- Never ask Codex to place OpenAI or other provider API keys inside `index.html`.
- Keep secrets in server-side environment variables in the hosted product.
- Review any command that modifies files outside the repository or requests broad network/system access.
- Treat agent output as code to review, not code to trust automatically.

## 10. When to delegate to Codex cloud

Use local IDE work for focused changes. Delegate longer tasks when they benefit from independent execution—for example a large test suite, a multi-file refactor, or a production architecture branch. OpenAI's IDE extension supports moving between local and cloud tasks while retaining context.

## Official OpenAI references
- Codex IDE docs: https://developers.openai.com/codex/ide
- Codex product: https://openai.com/codex/
- Codex + ChatGPT plan help: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
