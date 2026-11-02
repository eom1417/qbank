# Code conventions — where everything lives and how it is written

Goal: any person or agent can predict the file to open **before** searching, and every repeated concept exists exactly once.

## 1. Reference layout (adapt names to the stack, keep the shape)

```text
<repo>/
  AGENTS.md  CLAUDE.md  engineering.json  docs/  tools/  adapters/  .genesis/prompts/
  src/                          # or app/, lib/, packages/<name>/ — declared in the blueprint
    capabilities/<capability>/  # one business capability per folder
      index.*                   # the ONLY public interface other capabilities may import
      domain/                   # rules, invariants, types — no framework, DB or UI imports
      use-cases/                # orchestration, transactions, authorization calls
      adapters/                 # DB, HTTP, queue, file, external API implementations
      ui/                       # screens/components specific to this capability (if UI)
      *.test.* or tests/        # tests next to what they prove
    platform/                   # cross-cutting owners, each a named module (not "utils"):
      config/  errors/  logging/  auth/  http-client/  time/  i18n/  ...
    design-system/              # tokens + primitives (only if a UI exists)
      tokens.*  components/  index.*
    contracts/                  # API/event/schema single sources (or generated from one)
  migrations/                   # immutable once applied
  tests/e2e/                    # cross-capability journeys only
```

Rules: a capability imports another only through its `index`; `platform/*` and `design-system` never import a capability; `domain/` imports nothing outward. Encode these rules in the architecture gate (`.genesis/docs/03`).

## 2. "Where does X go?" — decide in this order

| You need… | It goes in… | Never in… |
|---|---|---|
| A rule about one business concept | `capabilities/<c>/domain` | UI, controller, SQL view, a second capability |
| Steps that coordinate rules + I/O | `capabilities/<c>/use-cases` | route handlers, components |
| Logic used by 2+ capabilities, business-neutral | a **named** `platform/<concept>` module | `utils`, `helpers`, `common`, `misc` |
| Logic used by 2+ capabilities, business-specific | the capability that owns the concept, exposed via `index` | copied into each caller |
| A color, spacing, radius, font, shadow, motion value | `design-system/tokens` | any component or feature file |
| A button/input/dialog/table/empty/loading/error state | `design-system/components` | re-implemented in a feature |
| Request/response/event shape | `contracts/` (one source; generate clients) | hand-copied types per consumer |
| Error type, code or message format | `platform/errors` | ad-hoc strings/exceptions per module |
| Config/env reading + validation | `platform/config` (validated once at startup) | `process.env`/`os.environ` scattered |
| User-facing text | `platform/i18n` catalogs (RTL/LTR aware) | hard-coded strings in components |
| A third-party SDK call | an adapter behind a port the domain owns | inside domain or UI code |

**Promotion rule:** code moves to a shared owner on its **second real use**, with a name that describes the concept (`money/format`, `dates/business-days`), not the shape (`helpers2`). Before writing any function, search for an existing one by behavior (symbol search + the owner map). If found: call it, or extend it with a test. If you add a shared function, register it in the blueprint owner map.

## 3. Functions and files

- One function = one level of abstraction and one reason to change. Name it for what it returns or does.
- ≤ 50 lines and complexity ≤ 10 are ceilings, not targets. Typical healthy size: 5–25 lines.
- Reduce complexity with: early returns/guard clauses, lookup tables instead of `if/else` chains, polymorphism or strategy maps for variant behavior, extracting a named predicate, splitting parse → validate → act.
- Do **not** reduce numbers by: wrapper layers that only forward, cramming logic into one line, moving code to an unowned helper, nesting lambdas.
- Splitting a 400-line file: group by responsibility (types / rules / persistence / presentation) into sibling files in the same owner folder, keep the public interface stable, move tests alongside.
- Parameters ≤ 4–5; pass an options object or a value type beyond that. No boolean flag parameters that switch behavior — make two functions.

## 4. Naming

- Use the domain glossary words (`.genesis/docs/02`) identically in UI, API, DB and tests.
- Files: name by the concept they own (`invoice-totals.ts`, `session_store.py`). No `misc`, `stuff`, `new`, `v2`, `temp` in names.
- Booleans read as questions (`isActive`, `has_access`); functions as verbs; types as nouns.

## 5. Errors, logging, configuration

- One error model (`platform/errors`): typed errors with stable codes; map to transport (HTTP status, CLI exit code, UI message) at the boundary only.
- Never swallow errors silently; never log and rethrow the same error twice. Fail fast on invalid configuration at startup.
- Structured logs (`platform/logging`) with correlation IDs; no secrets/PII; levels mean something (error = someone must act).
- Feature flags and config are read through `platform/config`, typed and validated; defaults are safe.

## 6. Dependencies

- Add a dependency only when it removes real code or risk. Record why in the PR. Prefer the platform/standard library and already-installed libraries.
- Pin versions and commit the lockfile (declared in `engineering.json.generated`). No two libraries for the same job (two date libs, two HTTP clients, two state managers).
- Wrap external SDKs in an adapter so replacing them touches one folder.

## 7. Comments and docs

- Code says *what*; comments say *why* (non-obvious decisions, constraints, links to ADRs). Delete commented-out code.
- Public interfaces get a short doc comment: purpose, inputs, errors.
- When a contract, boundary or owner changes, update the blueprint row in the same change.

## 8. Tests

- Tests live next to the owner they prove; shared fixtures/builders live in one named test-support module per capability.
- Test names state behavior: `rejects_transfer_when_balance_insufficient`.
- Tests obey 400/50/10 too; table-driven tests keep them small.

## 9. Anti-patterns the reviewer rejects

God modules · `utils`/`helpers`/`common` buckets · barrel files that hide ownership or create cycles · copy-pasted validators · business rules in UI or SQL triggers without an owner · raw design values in features · "manager/service/handler" classes with ten unrelated methods · speculative interfaces with one implementation · catching broad exceptions to continue · TODOs without an owner and issue link.
