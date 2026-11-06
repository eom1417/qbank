# Security policy / سياسة الأمان

**Please do not report a security problem in a public issue.** Use GitHub's private report instead:
the repository's **Security** tab → **Report a vulnerability**. Describe what an attacker could do
and how to reproduce it; we answer within a few days and say when it is fixed.

**لا تبلّغ عن مشكلة أمنية في بلاغ عام.** استعمل البلاغ الخاص في GitHub: تبويب **Security** في
المستودع ← **Report a vulnerability**. صف ما يستطيع المهاجم فعله وكيف يُعاد إنتاجه، ونرد خلال أيام.

## What QBank protects / ما يحميه QBank

- Each account's banks, files and AI sign-ins are its own: nobody else reads or uses them.
- AI keys and sign-ins never leave the computer except to the provider the owner chose, and are
  never put in an export.
- Locally, QBank answers only this computer (and paired devices); with Docker it is published on
  `127.0.0.1` only.
- A publishing channel's key reaches that channel's questions only.

Supported version: the latest release.
