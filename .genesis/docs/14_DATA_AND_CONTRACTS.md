# Data, API and consistency ownership

Apply the applicable sections to persistent products, APIs, queues, files, offline apps and data pipelines. Do not introduce a database or distributed broker when the product has no such need.

## Ownership of state

- Every authoritative aggregate/entity has one named owner, write path, validation rule and transaction boundary.
- Cross-interface calls (UI/API/CLI/background task) invoke that same use case, not competing copies of business rules.
- Normalize reference/master data to one owner; define canonical ID semantics, money units, timezone and rounding once.
- Treat schema changes as versioned contracts; maintain backward compatibility or an approved upgrade path. Persisted migrations are immutable once deployed.
- Store secrets separately from business records. Classify personal/regulated data, retention, deletion, masking and auditability.

## Consistency and concurrency

- Specify which operations require atomic transactions, optimistic versions, unique constraints, compare-and-swap, row locks or idempotency keys.
- Document behavior for concurrent updates, duplicate delivery, retries, partial failure, crashed workers and cancel/restart.
- **Never read state, perform a slow operation, then blindly overwrite the full state**. Save the owned fields against a fresh version, using transaction/locking or version-check as appropriate.
- For offline-first systems, explicitly select sync/merge/conflict strategy and test competing edits; do not assume last-write-wins is safe.
- Database indexes and query plans follow real access paths; test N+1 and unbounded reads on representative data.

## Contract boundaries

- Define request/response/data-event schemas as versioned single sources; generate clients only when generation is repeatable and does not fragment ownership.
- Keep parsing and structural validation at boundaries, domain invariants in the domain, and authorization at each trusted entry point.
- Always make error types, status codes, pagination, versioning, timeouts, file limits and observability semantics predictable.
- Explicitly test consumer compatibility and behavior of old clients where required. No independent hand-maintained copies of API schema across services.

## Minimal proof cases

1. Valid create/read/update/delete according to roles and data ownership.
2. Cross-user, cross-tenant and object-level denials (where accounts/tenants exist).
3. Duplicate request, conflicting update and partial-write rollback.
4. Corrupt input, cancellation or interrupted migration.
5. Crash and restart do not silently erase confirmed work.

A promise of durability without a tested crash/recovery path is not enough. Use real local transaction and concurrency tests for critical operations; avoid production data.
