# Architecture blueprint and dependency policy

## Default model (adapt to the product)

```text
interface (HTTP / CLI / UI / worker)
        ↓
application use cases (orchestration, transactions)
        ↓
domain (rules, invariants, types, ports)
        ↑
infrastructure adapters (DB, queues, network, storage)
```

The arrows express allowable **source-code dependencies**, not necessarily runtime call order. The domain does not import framework/controller/database/UI implementations. Infrastructure implements domain/application ports. A small CLI may use fewer layers; **ownership and direction** remain enforceable.

## For every capability, declare

| Attribute | Fill in during bootstrap |
|---|---|
| Capability name & purpose | … |
| Owning module/path | … |
| Public API/contract | … |
| Core state and data owner | … |
| Legal imports | … |
| Forbidden imports | … |
| Test owner | … |
| Operational/secrets concerns | … |

## Architecture control rules

- No cross-capability access to internal implementation. Cross via named public contract or use case.
- No cyclic domain dependencies, including re-export and type-only cycles where your language tooling resolves them.
- Do not duplicate query/mutation behavior across controller, job, CLI and UI; share a use case and adapt entry points.
- Database: one authority for writes to a given aggregate, explicit transaction boundaries; migrations immutable after deployment.
- Validation: request shape at boundary; invariant checks in domain; authorization at every trusted entry point.
- Cross-cutting services (logging, time, configuration, tracing, auth) own their specific responsibility and do not become god objects.
- Contract changes: update schema/type, callers, tests and migration/compatibility notes together.
- Dynamic imports, reflection, route registration and external plugins must be declared as graph entry points when configuring dead-code and dependency tools.

## Ownership index

During bootstrap write an actual table: `capability -> owner path -> contract -> tests`. If a new feature lacks an owner, establish its boundary **before** implementation. If an existing owner exists, extend it instead of creating a parallel module.

## Automated enforcement

`engineering.json.checks.architecture` must call a real, stack-appropriate import graph checker (e.g. dependency-cruiser, ArchUnit, custom AST, import-linter, strict workspace boundary rules). Test it by inserting a prohibited import and showing a nonzero exit. A generated diagram alone is NOT an architecture guard.
