# ADR 0002: Pure commands and server authority

- Status: Accepted
- Date: 2026-09-10
- Milestone: M3.1 Hosted Alpha foundation

## Context

Direct UI mutation makes undo, authorization, collaboration, replay, and recovery hard to reason about. A hosted product also cannot trust a browser to decide whether a user may edit, facilitate, share, or restore a board.

## Decision

Express durable board changes as typed commands applied by a pure, immutable command function. Commands validate object existence, lock state, hierarchy, ordering, dimensions, and connector cleanup. Accepted commands advance the board generation.

The eventual API/realtime boundary is authoritative. It authenticates the session, checks a named capability, validates the command and base generation, persists the result, and only then broadcasts acceptance. The client may optimistically preview a command but must reconcile with the authoritative result.

Presence and cursor movement are ephemeral messages. They do not modify the durable board document.

## Consequences

- The same command semantics can power local tests, API validation, replay, undo, and collaboration.
- Locked objects are protected consistently instead of only visually.
- Connector endpoints remain valid when their target is removed.
- Rejected or stale commands have explicit outcomes.
- A future CRDT choice must preserve these authority and durability rules.
