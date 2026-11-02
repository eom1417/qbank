# Adopt an existing repository

Load `engineering-foundation` and `safe-refactor` (by name, no slash). `G` = `python3 .genesis/tools/genesis.py`.

0. **Install without overwriting:** `python3 <kit>/.genesis/tools/genesis.py install --into .` copies the kit and writes `<file>.genesis-new` next to every existing file it would have replaced. Merge each one by hand (keep the project's content, add the kit's rules), delete the `.genesis-new` file, then `G setup` and `G doctor`. Existing `docs/`, `tools/`, `prompts/` and `scripts/` stay the project's.

1. **Inventory (read-only):** stack, entry points, capabilities, current tests and CI, data stores, secrets handling. Fill the blueprint with what *is*, marking problems.
2. **Measure:** configure `engineering.json` honestly (all roots, real extensions, genuine generated files only), then run `G guard`, `G guard --functions` and `G duplication`. Save the violation list to `docs/adoption-backlog.md` grouped by owner. Do not set `ready=true` yet.
3. **Protect first:** add characterization tests around the riskiest journeys and the files you will touch first.
4. **Remediate in batches**, highest risk and most-changed files first, one owner or one duplicate per batch (`safe-refactor`). After each batch: tests green, violation count lower, no contract change unless approved.
5. **Turn on gates** as each category reaches zero; when every category is zero and every probe in `.genesis/docs/17` goes red→green, set `ready=true`.

No baselines, no permanent waivers, no "ignore legacy folder" patterns. Until `ready=true`, CI fails on purpose — that is the honest status.
