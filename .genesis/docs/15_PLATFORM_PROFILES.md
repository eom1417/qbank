# Adaptive profiles — one foundation, not one architecture for every platform

During bootstrap, classify the product and activate the relevant checks. Do not create services, folders, components or tools that its runtime will never use. All **authored code** still follows 400/50/10 with language-appropriate AST/semantic tooling.

| Profile | Key architecture ownership | Extra guards required |
|---|---|---|
| Web application | UI feature boundaries; trusted API; data/service owner | route auth, a11y, responsive, tokens, browser E2E, CSRF if cookies |
| API/backend | endpoints -> application -> domain -> DB/adapters | contracts, permissions, idempotency, input limits, migrations |
| Mobile / desktop | domain + platform adapters; offline cache/sync if needed | secure local storage, lifecycle, permission/privacy, platform tests |
| CLI / developer tool | parser/command -> use case -> IO adapter | deterministic exit codes, safe path/FS effects, resumability |
| Library / SDK | stable public interface and compatibility surface | API/export snapshot, types, multi-version/runtime tests |
| Data/ETL/ML | ingest -> schema -> transform -> store/model -> output | lineage, schema drift, data leakage, reproducibility, bias where relevant |
| AI/agent product | orchestration -> policy/permissions -> tools/model -> verification | tool ACL, untrusted retrieval, prompt injection, data egress, cost caps |
| Multiplayer/game | gameplay simulation -> authoritative rules -> state/assets | deterministic rules, save compatibility, performance/time budgets |
| Embedded/IoT | HAL -> domain/control -> transport | hardware/safety, timing/resource constraints, OTA/rollback |
| Multi-service/distributed | per-service boundaries + explicit contracts | versioning, tracing, retries, failure isolation; no microservices by default |

**Stack choice**: compare a simple ecosystem-native solution with one plausible alternative. Select based on actual deploy platform, required capabilities, developer familiarity, ecosystem security, offline needs and long-term operational cost. Do not select a framework merely because a skill/tutorial recommends it.

**Quality adapter**: document official formatter, compiler/type checker, complexity parser, function-length analyzer, dependency cycle checker, test runner, security scanner and relevant UI/data validators. If a guard cannot be made real for a language, bootstrap is blocked rather than waived.

**No UI** means no visual design-library files. **No persistence** means no database migrations. **No users** means no role/tenant logic. But do not mark a real runtime boundary absent just to avoid tests.
