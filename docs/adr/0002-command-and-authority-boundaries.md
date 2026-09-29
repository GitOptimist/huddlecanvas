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

## Hosted client migration status

`apps/web/src/App.tsx` has one `dispatchBoardCommand` path for durable commands.
That path applies the pure command once, records one undo entry, and marks the
result for autosave. Object movement, resize, rotation, lock/unlock, deletion,
and stroke erasure use this boundary.

The temporary `updateDocument` compatibility path remains for object creation,
duplication, sticky/text content and style edits, and board-title typing. These
mutations still clone the document and advance generation, but should move to
typed commands incrementally. New durable interactions must not add more direct
mutation call sites.

The browser command dispatcher is not an authorization boundary. A follow-up
milestone must expose a server-authoritative command API that authenticates the
actor, checks capabilities and base generation, applies the same command
semantics, persists the accepted result, and returns the canonical document.
That backend migration is intentionally outside the M3.5.1 recovery slice.
