# ADR 0003: Capability-based role policy

- Status: Accepted
- Date: 2026-09-10
- Milestone: M3.1 Hosted Alpha foundation

## Context

HuddleCanvas needs simple user-facing roles while keeping sensitive actions such as sharing, deletion, and version restoration narrowly scoped. Guest workshop participation must not accidentally grant durable editing rights.

## Decision

Authorize named capabilities rather than scattering role comparisons through the application. The initial roles are Owner, Editor, Commenter, Viewer, and Guest Session.

| Capability      | Owner | Editor | Commenter | Viewer | Guest session |
| --------------- | :---: | :----: | :-------: | :----: | :-----------: |
| Read board      |  Yes  |  Yes   |    Yes    |  Yes   |      Yes      |
| Edit board      |  Yes  |  Yes   |    No     |   No   |      No       |
| Comment         |  Yes  |  Yes   |    Yes    |   No   |      No       |
| Vote            |  Yes  |  Yes   |    Yes    |   No   |      Yes      |
| Facilitate      |  Yes  |  Yes   |    No     |   No   |      No       |
| Share           |  Yes  |   No   |    No     |   No   |      No       |
| Delete board    |  Yes  |   No   |    No     |   No   |      No       |
| Create version  |  Yes  |  Yes   |    No     |   No   |      No       |
| Restore version |  Yes  |   No   |    No     |   No   |      No       |

Guest Session is intentionally narrow and temporary. Expiry, passcode, and domain restrictions will be enforced by the hosted API when guest links are implemented.

## Consequences

- UI visibility can mirror the policy, but the server remains authoritative.
- New roles can be composed from capabilities without rewriting feature code.
- Sensitive actions default to denied unless explicitly granted.
- Anonymous workshop voting remains possible without opening the full board editor.
