# ADR 0001: Canonical versioned board document

- Status: Accepted
- Date: 2026-09-10
- Milestone: M3.1 Hosted Alpha foundation

## Context

The v8 prototype stores several independent arrays (`items`, drawing `ops`, and `media`) in browser storage. That shape was effective for product research, but it cannot safely support server validation, migrations, bound connectors, nested grouping, durable recovery, or concurrent commands.

## Decision

Use one typed, versioned `BoardDocument` as the product boundary. Every visible canvas entity is a `BoardObject` in an ID-keyed record. Shared fields cover transforms, dimensions, hierarchy, ordering, locks, visibility, and audit metadata. Object-specific fields form a discriminated union.

Documents are validated at trust boundaries and serialized canonically. Schema upgrades run through an ordered migration registry. The v8 importer reads legacy input without modifying it and returns an explicit warning/error report for any lossy conversion.

## Consequences

- API, realtime, export, renderer, and recovery work share one contract.
- Unsupported or dangling data fails early instead of becoming silent canvas corruption.
- Schema changes require a migration and fixture coverage.
- Binary media is referenced by asset ID; it is never embedded in the board document.
- The v8 prototype remains available as a research baseline, not a second production model.
