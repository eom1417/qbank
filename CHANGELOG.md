# Changelog / سجل التغييرات

Versions (DEC-38): `MAJOR.MINOR.PATCH`. `0.x` while QBank is tried; **`1.0.0` is the first release
the owner approves**. Then PATCH for small fixes, MINOR for new features, MAJOR for a fundamental
change.

الإصدارات: `0.x` أثناء التجربة، و**`1.0.0` أول إصدار يعتمده المالك**. بعده: الخانة الأخيرة للإصلاحات
الصغيرة، والوسطى للميزات الجديدة، والأولى للتغيير الجوهري.

## Unreleased / لم يصدر بعد

### Day-one trust on a server (M32, DEC-42; in progress) / ثقة اليوم الأول على الخادم (قيد التنفيذ)

- Sign in with Google only on a server with a Google client (`QBANK_GOOGLE_CLIENT_ID`,
  `QBANK_GOOGLE_CLIENT_SECRET`): no passwords, no reset, a verified e-mail. An existing e-mail
  account is linked on its first Google sign-in, and the operator (the verified
  `QBANK_OPERATOR_EMAIL`) needs no confirmation command. A server without a Google client and the
  local install are unchanged. / الدخول بحساب Google وحده على الخادم.
- Automatic daily backups of the database and the files (7 daily and 4 weekly kept, an optional
  copy to another disk with `QBANK_BACKUP_COPY_TO`), restore with `scripts/server-restore.sh`, and
  the last backup shown in Server administration.
- An uptime heartbeat every 5 minutes to the owner's uptime service (`QBANK_HEARTBEAT_URL`).
- An 8 GB server with 6 AI sessions at once by default.
- Final terms and privacy pages in plain words, with no "draft" notice: who runs the server, what
  is stored, who can see it, AI only through your own provider, backups and how long they keep
  what you delete. / الشروط والخصوصية نهائية بلا «مسودة».
- Small texts: "AI is optional" no longer lists backups as something a server user runs, and
  feedback reaches the operator with its kind in the sender's language («مشكلة»); GitHub issues
  keep the English tag.
- Self-host guide: 8 GB server, Google sign-in step by step, and a new
  `docs/SELF-HOST-OPERATIONS.md` for backups, restore, the uptime alert and password-mode servers.

### Ready to launch on a server (M31, DEC-40; in progress) / جاهز للإطلاق على الخادم (قيد التنفيذ)

- The server operator is a declared role: the account whose e-mail is `QBANK_OPERATOR_EMAIL`,
  never the first to sign up. `QBANK_OPERATOR_NAME` is the name users see. / «مدير الخادم» دور معلن.
- One "Server administration" screen for the operator: users' feedback, password-reset requests
  (Copy link or WhatsApp, no command line) and the import queue. Never anyone's banks or questions.
- "Send feedback" on a server reaches the operator inside QBank instead of a GitHub page.
- Imports are taken fairly across accounts, several at once (`QBANK_IMPORT_WORKERS`, one per
  account), and a waiting file shows its place in the queue.
- Honest texts per mode: on a server, "Where is my data?", the privacy page and the support report
  name who runs it, instead of "on your computer"; a test fails on any local-only claim a server
  user could read. "No public sharing" is gone from both modes (governed sharing, DEC-39).
- Self-host guide: installing and updating from a private repository with a read-only GitHub token.

### Governed sharing (M30, DEC-39; in progress) / المشاركة المحكومة (قيد التنفيذ)

- One "share" for every way a bank's questions leave it: an agent (the publishing channels), an
  exam link or a practice link. The bank itself stays private. / كل خروج لأسئلة البنك «مشاركة».
- One policy of six questions (what, who, when and how much, what receivers see, what the owner
  keeps, control), enforced by one gate on the server for the agent API, MCP and links.
- A plain-language card from the policy, shown to the owner before publishing and to receivers
  before they start; presets (formal exam, open practice, daily WhatsApp/Telegram question,
  API/MCP); an append-only record per share; an exposure warning before publishing.
- Exam and practice links for people without an account (`/t/<link>`), on a server only; results
  go to the owner and never touch the owner's own study. Exam questions are reserved from agent
  shares while the exam is not archived.
- Pause, end and renew act at once; a changed policy is a new version for new attempts only.
- Agent API `/api/channel/v1` unchanged, with two possible new answers: `not_revealed_yet` before
  the share's reveal time, and `share_limit_reached` (429) at the daily batch limit.

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
