# Hard engineering principles

## Objective constraints (zero waiver for owned source)

| Gate | Threshold | Enforcement |
|---|---:|---|
| Authored file length (code, tests, docs, config) | **≤400 physical lines** | `.genesis/tools/guard.py` over every tracked authored file |
| Function or method length | **≤50 physical lines** | `.genesis/tools/guard.py --functions` (Python AST, lizard, shell bound) + declared parser gates |
| Cyclomatic complexity per function | **≤10** | same gate; classic McCabe incl. boolean operators |
| Inline suppressions of these limits | **0** | `.genesis/tools/guard.py` bypass scan + Claude pre-edit hook |
| Domain/layer import cycles | **0** | dependency graph in architecture gate |
| Unresolved imports | **0** | compiler / resolver / dependency graph |
| Copy/pasted business rule implementations | **0** | domain ownership + duplication tool + review |
| New untested authorization bypass | **0** | trusted-side negative integration tests |
| Unowned persisted state or design token | **0** | owner map + type/schema/design lint |

Physical lines include comments and blank lines. No threshold increases, `eslint-disable`, `noqa`, generated-but-manually-edited workarounds, broad baseline ignores or selective paths to hide owned code. Vendor dependencies and actually generated outputs are classified outside owned source, never manually maintained. If a dependency generator emits oversized files, its actual generated output need not be edited, but manually authored generator/source code remains subject to these limits.

## Organization

1. Partition by **business capability** or cohesive domain, not arbitrary file-type buckets alone. Each feature: public interface, model/invariants, use cases, adapters, tests.
2. Domain is technology-independent. It may refer to stable ports/contracts; transport and infrastructure adapt to it.
3. One reason to change per module. Keep helper functions adjacent to their owning capability. Promote to shared only after demonstrating genuine cross-domain invariance.
4. For cross-feature reuse: one authoritative named API, clear types and dependency direction. Don't create a global `helpers.ts` or dependency-inject everything unnecessarily.
5. Business policies belong to the server/trusted layer and one owner. UI may display/validate for UX but cannot define authority.
6. API contracts, domain events, schemas, database writes, identity types, money/time rules and migrations have documented ownership and compatibility strategy.
7. Imports should expose intent. Explicit dependencies over implicit registries or wildcard re-exports. Avoid barrel files that hide ownership or cause cycles.
8. Changes should be **vertical and narrow**: UI + use case + contract + tests where necessary, not repo-wide renames.
9. Prefer simple direct composition. Abstract when independently varying behavior exists, not “future flexibility.”
10. No shadow copies of design tokens, contracts, validators, endpoint clients, auth checks or configuration.

## Performance and complexity

- Prefer a single bounded call over redundant reads and cross-service chains. Batch when safe; use pagination for unbounded lists.
- Track N+1 database access, unbounded retries, request timeouts, concurrency, backpressure, cancellation and idempotency.
- Model ownership/invariants and indexes before scaling data. Use profiling rather than guessing performance bottlenecks.
- Create an explicit module move/deletion path: locate callers, tests, dynamic entry points, migrations and scripts; then remove verified dead code.

## Working agreement

- Document *why* only for non-obvious decisions; name code for *what*.
- One source of truth for each invariant. Duplication in test fixtures and independent client UX behavior is assessed semantically, not merged blindly.
- Keep docs accurate when public contracts, boundaries or operating behavior change.
- Reversible small PRs, meaningful commit history, clear rollback story.
- No exact number of folders, architecture layers or dependencies is universally ideal. Choose the **smallest architecture that meets verified requirements** without relaxing hard limits.
