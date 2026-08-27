# Codex starter prompts for HuddleCanvas

## Project orientation
Read `AGENTS.md`, `docs/WORK_PROJECT_CONTEXT.md`, and `docs/PRODUCT_PROJECT_TRACKER.md`. Inspect root `index.html`. Tell me:
1. what is implemented,
2. what is prototype-only,
3. top architecture risks, and
4. the next milestone task.
Do not edit files yet.

## Bug workflow
Reproduce and trace this bug: **[paste bug]**. Identify the root cause. Propose the smallest safe fix first. After approval, implement it and run the HuddleCanvas QA checklist from `AGENTS.md`.

## UI review
Review this screenshot against the current code. Identify visual hierarchy, spacing, discoverability, accessibility, and state-feedback issues. Propose improvements that keep permanent toolbar density low. Do not imitate a competitor's protected trade dress; use the HuddleCanvas design language.

## Hosted Alpha architecture
Design a Hosted Alpha migration plan from the single-file prototype to React/TypeScript. Keep a working demo throughout migration. Define the board document schema, persistence boundaries, realtime collaboration layer, permissions, media storage, AI tool boundary, tests, and migration sequence.

## AI canvas actions
Design a server-side AI tool contract for operations like cluster selected stickies, create quiz, summarize frame, convert decisions to action cards, and generate a process diagram. API keys must remain server-side. Require structured tool outputs and validate board mutations before applying them.

## Release QA
Create a release test matrix for the current branch and mark tests as automated-candidate vs manual. Include browser, viewport, keyboard, timer, board overflow, backgrounds, imports, exports, grouping, voting, localStorage pressure, and recovery.
