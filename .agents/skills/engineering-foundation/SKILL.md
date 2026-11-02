---
name: engineering-foundation
description: Bootstrap a new repository, a new major module, or adopt an existing codebase on the Project Genesis contract - product brief, stack choice, ownership map, central design/contract owners, real 400/50/10 and copy-paste guards proven red->green, CI and a first tested vertical slice. Use when the user starts a new project or describes an app idea, says "bootstrap", "set up the project", "start from zero", "أسس المشروع", "ابدأ مشروع جديد", "عندي فكرة", "جهز البنية", or wants Genesis applied to an existing repo.
---

# engineering-foundation

`G` = `python3 .genesis/tools/genesis.py`. Follow `.genesis/prompts/01_BOOTSTRAP.md` stages A-E in order (existing code: `.genesis/prompts/05_ADOPT_EXISTING.md`). Load docs only when a stage needs them.

1. **Discover** (`.genesis/docs/02`, `15`): users, top 3 journeys, data, trust boundaries, non-goals. Ask only questions that change security, data or irreversible choices. Smallest fitting stack + one rejected alternative. Fill `BLUEPRINT.md` §1-2.
2. **Own** (`.genesis/docs/03`, `10`, `04` if UI, `14` if data): `BLUEPRINT.md` §3-6 - capability -> path -> public interface -> tests, forbidden imports, one owner per shared concern, the extension guide.
3. **Equip** (`.genesis/docs/08`, `09`): `G recipe python|typescript|go` if one fits, else real gates + `.genesis/proofs/<gate>/` fixtures; `G setup --project`; install core skills and `G skills --apply`; UI -> `applies.design` + `design_system`; `G hooks`.
4. **Prove**: load `guard-proofs`; `G prove` must print PROVED for every gate. Fill CODEOWNERS with the owner's handle; with approval `G governance --apply`. The owner sets `ready=true`.
5. **Slice**: one runnable journey with its failure path; load `feature-delivery` for it.

Rules: never raise 400/50/10 or add a suppression; no speculative services, folders or abstractions; stop before merge, deploy, purchases or live data. Report in the `.genesis/docs/16` format.
