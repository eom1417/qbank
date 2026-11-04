# M18.1–M18.2 Final acceptance

Date: 2026-11-04. The product as installed (local mode, PGlite) and accounts mode (Postgres). Every acceptance case (UAT) cites the automated test that proves it, and the traceability files cite one test per requirement (checked by `tests/unit/docs/traceability.test.ts`).

## The run

- Gates: eslint, tsc, 400/50/10 guard, copy-paste (duplication.py + jscpd), knip, depcruise, prettier, design guard: all pass.
- `npx vitest run`: 66 files, 247 tests, all pass (unit, contract and integration, Postgres).
- `npx playwright test`: 78 tests, all pass, on desktop and phone, accounts server and the local install. The local install (PGlite, paired) runs the whole journey, import to restore (`tests/e2e/local-journeys.spec.ts`).
- Scale: `npm run bench:perf` (`docs/reports/m17-performance.md`). Security: `docs/reports/m17-security.md`.

## The 86 acceptance cases

| Case    | What                  | Milestone | Status | Evidence                                     |
| ------- | --------------------- | --------- | ------ | -------------------------------------------- |
| UAT-001 | مكتبة جديدة           | M1.5      | done   | `tests/e2e/library.spec.ts`                  |
| UAT-002 | استقلال حسابين        | M0.3      | done   | `tests/integration/library.test.ts`          |
| UAT-003 | أسماء بنوك مكررة      | M0.3      | done   | `tests/integration/library.test.ts`          |
| UAT-004 | أرشفة بنك             | M1.3      | done   | `tests/integration/bank-editing.test.ts`     |
| UAT-005 | PDF نصي               | M4.4      | done   | `tests/integration/imports.test.ts`          |
| UAT-006 | PDF ممسوح             | M4.5      | done   | `tests/integration/imports.test.ts`          |
| UAT-007 | PDF عربي              | M4.4      | done   | `tests/integration/imports.test.ts`          |
| UAT-008 | PDF إنجليزي           | M4.4      | done   | `tests/integration/imports.test.ts`          |
| UAT-009 | لغة مختلطة            | M4.4      | done   | `tests/integration/imports.test.ts`          |
| UAT-010 | عمودان متجاوران       | M4.6      | done   | `tests/integration/imports.test.ts`          |
| UAT-011 | سؤال عبر صفحتين       | M4.6      | done   | `tests/integration/imports.test.ts`          |
| UAT-012 | مفتاح في نهاية الكتاب | M6.2      | done   | `tests/integration/answers.test.ts`          |
| UAT-013 | مفتاح منفصل           | M6.3      | done   | `tests/integration/answers.test.ts`          |
| UAT-014 | سؤال بال مفتاح        | M6.4      | done   | `tests/integration/answers.test.ts`          |
| UAT-015 | ثلاثة خيارات          | M4.6      | done   | `tests/integration/imports.test.ts`          |
| UAT-016 | خمسة خيارات           | M4.6      | done   | `tests/integration/imports.test.ts`          |
| UAT-017 | أسئلة مقالية          | M4.6      | done   | `tests/integration/imports.test.ts`          |
| UAT-018 | قيم سالبة ووحدات      | M4.6      | done   | `tests/integration/imports.test.ts`          |
| UAT-019 | ملف فاسد              | M4.1      | done   | `tests/integration/imports-rules.test.ts`    |
| UAT-020 | ملف متعدد             | M4.2      | done   | `tests/e2e/import.spec.ts`                   |
| UAT-021 | نطاق صفحات            | M4.2      | done   | `tests/integration/imports.test.ts`          |
| UAT-022 | حالة التقدم           | M4.3      | done   | `tests/e2e/import.spec.ts`                   |
| UAT-023 | ECG أساسي             | M5.2      | done   | `tests/integration/imports-media.test.ts`    |
| UAT-024 | صورتان بسؤال          | M5.3      | done   | `tests/integration/imports-media.test.ts`    |
| UAT-025 | X-ray مشوش            | M5.4      | done   | `tests/integration/imports-media.test.ts`    |
| UAT-026 | جدول مخبري            | M5.5      | done   | `tests/integration/imports-media.test.ts`    |
| UAT-027 | صورة بين سؤالين       | M5.2      | done   | `tests/integration/imports-media.test.ts`    |
| UAT-028 | تعارض مفتاح وشرح      | M6.5      | done   | `tests/integration/answers.test.ts`          |
| UAT-029 | اقتراح AI             | M6.6      | done   | `tests/integration/imports-rules.test.ts`    |
| UAT-030 | اعتماد يدوي           | M6.6      | done   | `tests/integration/imports-rules.test.ts`    |
| UAT-031 | تغيير جواب قديم       | M10.9     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-032 | قائمة عالية الخطورة   | M7.1      | done   | `tests/integration/review-queue.test.ts`     |
| UAT-033 | تعديل خيار            | M7.2      | done   | `tests/e2e/review.spec.ts`                   |
| UAT-034 | اعتماد جماعي          | M7.5      | done   | `tests/integration/review-queue.test.ts`     |
| UAT-035 | استبعاد ثم استرجاع    | M7.3      | done   | `tests/integration/review-queue.test.ts`     |
| UAT-036 | بلاغ أثناء حل سؤال    | M7.9      | done   | `tests/e2e/acceptance.spec.ts`               |
| UAT-037 | نفس الملف مرتين       | M8.1      | done   | `tests/integration/duplicates.test.ts`       |
| UAT-038 | سؤال Except           | M8.2      | done   | `tests/integration/duplicates.test.ts`       |
| UAT-039 | اختلاف مفتاح          | M8.3      | done   | `tests/integration/duplicates.test.ts`       |
| UAT-040 | امتحان مع نسخ متطابقة | M9.9      | done   | `tests/integration/acceptance-study.test.ts` |
| UAT-041 | جواب قبل الإرسال      | M9.4      | done   | `tests/integration/study-tutor.test.ts`      |
| UAT-042 | جواب خاطئ             | M9.4      | done   | `tests/integration/study-tutor.test.ts`      |
| UAT-043 | شرح AI                | M9.4      | done   | `tests/integration/study-progress.test.ts`   |
| UAT-044 | مراجعة Flag           | M9.6      | done   | `tests/integration/study-progress.test.ts`   |
| UAT-045 | الرجوع لسؤال          | M9.5      | done   | `tests/integration/study-tutor.test.ts`      |
| UAT-046 | ثلاثة أخطاء           | M9.8      | done   | `tests/integration/study-progress.test.ts`   |
| UAT-047 | انقطاع عابر           | M9.7      | done   | `tests/integration/study-progress.test.ts`   |
| UAT-048 | بدون زمن              | M10.1     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-049 | زمن إجمالي            | M10.1     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-050 | زمن لكل سؤال          | M10.1     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-051 | لا كشف مبكر           | M10.2     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-052 | تغيير جواب            | M10.3     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-053 | Flags                 | M10.4     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-054 | مراجعة قبل التسليم    | M10.5     | done   | `tests/e2e/exam.spec.ts`                     |
| UAT-055 | قطع اتصال             | M10.7     | done   | `tests/integration/study-exam.test.ts`       |
| UAT-056 | تقرير نهائي           | M10.8     | done   | `tests/e2e/exam.spec.ts`                     |
| UAT-057 | وفرة المجموعات        | M11.6     | done   | `tests/integration/study-plan.test.ts`       |
| UAT-058 | نقص الجديد            | M11.6     | done   | `tests/integration/study-plan.test.ts`       |
| UAT-059 | لا تكرار              | M9.9      | done   | `tests/integration/study-tutor.test.ts`      |
| UAT-060 | محاولة صحيحة واحدة    | M11.2     | done   | `tests/integration/study-plan.test.ts`       |
| UAT-061 | تكرر نجاح             | M11.2     | done   | `tests/unit/study/mastery.test.ts`           |
| UAT-062 | خطأ بعد نجاح          | M11.3     | done   | `tests/integration/study-plan.test.ts`       |
| UAT-063 | يوم بال مستحقات       | M11.4     | done   | `tests/integration/study-plan.test.ts`       |
| UAT-064 | 8 صحيح و2 خطأ         | M12.1     | done   | `tests/integration/analytics.test.ts`        |
| UAT-065 | عينة صغيرة            | M12.3     | done   | `tests/integration/analytics.test.ts`        |
| UAT-066 | فلترة بنك             | M12.7     | done   | `tests/integration/analytics.test.ts`        |
| UAT-067 | جودة الاستيراد        | M12.6     | done   | `tests/integration/analytics.test.ts`        |
| UAT-068 | تقرير جلسة قديمة      | M12.5     | done   | `tests/integration/analytics.test.ts`        |
| UAT-069 | بنك مصور              | M13.1     | done   | `tests/integration/portability.test.ts`      |
| UAT-070 | إخفاء الأسرار         | M13.1     | done   | `tests/integration/portability.test.ts`      |
| UAT-071 | نطاق فصل              | M13.1     | done   | `tests/integration/portability.test.ts`      |
| UAT-072 | PDF مكتمل             | M6.12     | done   | `tests/integration/answers.test.ts`          |
| UAT-073 | فشل قبل الاكتمال      | M6.12     | done   | `tests/integration/imports-failure.test.ts`  |
| UAT-074 | حذف بنك A             | M13.5     | done   | `tests/integration/portability.test.ts`      |
| UAT-075 | حذف حساب              | M13.6     | done   | `tests/integration/portability.test.ts`      |
| UAT-076 | رابط غير مصرح         | M0.3      | done   | `tests/integration/privacy-audit.test.ts`    |
| UAT-077 | مزود AI خارجي         | M2.6      | done   | `tests/e2e/acceptance.spec.ts`               |
| UAT-078 | صورة مريض معرف        | M14.1     | done   | `tests/e2e/help.spec.ts`                     |
| UAT-079 | واجهة RTL             | M15.1     | done   | `tests/e2e/accessibility.spec.ts`            |
| UAT-080 | واجهة LTR             | M15.1     | done   | `tests/e2e/accessibility.spec.ts`            |
| UAT-081 | Dark mode             | M15.2     | done   | `tests/e2e/accessibility.spec.ts`            |
| UAT-082 | هاتف صغير             | M15.3     | done   | `tests/e2e/accessibility.spec.ts`            |
| UAT-083 | ألوان الملاحظات       | M15.2     | done   | `tests/e2e/accessibility.spec.ts`            |
| UAT-084 | مفتاح منتهي           | M2.4      | done   | `tests/integration/imports-rules.test.ts`    |
| UAT-085 | تكرار مهمة فاشلة      | M4.7      | done   | `tests/integration/imports.test.ts`          |
| UAT-086 | تعديل سؤال في جلسة    | M10.9     | done   | `tests/integration/study-exam.test.ts`       |

## Not done by code (owner actions)

- **FR-20-009** — legal review of data protection by a specialist before any public release. `legal-content.ts` is ready for that review.
- **FR-24-006** — the extraction benchmark (`npm run bench:extraction`) needs the reference samples still missing: a real scan, a two-column book, a separate key file and essays, each with its answer key. DEC-21's thresholds stay assumed until then.
- **FR-25-001** — the decisions marked `assumed` in `docs/DECISIONS.md` were applied with the spec's default and wait for the owner's signature (listed in the handoff report).
