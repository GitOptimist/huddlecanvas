# Visual Studio Code guide for HuddleCanvas

This is a Windows-first guide; macOS shortcuts are included where useful.

## 1. Install Visual Studio Code

Download and install VS Code from the official Visual Studio Code website. During Windows setup, enabling **Add to PATH** and **Open with Code** is useful.

Also install Git if it is not already installed.

## 2. Open the HuddleCanvas project

1. Extract `HuddleCanvas-GitHub-Ready-v8.zip`.
2. Open VS Code.
3. Choose **File → Open Folder…**.
4. Select the extracted `HuddleCanvas-GitHub-Ready-v8` folder.
5. If VS Code asks whether you trust the authors of the files, review the folder and choose **Trust** because this is your own project package.

The Explorer on the left should show `index.html`, `AGENTS.md`, `docs/`, `archive/`, and `.github/`.

## 3. Understand the important files

- `index.html` — current live prototype.
- `AGENTS.md` — product/engineering instructions for Codex and future developers.
- `docs/WORK_PROJECT_CONTEXT.md` — project history and continuation context.
- `docs/PRODUCT_PROJECT_TRACKER.md` — roadmap/milestones/backlog.
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment.
- `archive/` — historical versions; reference only.

## 4. Preview the app locally

The app is static. You can double-click `index.html`, but for development use a local server.

In VS Code choose **Terminal → New Terminal**, then run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in your browser. Stop the server with **Ctrl+C**.

If `python` is not recognized on Windows, try:

```bash
py -m http.server 8000
```

## 5. Edit code safely

Before a meaningful change:

```bash
git status
git add .
git commit -m "Checkpoint before feature X"
```

Then edit `index.html`. VS Code autosaves only if you enable it; otherwise use **Ctrl+S** (Windows/Linux) or **Cmd+S** (macOS). Refresh the browser to inspect the result.

## 6. Useful VS Code features

- **Ctrl+P / Cmd+P** — quickly open a file.
- **Ctrl+Shift+P / Cmd+Shift+P** — Command Palette.
- **Ctrl+Shift+F / Cmd+Shift+F** — search across the whole project.
- **Ctrl+`** — show/hide integrated terminal.
- **Source Control icon** — review Git changes and commits.
- Right-click a changed file → open diff to inspect changes before committing.

## 7. Recommended extensions

Keep the extension list small initially:
- **Codex – OpenAI's coding agent**
- Optional formatter/linter extensions only after the Hosted Alpha refactor introduces a package/toolchain.

The current prototype has no Node dependency or build command. Avoid installing random extensions just to make the static prototype run.

## 8. A simple daily workflow

1. Pull current work: `git pull`.
2. Read the current milestone in `docs/PRODUCT_PROJECT_TRACKER.md`.
3. Create a checkpoint/branch.
4. Ask Codex to analyze the task before editing.
5. Review its proposed changes.
6. Run the app and the QA checklist.
7. Review `git diff`.
8. Commit with a clear message.
9. Push to GitHub.
10. Check the GitHub Pages deployment if the change belongs on the demo site.
