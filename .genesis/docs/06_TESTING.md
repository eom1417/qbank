# Testing strategy: contract, behavior and failure

## Required from the first vertical slice

- Unit tests for deterministic domain invariants, edge cases and errors.
- Integration tests against real boundary wiring for high-risk state changes, database transactions, permissions and synchronization.
- Contract tests for public API/schema/message formats and compatibility.
- Smoke/E2E tests for the **three highest-value journeys**, including denial and recoverable failure.
- Security tests: cross-user, cross-role, invalid token, missing auth, input abuse and secrets/log redaction.
- Regression test reproduces each confirmed bug before the fix, passes afterward. Don't accept tests that would pass with the defect reintroduced.

## Evidence quality

- Meaningful assertions and isolation; no broad snapshots of irrelevant data, no test with zero assertion.
- No dependence on order, current wall clock, external network or shared mutable DB without explicit isolation. Fake/clock freeze for time; seeded deterministic test data.
- Tests must be able to fail against the relevant broken behavior (mutation proof for serious security fixes).
- Never claim a failing/flaky test passed because a later retry did. Diagnose and report.
- Test the real authority: service permission guard AND route/data boundary, not UI-only disabled buttons.
- Tests and first-party test helpers count toward 400/50/10 limits.

## Fast versus full verification

- On edit: targeted tests for affected domain plus fast style/type/architecture gate.
- On PR: full gate once on final tree; repeat only when changed code invalidates previous results.
- Before release: complete test suite, smoke/E2E, migration backup+restore validation and live config checks where relevant.
- Mandatory commands live in `engineering.json`. Never report a gate as passed if command missing or unavailable.
- Coverage is a feedback tool, not a substitute for tests of behavior and security boundaries.
