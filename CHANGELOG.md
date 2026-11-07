# Changelog / سجل التغييرات

Versions (DEC-38): `MAJOR.MINOR.PATCH`. `0.x` while QBank is tried; **`1.0.0` is the first release
the owner approves**. Then PATCH for small fixes, MINOR for new features, MAJOR for a fundamental
change.

الإصدارات: `0.x` أثناء التجربة، و**`1.0.0` أول إصدار يعتمده المالك**. بعده: الخانة الأخيرة للإصلاحات
الصغيرة، والوسطى للميزات الجديدة، والأولى للتغيير الجوهري.

## 0.1.0 (2026-11-06): the first trial / أول تجربة

The first version for a small group of testers. / أول نسخة لمجموعة صغيرة من المختبرين.

### Install / التثبيت

- Docker: one command on Windows, macOS and Linux; data kept across updates; this computer only.
- `install.sh` on macOS and Linux, proven from scratch in CI on every install change.
- Failure messages say, in Arabic and English, what stopped and what to do.
- Your own server for family and friends: `compose.server.yaml` (QBank, PostgreSQL, automatic
  HTTPS with Caddy), open sign-up, one AI host per account, reset links without e-mail
  (`docs/SELF-HOST.md`). / خادمك الخاص لأهلك وأصحابك برابط https.
- A server that does not answer says so and retries by itself, instead of showing a sign-in.

### Questions from your files / الأسئلة من ملفاتك

- Text and scanned PDFs, Arabic and English: questions, options, answer keys (inline, per chapter,
  at the end, in a separate file), explanations and pictures, as printed.
- Poor scans read again sharper; Arabic lam-alef fonts read in order; a file with no question says so.
- Optional: your own AI (Claude, ChatGPT and others, your subscription or key) settles answers with
  two solvers and a judge, improves questions on request, writes topic reviews with checked sources.

### Study / المذاكرة

- Tutor and timed exams, Smart Mix, spaced repetition, mastery, analytics, topic cards, notes, search.
- A sample bank of ten questions, ready in seconds, for the first two minutes.

### Your data / بياناتك

- Daily backups, export and restore (with the AI's work), deletion with an honest report.
- Hosted mode: each account's AI sign-ins are its own, in its own isolated host.
- Publishing channels for outside agents (REST and MCP), with numbers apart from your study.

### Known limits / حدود معروفة

- Real Windows installs (Docker Desktop) and ChatGPT or API-key providers are first tried in this trial.
- Reading is measured on our own files and the owner's samples; testers' real files come next.
