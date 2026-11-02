---
name: feature-delivery
description: Implement or change a feature, screen, endpoint, command or data change inside a Genesis project with the narrowest correct diff - find the owner first, reuse central functions/contracts/design components, test success and denial paths, pass 400/50/10 and copy-paste gates. Use when the user asks to add, build, implement, extend or change behavior ("add a feature", "build the screen", "أضف ميزة", "سوّ صفحة", "نفذ", "عدل السلوك", "خلّه أجمل").
---

# feature-delivery

`G` = `python3 .genesis/tools/genesis.py`.

1. **Locate before writing.** Read the owner row in `BLUEPRINT.md`. Search for an existing function, contract, validator, token or component that already does the job (`.genesis/docs/10_CODE_CONVENTIONS.md`). Extend the owner; never create a parallel one.
2. **Impact map (3-6 lines):** entry -> use case -> domain -> adapter -> tests. Files outside it are out of scope.
3. **Test first when behavior is specified:** load `tdd` if installed; otherwise write the failing test yourself.
4. **Implement the vertical slice.** Shared logic goes to its named owner, UI uses design tokens and shared components only, authorization stays on the trusted side. New owner or shared function -> register it in `BLUEPRINT.md`.
5. **Verify:** targeted tests, `G check`, then `G check --full` once on the final tree.
6. **Report:** changed owners, tests (positive + negative), exact gate results, anything unverified.

Never: edit guards/CI/policy files to pass, suppress lint, touch unrelated files, merge or deploy without approval. Near 50 lines or complexity 10: split by responsibility, never a wrapper.
