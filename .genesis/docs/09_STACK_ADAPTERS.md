# Stack adapters: making the hard limits real in every language

`G` = `python3 .genesis/tools/genesis.py`.

## 1. Built-in guards (no configuration; run before every gate)

| Command | Enforces | Coverage |
|---|---|---|
| `G guard` | ≤400 physical lines; no symlinked sources; no inline bypass markers; no raised `max-complexity`; every tracked file classified (authored, asset, generated, fixture) | every file matching `owned_extensions` / `owned_filenames`, found via `git ls-files` (respects `.gitignore`) |
| `G guard --functions` | ≤50 physical lines per function, McCabe ≤10 | Python (AST, decorators included); shell (whole file bounded as one function); **lizard 1.24.3** for C/C++, C#, Java, Kotlin, Scala, JS/JSX/TS/TSX, Vue, Go, Rust, Swift, Objective-C, Ruby, PHP, Lua, Perl, R, Solidity, Zig, Erlang, GDScript, Fortran, PL/SQL |
| `G duplication` | no block of 8+ significant lines repeated (imports, comments, blank and trivial lines ignored) | every authored code file, tests included, any language |
| `G design` | raw colors, sizes, durations, fonts, z-index, Tailwind arbitrary values and native controls only inside the token owner / component library | UI files matched by `design_system.ui` when `applies.design` is true (web, Flutter, SwiftUI, Compose patterns) |
| `G guard --files <paths>` | size, bypass and function rules for specific files | Claude hooks and the pre-commit hook; works before bootstrap |

`checks.function_length` and `checks.complexity` default to `python3 .genesis/tools/guard.py --functions`. Lizard and its two dependencies are pinned **with hashes** in `.genesis/tools/requirements-guard.txt`; `G setup` installs them into `.genesis/.pylib`. This uses `pip --target` and falls back to a stdlib download verified against the same hashes, so it needs no virtualenv and works on PEP 668 Pythons. A lizard language without lizard installed is **BLOCKED**.

**Languages without a parser in the kit** (Dart, Svelte, Astro, Elixir, Haskell, Clojure, Groovy, PowerShell, Julia, …): `--functions` fails with "no function/complexity gate for .ext" until you configure a real parser-based command and list the extension in `external_function_gates`. Gates accept several commands: `"complexity": [["python3", ".genesis/tools/guard.py", "--functions"], ["dart", "run", "dart_code_linter:metrics", "analyze", "lib", "--set-exit-on-violation-level=warning"]]`. Prove each one red/green (`.genesis/docs/17`).

Counting rules (identical across the kit):
- Physical lines include blanks and comments.
- Function length runs from the first decorator/annotation line to the closing line.
- Complexity is classic McCabe: 1 + each `if/elif/for/while/catch/case/ternary/&&/||/and/or`, comprehension clauses included. Never substitute "modified" (switch-as-one) or cognitive complexity.

## 2. Project tool environments

- **Python:** `.genesis/tools/venv_run.py --create -r requirements-dev.txt` creates `.venv` (on Debian/Ubuntu without `python3-venv`, it fills a pip-less venv with the outer pip). Gates run tools as `python3 .genesis/tools/venv_run.py <tool> ...`, which works on Linux, macOS and Windows and puts `src/` on `PYTHONPATH`.
- **Node:** `npm ci` from a committed `package-lock.json`; gates call `npx <tool>` so the locked versions run.
- **Go:** `go mod download`; extra linters run pinned with `go run module/cmd/tool@vX.Y.Z`, with no global install, identical in CI. Add `actions/setup-go` to CI.

## 3. Editor-speed feedback (same thresholds, never looser)

**JavaScript / TypeScript:** import `.genesis/adapters/eslint.rules.mjs` into the flat config for **all** first-party files, with the right parser (typescript-eslint, vue, svelte, astro processors):

```js
import { genesisStrictRules } from './.genesis/adapters/eslint.rules.mjs';
export default [{ files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,vue}'], rules: genesisStrictRules }];
```

Also: `tsc --noEmit` (strict), dependency-cruiser (`--validate`, forbidden + `no-circular`), jscpd, Knip with real entry points, Prettier or Biome, Stylelint for tokens.

**Python:** merge `.genesis/adapters/ruff.toml` into `pyproject.toml` (C901 at 10, PLR0915 statements, mccabe). Types: Pyright or mypy `--strict`. Layers: import-linter. Tests: pytest. Dead code: vulture. Security: Bandit or Semgrep; dependencies: pip-audit.

**Go:** golangci-lint v2 with `gocyclo` (10), `funlen` (lines 50, statements -1), `depguard` for layers, `govet`, `staticcheck`, `dupl`, `unused`, `gosec`; `govulncheck ./...`; `go test -race ./...`.

**JVM (Java/Kotlin):** Checkstyle `MethodLength` 50 + `CyclomaticComplexity` 10 + `FileLength` 400, or detekt `LongMethod`/`CyclomaticComplexMethod`/`LargeClass`; ArchUnit tests for layers; OWASP dependency-check or OSV-Scanner.

**Rust, C#, Swift, C/C++, Dart:**
- Rust: Clippy (`-D warnings`, `too_many_lines` 50, `cognitive_complexity` as an extra only) plus `cargo audit`.
- C#: Roslyn CA1502 with `.editorconfig` severities.
- Swift: SwiftLint `function_body_length` 50, `cyclomatic_complexity` 10, `file_length` 400.
- C/C++: clang-tidy `readability-function-size`.
- Dart: `dart_code_linter` metrics.

Lizard stays the CI source of truth for every language it covers, so editor tools can only disagree by being stricter.

## 4. Manifest reference (`engineering.json`)

| Key | Meaning |
|---|---|
| `project`, `ready` | real name; `ready=true` only after every proof in `.genesis/docs/17` and the owner's approval |
| `source_roots` | authored roots; default `["."]` = whole repository (recommended) |
| `owned_extensions`, `owned_filenames` | what counts as authored; every tracked file must be authored, an asset, generated or a fixture (unknown types fail) |
| `asset_extensions`, `asset_patterns` | extra non-code assets beyond the built-in list (images, fonts, media, archives, checksums) |
| `generated` | `{pattern, reason, regenerate, verify}` for codegen output. In full gates the matching files are **deleted**, and `verify` (the real generator, not git/cp/echo/inline scripts) must recreate them byte-for-byte; the originals are put back afterwards. A header comment proves nothing. Lockfiles are recognised automatically |
| `external_function_gates` | extensions measured by an extra configured parser gate |
| `applies` | `design`, `integration`, `e2e`, `operations`: true when that boundary exists |
| `design_system` | `{tokens, components, ui}` globs for the design guard (`.genesis/docs/04` §3) |
| `setup` | pinned install commands, run by CI and new machines (`G setup --project`) |
| `checks` | gate → argv, or a list of argv. Fast: architecture, function_length, complexity, format, lint, types. Full adds unit, contracts, duplication, dead_code, security, dependencies, build. `design` (optional extra command), `integration`/`e2e` (full) and `operations` (release) when `applies`. Each command needs a `.genesis/proofs/` fixture |
| `skills` | `required` / `model_invocable` / `user_only` invocation policy (`.genesis/docs/08`) |

Bootstrap order: choose stack → recipe or real `checks` + fixtures → pin `setup` → `G prove` → CI green from a fresh clone → owner fills CODEOWNERS, approves `G governance --apply`, sets `ready=true`.
