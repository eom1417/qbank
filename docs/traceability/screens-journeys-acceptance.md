# التتبّع: الشاشات والرحلات وحالات القبول

يربط كل بند في وثيقة المالك بخطوته في `docs/PLAN.md` وحالته الفعلية. يتحقق منه `tests/unit/docs/traceability.test.ts`: كل بند موجود مرة واحدة، وكل خطوة موجودة في الخطة، والحالة `done` تشير إلى اختبار موجود.

**الحالات:** `planned` مخطط · `partial` منفّذ جزئياً ومختبر · `done` منفّذ بالكامل ومختبر · `accepted` اعتمده المالك في اختبار القبول.
**المنشأ:** `سابق` = قرار سابق · `مقترح` = استكمال مقترح يحتاج اعتماد المالك.

## الشاشات (UI)

| المعرّف | العنوان               | الخطوة | الحالة  | الدليل                              |
| ------- | --------------------- | ------ | ------- | ----------------------------------- |
| UI-01   | صفحة تعريف الخدمة     | M1.1   | done    | `tests/e2e/landing.spec.ts`         |
| UI-02   | التسجيل والدخول       | M0.2   | partial | `tests/e2e/account.spec.ts`         |
| UI-03   | لوحة المكتبة الفارغة  | M1.5   | done    | `tests/e2e/library.spec.ts`         |
| UI-04   | لوحة البنوك           | M1.5   | partial | `tests/e2e/bank-management.spec.ts` |
| UI-05   | إنشاء بنك             | M1.5   | done    | `tests/e2e/library.spec.ts`         |
| UI-06   | تفاصيل بنك            | M1.7   | partial | `tests/e2e/bank-management.spec.ts` |
| UI-07   | تجهيز رفع             | M4.2   | done    | `tests/e2e/import.spec.ts`          |
| UI-08   | تقدم الاستيراد        | M4.3   | done    | `tests/e2e/import.spec.ts`          |
| UI-09   | نتيجة استيراد         | M4.8   | done    | `tests/e2e/import.spec.ts`          |
| UI-10   | طابور المراجعة        | M7.1   | planned | —                                   |
| UI-11   | محرر السؤال           | M7.2   | planned | —                                   |
| UI-12   | عرض التكرارات         | M8.3   | planned | —                                   |
| UI-13   | إعداد Tutor           | M9.2   | planned | —                                   |
| UI-14   | سؤال Tutor            | M9.4   | planned | —                                   |
| UI-15   | نهاية Tutor           | M9.8   | planned | —                                   |
| UI-16   | إعداد Exam            | M10.1  | planned | —                                   |
| UI-17   | شاشة Exam             | M10.2  | planned | —                                   |
| UI-18   | مراجعة قبل تسليم Exam | M10.5  | planned | —                                   |
| UI-19   | تقرير Exam            | M10.8  | planned | —                                   |
| UI-20   | المراجعات المستحقة    | M11.4  | planned | —                                   |
| UI-21   | تحليلات الطالب        | M12.10 | planned | —                                   |
| UI-22   | البحث                 | M12.11 | planned | —                                   |
| UI-23   | إدارة المصادر         | M4.9   | done    | `tests/e2e/import.spec.ts`          |
| UI-24   | إعدادات المفاتيح      | M2.2   | done    | `tests/e2e/ai-settings.spec.ts`     |
| UI-25   | إعدادات الدراسة       | M1.6   | partial | `tests/e2e/account.spec.ts`         |
| UI-26   | التصدير               | M13.1  | planned | —                                   |
| UI-27   | الحذف والخصوصية       | M13.6  | planned | —                                   |
| UI-28   | مركز الدعم            | M14.5  | planned | —                                   |

## الرحلات (JY)

| المعرّف | العنوان                     | الخطوة | الحالة  | الدليل                                    |
| ------- | --------------------------- | ------ | ------- | ----------------------------------------- |
| JY-01   | التحويل الكامل من PDF مصوّر | M6.12  | planned | —                                         |
| JY-02   | ملف بلا حلول                | M6.4   | planned | —                                         |
| JY-03   | مفتاح حلول منفصل            | M6.3   | planned | —                                         |
| JY-04   | كتاب ذو عمودين              | M4.6   | planned | —                                         |
| JY-05   | سؤال بصورتي ECG             | M5.3   | planned | —                                         |
| JY-06   | تكرارات مع اختلاف except    | M8.4   | planned | —                                         |
| JY-07   | تدريب Tutor                 | M9.8   | planned | —                                         |
| JY-08   | امتحان بوقت إجمالي          | M10.6  | planned | —                                         |
| JY-09   | امتحان بوقت لكل سؤال        | M10.6  | planned | —                                         |
| JY-10   | انقطاع أثناء امتحان         | M10.7  | planned | —                                         |
| JY-11   | Smart Mix عند الوفرة        | M11.6  | planned | —                                         |
| JY-12   | Smart Mix عند نقص الجديد    | M11.6  | planned | —                                         |
| JY-13   | مراجعة متباعدة              | M11.3  | planned | —                                         |
| JY-14   | فشل AI في منتصف الاستيراد   | M4.7   | done    | `tests/integration/imports-rules.test.ts` |
| JY-15   | تعارض إجابة بعد امتحان      | M10.9  | planned | —                                         |
| JY-16   | تصدير ثم حذف بنك            | M13.5  | planned | —                                         |
| JY-17   | تبديل اللغة والجهاز         | M9.7   | planned | —                                         |
| JY-18   | تصفح دون درجة               | M12.12 | planned | —                                         |
| JY-19   | كتاب مع صورة مريض معرّف     | M14.1  | planned | —                                         |

## حالات القبول (UAT)

| المعرّف | العنوان               | الخطوة | الحالة  | الدليل                                    |
| ------- | --------------------- | ------ | ------- | ----------------------------------------- |
| UAT-001 | مكتبة جديدة           | M1.5   | done    | `tests/e2e/library.spec.ts`               |
| UAT-002 | استقلال حسابين        | M0.3   | done    | `tests/integration/library.test.ts`       |
| UAT-003 | أسماء بنوك مكررة      | M0.3   | done    | `tests/integration/library.test.ts`       |
| UAT-004 | أرشفة بنك             | M1.3   | done    | `tests/integration/bank-editing.test.ts`  |
| UAT-005 | PDF نصي               | M4.4   | done    | `tests/integration/imports.test.ts`       |
| UAT-006 | PDF ممسوح             | M4.5   | done    | `tests/integration/imports.test.ts`       |
| UAT-007 | PDF عربي              | M4.4   | done    | `tests/integration/imports.test.ts`       |
| UAT-008 | PDF إنجليزي           | M4.4   | done    | `tests/integration/imports.test.ts`       |
| UAT-009 | لغة مختلطة            | M4.4   | done    | `tests/integration/imports.test.ts`       |
| UAT-010 | عمودان متجاوران       | M4.6   | done    | `tests/integration/imports.test.ts`       |
| UAT-011 | سؤال عبر صفحتين       | M4.6   | done    | `tests/integration/imports.test.ts`       |
| UAT-012 | مفتاح في نهاية الكتاب | M6.2   | planned | —                                         |
| UAT-013 | مفتاح منفصل           | M6.3   | planned | —                                         |
| UAT-014 | سؤال بال مفتاح        | M6.4   | planned | —                                         |
| UAT-015 | ثلاثة خيارات          | M4.6   | done    | `tests/integration/imports.test.ts`       |
| UAT-016 | خمسة خيارات           | M4.6   | done    | `tests/integration/imports.test.ts`       |
| UAT-017 | أسئلة مقالية          | M4.6   | done    | `tests/integration/imports.test.ts`       |
| UAT-018 | قيم سالبة ووحدات      | M4.6   | done    | `tests/integration/imports.test.ts`       |
| UAT-019 | ملف فاسد              | M4.1   | done    | `tests/integration/imports-rules.test.ts` |
| UAT-020 | ملف متعدد             | M4.2   | done    | `tests/e2e/import.spec.ts`                |
| UAT-021 | نطاق صفحات            | M4.2   | done    | `tests/integration/imports.test.ts`       |
| UAT-022 | حالة التقدم           | M4.3   | done    | `tests/e2e/import.spec.ts`                |
| UAT-023 | ECG أساسي             | M5.2   | done    | `tests/integration/imports-media.test.ts` |
| UAT-024 | صورتان بسؤال          | M5.3   | done    | `tests/integration/imports-media.test.ts` |
| UAT-025 | X-ray مشوش            | M5.4   | done    | `tests/integration/imports-media.test.ts` |
| UAT-026 | جدول مخبري            | M5.5   | done    | `tests/integration/imports-media.test.ts` |
| UAT-027 | صورة بين سؤالين       | M5.2   | done    | `tests/integration/imports-media.test.ts` |
| UAT-028 | تعارض مفتاح وشرح      | M6.5   | planned | —                                         |
| UAT-029 | اقتراح AI             | M6.6   | planned | —                                         |
| UAT-030 | اعتماد يدوي           | M6.6   | planned | —                                         |
| UAT-031 | تغيير جواب قديم       | M10.9  | planned | —                                         |
| UAT-032 | قائمة عالية الخطورة   | M7.1   | planned | —                                         |
| UAT-033 | تعديل خيار            | M7.2   | planned | —                                         |
| UAT-034 | اعتماد جماعي          | M7.5   | planned | —                                         |
| UAT-035 | استبعاد ثم استرجاع    | M7.3   | planned | —                                         |
| UAT-036 | بلاغ أثناء حل سؤال    | M7.9   | planned | —                                         |
| UAT-037 | نفس الملف مرتين       | M8.1   | planned | —                                         |
| UAT-038 | سؤال Except           | M8.2   | planned | —                                         |
| UAT-039 | اختلاف مفتاح          | M8.3   | planned | —                                         |
| UAT-040 | امتحان مع نسخ متطابقة | M9.9   | planned | —                                         |
| UAT-041 | جواب قبل الإرسال      | M9.4   | planned | —                                         |
| UAT-042 | جواب خاطئ             | M9.4   | planned | —                                         |
| UAT-043 | شرح AI                | M9.4   | planned | —                                         |
| UAT-044 | مراجعة Flag           | M9.6   | planned | —                                         |
| UAT-045 | الرجوع لسؤال          | M9.5   | planned | —                                         |
| UAT-046 | ثلاثة أخطاء           | M9.8   | planned | —                                         |
| UAT-047 | انقطاع عابر           | M9.7   | planned | —                                         |
| UAT-048 | بدون زمن              | M10.1  | planned | —                                         |
| UAT-049 | زمن إجمالي            | M10.1  | planned | —                                         |
| UAT-050 | زمن لكل سؤال          | M10.1  | planned | —                                         |
| UAT-051 | لا كشف مبكر           | M10.2  | planned | —                                         |
| UAT-052 | تغيير جواب            | M10.3  | planned | —                                         |
| UAT-053 | Flags                 | M10.4  | planned | —                                         |
| UAT-054 | مراجعة قبل التسليم    | M10.5  | planned | —                                         |
| UAT-055 | قطع اتصال             | M10.7  | planned | —                                         |
| UAT-056 | تقرير نهائي           | M10.8  | planned | —                                         |
| UAT-057 | وفرة المجموعات        | M11.6  | planned | —                                         |
| UAT-058 | نقص الجديد            | M11.6  | planned | —                                         |
| UAT-059 | لا تكرار              | M9.9   | planned | —                                         |
| UAT-060 | محاولة صحيحة واحدة    | M11.2  | planned | —                                         |
| UAT-061 | تكرر نجاح             | M11.2  | planned | —                                         |
| UAT-062 | خطأ بعد نجاح          | M11.3  | planned | —                                         |
| UAT-063 | يوم بال مستحقات       | M11.4  | planned | —                                         |
| UAT-064 | 8 صحيح و2 خطأ         | M12.1  | planned | —                                         |
| UAT-065 | عينة صغيرة            | M12.3  | planned | —                                         |
| UAT-066 | فلترة بنك             | M12.7  | planned | —                                         |
| UAT-067 | جودة الاستيراد        | M12.6  | planned | —                                         |
| UAT-068 | تقرير جلسة قديمة      | M12.5  | planned | —                                         |
| UAT-069 | بنك مصور              | M13.1  | planned | —                                         |
| UAT-070 | إخفاء الأسرار         | M13.1  | planned | —                                         |
| UAT-071 | نطاق فصل              | M13.1  | planned | —                                         |
| UAT-072 | PDF مكتمل             | M6.12  | planned | —                                         |
| UAT-073 | فشل قبل الاكتمال      | M6.12  | planned | —                                         |
| UAT-074 | حذف بنك A             | M13.5  | planned | —                                         |
| UAT-075 | حذف حساب              | M13.6  | planned | —                                         |
| UAT-076 | رابط غير مصرح         | M0.3   | partial | `tests/integration/library.test.ts`       |
| UAT-077 | مزود AI خارجي         | M2.6   | partial | `tests/e2e/ai-settings.spec.ts`           |
| UAT-078 | صورة مريض معرف        | M14.1  | planned | —                                         |
| UAT-079 | واجهة RTL             | M15.1  | partial | `tests/e2e/library.spec.ts`               |
| UAT-080 | واجهة LTR             | M15.1  | partial | `tests/e2e/language.spec.ts`              |
| UAT-081 | Dark mode             | M15.2  | partial | `tests/e2e/language.spec.ts`              |
| UAT-082 | هاتف صغير             | M15.3  | partial | `tests/e2e/library.spec.ts`               |
| UAT-083 | ألوان الملاحظات       | M15.2  | planned | —                                         |
| UAT-084 | مفتاح منتهي           | M2.4   | done    | `tests/integration/imports-rules.test.ts` |
| UAT-085 | تكرار مهمة فاشلة      | M4.7   | done    | `tests/integration/imports.test.ts`       |
| UAT-086 | تعديل سؤال في جلسة    | M10.9  | planned | —                                         |
