# التتبّع: المتطلبات الوظيفية (FR)

يربط كل بند في وثيقة المالك بخطوته في `docs/PLAN.md` وحالته الفعلية. يتحقق منه `tests/unit/docs/traceability.test.ts`: كل بند موجود مرة واحدة، وكل خطوة موجودة في الخطة، والحالة `done` تشير إلى اختبار موجود.

**الحالات:** `planned` مخطط · `partial` منفّذ جزئياً ومختبر · `done` منفّذ بالكامل ومختبر · `accepted` اعتمده المالك في اختبار القبول.
**المنشأ:** `سابق` = قرار سابق · `مقترح` = استكمال مقترح يحتاج اعتماد المالك.

| المعرّف   | المتطلب                       | المنشأ | الخطوة | الحالة  | الدليل                                            |
| --------- | ----------------------------- | ------ | ------ | ------- | ------------------------------------------------- |
| FR-01-001 | مكتبة خاصة لكل مستخدم         | سابق   | M0.3   | partial | `tests/integration/library.test.ts`               |
| FR-01-002 | محتوى يجلبه المستخدم          | سابق   | M1.5   | done    | `tests/e2e/library.spec.ts`                       |
| FR-01-003 | أمانة النص العلمي             | سابق   | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-01-004 | حظر الاختلاق                  | سابق   | M6.4   | planned | —                                                 |
| FR-01-005 | تقليل المراجعة البشرية        | سابق   | M7.1   | planned | —                                                 |
| FR-01-006 | العمل عبر الأجهزة             | سابق   | M9.7   | planned | —                                                 |
| FR-01-007 | لغتان أساسيتان                | سابق   | M15.1  | planned | —                                                 |
| FR-01-008 | حق تعديل المحتوى              | مقترح  | M7.6   | planned | —                                                 |
| FR-01-009 | وضوح سلوك AI                  | مقترح  | M7.7   | planned | —                                                 |
| FR-01-010 | قياس العمل الحقيقي            | مقترح  | M12.2  | planned | —                                                 |
| FR-02-001 | زائر غير مسجل                 | مقترح  | M1.1   | done    | `tests/e2e/landing.spec.ts`                       |
| FR-02-002 | مالك الحساب                   | سابق   | M0.2   | partial | `tests/integration/identity.test.ts`              |
| FR-02-003 | موظف دعم الخدمة               | مقترح  | M14.6  | planned | —                                                 |
| FR-02-004 | الخصوصية الافتراضية           | مقترح  | M14.3  | partial | `tests/integration/library.test.ts`               |
| FR-02-005 | إدارة الحساب                  | مقترح  | M1.6   | partial | `tests/integration/account.test.ts`               |
| FR-02-006 | الفصل بين الدعم والمراجعة     | مقترح  | M14.6  | planned | —                                                 |
| FR-02-007 | حذف محدد النطاق               | مقترح  | M13.5  | planned | —                                                 |
| FR-03-001 | بنك أسئلة مستقل               | سابق   | M0.3   | partial | `tests/integration/library.test.ts`               |
| FR-03-002 | مصادر متعددة                  | مقترح  | M4.9   | done    | `tests/integration/imports.test.ts`               |
| FR-03-003 | مجلدات وتصنيفات               | مقترح  | M1.4   | partial | `tests/integration/taxonomy.test.ts`              |
| FR-03-004 | إسناد المصدر والصفحة          | سابق   | M4.9   | done    | `tests/integration/imports.test.ts`               |
| FR-03-005 | البحث داخل المكتبة            | مقترح  | M12.11 | planned | —                                                 |
| FR-03-006 | فلاتر مركبة                   | مقترح  | M9.2   | planned | —                                                 |
| FR-03-007 | فرز يمكن فهمه                 | مقترح  | M1.5   | partial | `tests/e2e/bank-management.spec.ts`               |
| FR-03-008 | أرشفة بنوك                    | مقترح  | M1.3   | done    | `tests/integration/bank-editing.test.ts`          |
| FR-03-009 | نقل أسئلة مختارة              | مقترح  | M8.6   | planned | —                                                 |
| FR-03-010 | مكتبة فارغة مفيدة             | مقترح  | M1.5   | done    | `tests/e2e/library.spec.ts`                       |
| FR-04-001 | PDF نصي وممسوح                | سابق   | M4.1   | done    | `tests/integration/imports.test.ts`               |
| FR-04-002 | رفع متعدد                     | مقترح  | M4.2   | done    | `tests/e2e/import.spec.ts`                        |
| FR-04-003 | اختيار الوجهة                 | مقترح  | M4.2   | partial | `tests/e2e/import.spec.ts`                        |
| FR-04-004 | نطاق صفحات اختياري            | مقترح  | M4.2   | done    | `tests/integration/imports.test.ts`               |
| FR-04-005 | نوع المصدر اختياري            | مقترح  | M4.2   | done    | `tests/integration/imports.test.ts`               |
| FR-04-006 | لغة المصدر                    | مقترح  | M4.2   | partial | `tests/integration/imports.test.ts`               |
| FR-04-007 | إذن الحقوق                    | مقترح  | M4.2   | done    | `tests/integration/imports-rules.test.ts`         |
| FR-04-008 | إزالة قبل المعالجة            | مقترح  | M4.2   | done    | `tests/integration/imports-rules.test.ts`         |
| FR-04-009 | متابعة مراحل واضحة            | مقترح  | M4.3   | done    | `tests/e2e/import.spec.ts`                        |
| FR-04-010 | أعداد تقدم صحيحة              | مقترح  | M4.3   | done    | `tests/integration/imports.test.ts`               |
| FR-04-011 | تقرير مستقل لكل ملف           | مقترح  | M4.8   | done    | `tests/e2e/import.spec.ts`                        |
| FR-05-001 | قراءة النص المصوّر            | سابق   | M4.5   | done    | `tests/integration/imports.test.ts`               |
| FR-05-002 | حدود السؤال والخيارات         | سابق   | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-05-003 | سؤال يتجاوز الصفحة            | مقترح  | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-05-004 | الأعمدة المتجاورة             | مقترح  | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-05-005 | اختيارات غير أربعة            | سابق   | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-05-006 | الهوامش والعناوين             | مقترح  | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-05-007 | تمييز الشرح                   | سابق   | M6.8   | planned | —                                                 |
| FR-05-008 | المعادلات والوحدات            | مقترح  | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-05-009 | الجداول                       | مقترح  | M5.5   | planned | —                                                 |
| FR-05-010 | غير MCQ                       | مقترح  | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-05-011 | أمانة الصياغة                 | مقترح  | M4.6   | done    | `tests/integration/imports.test.ts`               |
| FR-06-001 | استخراج الصور المرتبطة        | سابق   | M5.2   | planned | —                                                 |
| FR-06-002 | إسناد الصورة الصحيح           | سابق   | M5.2   | planned | —                                                 |
| FR-06-003 | صور متعددة للسؤال             | مقترح  | M5.3   | planned | —                                                 |
| FR-06-004 | الامتداد عبر الصفحات          | مقترح  | M5.3   | planned | —                                                 |
| FR-06-005 | تكبير دون تشويه               | مقترح  | M5.7   | planned | —                                                 |
| FR-06-006 | جودة الصورة شرط قبول          | مقترح  | M5.4   | planned | —                                                 |
| FR-06-007 | هوية الصورة ووصفها            | مقترح  | M5.6   | planned | —                                                 |
| FR-06-008 | فصل الصورة عن الكتاب          | مقترح  | M5.8   | planned | —                                                 |
| FR-07-001 | مفتاح ظاهر في المصدر          | سابق   | M6.2   | planned | —                                                 |
| FR-07-002 | ملف إجابات منفصل              | مقترح  | M6.3   | planned | —                                                 |
| FR-07-003 | السؤال بلا مفتاح              | سابق   | M6.4   | planned | —                                                 |
| FR-07-004 | حالة اعتماد مستقلة            | سابق   | M6.1   | planned | —                                                 |
| FR-07-005 | تعارض المفتاح والتفسير        | مقترح  | M6.5   | planned | —                                                 |
| FR-07-006 | مقترح حل AI                   | مقترح  | M6.6   | planned | —                                                 |
| FR-07-007 | تغيير جواب مصحح               | مقترح  | M10.9  | planned | —                                                 |
| FR-07-008 | أجوبة متعددة                  | مقترح  | M6.7   | planned | —                                                 |
| FR-07-009 | شروحات المؤلف                 | مقترح  | M6.8   | planned | —                                                 |
| FR-07-010 | عدم كشف الحل مبكراً           | مقترح  | M10.2  | planned | —                                                 |
| FR-08-001 | القراءة والاستخراج بمساعدة AI | سابق   | M6.10  | planned | —                                                 |
| FR-08-002 | تصنيف موضوع السؤال            | سابق   | M6.9   | planned | —                                                 |
| FR-08-003 | كشف خلل المحتوى               | سابق   | M6.10  | planned | —                                                 |
| FR-08-004 | إصلاح اختياري مقيد            | سابق   | M6.10  | planned | —                                                 |
| FR-08-005 | شرح AI بعد الإجابة            | مقترح  | M9.4   | planned | —                                                 |
| FR-08-006 | مناقشة الخيارات               | مقترح  | M9.4   | planned | —                                                 |
| FR-08-007 | مراجعة بشرية للجماعي          | مقترح  | M7.5   | planned | —                                                 |
| FR-08-008 | سجل المنشأ والتعديل           | مقترح  | M7.7   | planned | —                                                 |
| FR-08-009 | مفتاح مزود لكل مستخدم         | سابق   | M2.2   | done    | `tests/integration/ai-providers.test.ts`          |
| FR-08-010 | اختيار مزود AI                | سابق   | M2.3   | done    | `tests/integration/ai-limits-isolation.test.ts`   |
| FR-08-011 | تحقق جاهزية المفتاح           | مقترح  | M2.4   | done    | `tests/integration/ai-providers.test.ts`          |
| FR-08-012 | إظهار حدود التكلفة            | مقترح  | M2.5   | done    | `tests/integration/imports-rules.test.ts`         |
| FR-08-013 | العمل دون مفتاح               | مقترح  | M2.7   | partial | `tests/integration/ai-limits-isolation.test.ts`   |
| FR-08-014 | رفض الاستنتاج غير المدعوم     | مقترح  | M6.10  | planned | —                                                 |
| FR-09-001 | طابور استثناءات مركز          | سابق   | M7.1   | planned | —                                                 |
| FR-09-002 | مراجعة سؤال مفرد              | مقترح  | M7.2   | planned | —                                                 |
| FR-09-003 | تحرير البيانات العلمية        | سابق   | M7.2   | planned | —                                                 |
| FR-09-004 | الاعتماد أو الإرجاء           | مقترح  | M7.3   | planned | —                                                 |
| FR-09-005 | التصحيح المقترح               | مقترح  | M7.4   | planned | —                                                 |
| FR-09-006 | اعتماد آمن جماعي              | مقترح  | M7.5   | planned | —                                                 |
| FR-09-007 | رفض/حذف                       | مقترح  | M7.6   | planned | —                                                 |
| FR-09-008 | التراجع وسجل التاريخ          | مقترح  | M7.7   | planned | —                                                 |
| FR-09-009 | ملاحظات المراجعة              | مقترح  | M7.8   | planned | —                                                 |
| FR-09-010 | بلاغ مشكلة أثناء الدراسة      | مقترح  | M7.9   | planned | —                                                 |
| FR-10-001 | كشف التطابق                   | سابق   | M8.1   | planned | —                                                 |
| FR-10-002 | كشف التشابه                   | مقترح  | M8.2   | planned | —                                                 |
| FR-10-003 | مقارنة المصدرين               | مقترح  | M8.3   | planned | —                                                 |
| FR-10-004 | خيارات القرار                 | مقترح  | M8.4   | planned | —                                                 |
| FR-10-005 | عزل التكرار داخل امتحان       | مقترح  | M9.9   | planned | —                                                 |
| FR-10-006 | إعادة استيراد بعد تحرير       | مقترح  | M8.5   | planned | —                                                 |
| FR-11-001 | معيار مكتمل                   | مقترح  | M6.11  | planned | —                                                 |
| FR-11-002 | حالات منتهية ومعلقة           | سابق   | M6.11  | planned | —                                                 |
| FR-11-003 | التصنيف للفصل والموضوع        | سابق   | M1.4   | partial | `tests/integration/taxonomy.test.ts`              |
| FR-11-004 | وسوم متعددة                   | مقترح  | M1.4   | partial | `tests/integration/taxonomy.test.ts`              |
| FR-11-005 | الصعوبة                       | مقترح  | M6.9   | planned | —                                                 |
| FR-11-006 | سجل تحرير النسخ               | مقترح  | M6.1   | planned | —                                                 |
| FR-11-007 | استبعاد الأسئلة غير الملائمة  | مقترح  | M6.11  | planned | —                                                 |
| FR-12-001 | اختيار نطاق الجلسة            | سابق   | M9.2   | planned | —                                                 |
| FR-12-002 | اختيار نوع الجلسة             | مقترح  | M9.3   | planned | —                                                 |
| FR-12-003 | إرسال الإجابة                 | سابق   | M9.4   | planned | —                                                 |
| FR-12-004 | شرح المؤلف                    | سابق   | M9.4   | planned | —                                                 |
| FR-12-005 | تفسير مساعد اختياري           | مقترح  | M9.4   | planned | —                                                 |
| FR-12-006 | تسجيل الاختيار والمحاولة      | مقترح  | M9.5   | planned | —                                                 |
| FR-12-007 | علامة للمراجعة                | مقترح  | M9.6   | planned | —                                                 |
| FR-12-008 | الانتقال والاستكمال           | مقترح  | M9.7   | planned | —                                                 |
| FR-12-009 | تكبير الوسائط                 | مقترح  | M5.7   | planned | —                                                 |
| FR-12-010 | ملخص الجلسة                   | مقترح  | M9.8   | planned | —                                                 |
| FR-12-011 | إعادة أخطاء الجلسة            | مقترح  | M9.8   | planned | —                                                 |
| FR-13-001 | اختيار العدد والنطاق          | سابق   | M10.1  | planned | —                                                 |
| FR-13-002 | بدون وقت                      | سابق   | M10.1  | planned | —                                                 |
| FR-13-003 | وقت إجمالي                    | سابق   | M10.1  | planned | —                                                 |
| FR-13-004 | وقت لكل سؤال                  | سابق   | M10.1  | planned | —                                                 |
| FR-13-005 | تأكيد قبل البداية             | مقترح  | M10.1  | planned | —                                                 |
| FR-13-006 | حجب الحلول أثناء الامتحان     | سابق   | M10.2  | planned | —                                                 |
| FR-13-007 | حفظ تلقائي للاختيارات         | سابق   | M10.3  | planned | —                                                 |
| FR-13-008 | خريطة الأسئلة                 | مقترح  | M10.4  | planned | —                                                 |
| FR-13-009 | علامات Flag                   | سابق   | M10.4  | planned | —                                                 |
| FR-13-010 | فحص التسليم                   | مقترح  | M10.5  | planned | —                                                 |
| FR-13-011 | نهاية الوقت                   | مقترح  | M10.6  | planned | —                                                 |
| FR-13-012 | استعادة المحاولة              | مقترح  | M10.7  | planned | —                                                 |
| FR-13-013 | نتيجة مفصلة بعد التسليم       | سابق   | M10.8  | planned | —                                                 |
| FR-13-014 | مراجعة بعد التسليم            | مقترح  | M10.8  | planned | —                                                 |
| FR-14-001 | الصيغة 50/30/20               | سابق   | M11.6  | planned | —                                                 |
| FR-14-002 | إعادة توزيع النقص             | سابق   | M11.6  | planned | —                                                 |
| FR-14-003 | تعريف الجديد                  | مقترح  | M11.6  | planned | —                                                 |
| FR-14-004 | تعريف الضعيف                  | مقترح  | M11.6  | planned | —                                                 |
| FR-14-005 | تعريف المستحق                 | مقترح  | M11.6  | planned | —                                                 |
| FR-14-006 | منع التكرار داخل الجلسة       | مقترح  | M9.9   | planned | —                                                 |
| FR-14-007 | تخصيص النسب                   | مقترح  | M11.6  | planned | —                                                 |
| FR-14-008 | إيضاح اختيار السؤال           | مقترح  | M11.7  | planned | —                                                 |
| FR-15-001 | سجل الأداء لكل سؤال           | سابق   | M11.2  | planned | —                                                 |
| FR-15-002 | مستويات الإتقان               | سابق   | M11.2  | planned | —                                                 |
| FR-15-003 | الثبات أهم من الإجابة الواحدة | مقترح  | M11.2  | planned | —                                                 |
| FR-15-004 | مراجعة متباعدة                | سابق   | M11.3  | planned | —                                                 |
| FR-15-005 | مراجعة اليوم                  | مقترح  | M11.4  | planned | —                                                 |
| FR-15-006 | أولوية المواضيع               | مقترح  | M11.5  | planned | —                                                 |
| FR-15-007 | تحكم المتعلم                  | مقترح  | M11.7  | planned | —                                                 |
| FR-15-008 | تعليل المواعيد                | مقترح  | M11.7  | planned | —                                                 |
| FR-16-001 | ملخص المكتبة                  | سابق   | M12.2  | planned | —                                                 |
| FR-16-002 | دقة الحل                      | سابق   | M12.1  | planned | —                                                 |
| FR-16-003 | تطور الأداء                   | مقترح  | M12.3  | planned | —                                                 |
| FR-16-004 | ضعف الموضوعات                 | سابق   | M12.4  | planned | —                                                 |
| FR-16-005 | معدلات الإجابة والمدة         | مقترح  | M12.4  | planned | —                                                 |
| FR-16-006 | تاريخ المحاولات               | سابق   | M12.5  | planned | —                                                 |
| FR-16-007 | جودة الاستيراد                | مقترح  | M12.6  | planned | —                                                 |
| FR-16-008 | فلاتر التقارير                | مقترح  | M12.7  | planned | —                                                 |
| FR-16-009 | أسباب الضعف المحتملة          | مقترح  | M12.8  | planned | —                                                 |
| FR-16-010 | اقتراح جلسة مفيدة             | مقترح  | M12.9  | planned | —                                                 |
| FR-16-011 | تصدير تقرير الدراسة           | مقترح  | M13.2  | planned | —                                                 |
| FR-17-001 | بحث متقدم                     | مقترح  | M12.11 | planned | —                                                 |
| FR-17-002 | Flags شخصية                   | سابق   | M12.12 | planned | —                                                 |
| FR-17-003 | مفضلة                         | مقترح  | M12.12 | planned | —                                                 |
| FR-17-004 | ملاحظات الطالب                | مقترح  | M12.12 | planned | —                                                 |
| FR-17-005 | تصفح دون تقييم                | مقترح  | M12.12 | planned | —                                                 |
| FR-17-006 | فلاتر المراجعة                | مقترح  | M12.12 | planned | —                                                 |
| FR-18-001 | تصدير بنك كامل                | سابق   | M13.1  | planned | —                                                 |
| FR-18-002 | تصدير نتائج                   | سابق   | M13.2  | planned | —                                                 |
| FR-18-003 | نطاق التصدير                  | مقترح  | M13.1  | planned | —                                                 |
| FR-18-004 | عدم تصدير الأسرار             | مقترح  | M13.1  | planned | —                                                 |
| FR-18-005 | الاستعادة المنظمة             | مقترح  | M13.3  | planned | —                                                 |
| FR-18-006 | إشعار المحتوى الذي لا يُنقل   | مقترح  | M13.1  | planned | —                                                 |
| FR-19-001 | حذف PDF بعد تحقق الاكتمال     | سابق   | M6.12  | planned | —                                                 |
| FR-19-002 | الملف الجزئي أو الفاشل        | مقترح  | M6.12  | planned | —                                                 |
| FR-19-003 | تنظيف بقايا المعالجة          | مقترح  | M6.12  | planned | —                                                 |
| FR-19-004 | حذف سؤال                      | مقترح  | M13.4  | planned | —                                                 |
| FR-19-005 | حذف بنك                       | مقترح  | M13.5  | planned | —                                                 |
| FR-19-006 | حذف الحساب                    | مقترح  | M13.6  | planned | —                                                 |
| FR-19-007 | نتيجة الحذف الفعلية           | مقترح  | M13.6  | planned | —                                                 |
| FR-19-008 | الفرق بين الأرشفة والحذف      | مقترح  | M1.3   | partial | `tests/integration/bank-editing.test.ts`          |
| FR-20-001 | المحتوى خاص افتراضياً         | سابق   | M14.3  | partial | `tests/integration/library.test.ts`               |
| FR-20-002 | مفتاح AI لا يُشارك            | سابق   | M2.2   | done    | `tests/integration/ai-limits-isolation.test.ts`   |
| FR-20-003 | الإفصاح عن معالجة AI          | مقترح  | M2.6   | partial | `tests/e2e/ai-settings.spec.ts`                   |
| FR-20-004 | تقليل بيانات الأشخاص          | مقترح  | M14.1  | planned | —                                                 |
| FR-20-005 | حقوق الكتب                    | مقترح  | M14.2  | partial | `tests/e2e/landing.spec.ts`                       |
| FR-20-006 | الاستخدام غير التجاري         | مقترح  | M14.2  | partial | `tests/e2e/landing.spec.ts`                       |
| FR-20-007 | شفافية الاحتفاظ               | مقترح  | M14.1  | partial | `tests/e2e/landing.spec.ts`                       |
| FR-20-008 | عدم كشف حسابات                | مقترح  | M14.3  | partial | `tests/integration/library.test.ts`               |
| FR-20-009 | مراجعة قانونية قبل النشر      | مقترح  | M17.6  | planned | —                                                 |
| FR-21-001 | عربية وإنجليزية كاملتان       | سابق   | M15.1  | partial | `tests/e2e/language.spec.ts`                      |
| FR-21-002 | الوضع الفاتح والداكن          | سابق   | M15.2  | partial | `tests/e2e/language.spec.ts`                      |
| FR-21-003 | العمل على الهاتف              | سابق   | M15.3  | partial | `tests/e2e/library.spec.ts`                       |
| FR-21-004 | أزرار واضحة                   | مقترح  | M15.5  | planned | —                                                 |
| FR-21-005 | قابلية القراءة                | مقترح  | M15.5  | planned | —                                                 |
| FR-21-006 | رسائل أخطاء عملية             | مقترح  | M15.5  | planned | —                                                 |
| FR-21-007 | حالات فارغة                   | مقترح  | M15.5  | planned | —                                                 |
| FR-21-008 | تناسق الأرقام                 | مقترح  | M12.1  | planned | —                                                 |
| FR-21-009 | إمكانية الوصول                | مقترح  | M15.4  | planned | —                                                 |
| FR-21-010 | حفظ التفضيلات                 | مقترح  | M1.6   | done    | `tests/e2e/account.spec.ts`                       |
| FR-22-001 | تفضيلات التعلم                | مقترح  | M1.6   | partial | `tests/integration/account.test.ts`               |
| FR-22-002 | مفاتيح مزود AI                | سابق   | M2.2   | done    | `tests/e2e/ai-settings.spec.ts`                   |
| FR-22-003 | تنبيه نجاح الاستيراد          | مقترح  | M4.8   | partial | `src/web/capabilities/sources/ImportProgress.tsx` |
| FR-22-004 | تذكير مراجعة اختياري          | مقترح  | M14.4  | planned | —                                                 |
| FR-22-005 | تغيير اللغة والمظهر           | مقترح  | M1.6   | done    | `tests/e2e/account.spec.ts`                       |
| FR-22-006 | مركز مساعدة سياقي             | مقترح  | M14.5  | planned | —                                                 |
| FR-22-007 | تواصل الدعم                   | مقترح  | M14.6  | planned | —                                                 |
| FR-22-008 | حد الاستخدام والتكلفة         | مقترح  | M2.5   | partial | `tests/integration/ai-limits-isolation.test.ts`   |
| FR-23-001 | ملف فاسد أو محمي              | مقترح  | M4.1   | done    | `tests/integration/imports-rules.test.ts`         |
| FR-23-002 | صفحة غير مقروءة               | مقترح  | M4.5   | done    | `tests/integration/imports.test.ts`               |
| FR-23-003 | انقطاع AI                     | مقترح  | M4.7   | done    | `tests/integration/imports-rules.test.ts`         |
| FR-23-004 | فشل جزئي في المصدر            | مقترح  | M4.7   | partial | `tests/integration/imports-rules.test.ts`         |
| FR-23-005 | إعادة المحاولة                | مقترح  | M4.7   | done    | `tests/integration/imports.test.ts`               |
| FR-23-006 | انقطاع أثناء Exam             | مقترح  | M10.7  | planned | —                                                 |
| FR-23-007 | تعديل سؤال خلال امتحان        | مقترح  | M9.1   | planned | —                                                 |
| FR-23-008 | حذف بنك خلال جلسة             | مقترح  | M10.10 | planned | —                                                 |
| FR-23-009 | خروج من خطأ                   | مقترح  | M15.5  | planned | —                                                 |
| FR-24-001 | معيار قبول علمي               | مقترح  | M6.11  | planned | —                                                 |
| FR-24-002 | العناية بالمعلومة الحديثة     | مقترح  | M7.10  | planned | —                                                 |
| FR-24-003 | بلاغ الطالب                   | مقترح  | M7.9   | planned | —                                                 |
| FR-24-004 | تدقيق أثر التصحيح             | مقترح  | M10.9  | planned | —                                                 |
| FR-24-005 | منع الحشو                     | مقترح  | M6.10  | planned | —                                                 |
| FR-24-006 | فحص جودة عينات الاستيراد      | مقترح  | M3.1   | partial | `tests/integration/extraction-benchmark.test.ts`  |
| FR-25-001 | تثبيت القرارات قبل التنفيذ    | مقترح  | M0.7   | planned | —                                                 |
| FR-25-002 | الاستيراد كامل المسار         | سابق   | M18.1  | planned | —                                                 |
| FR-25-003 | الدراسة والتقييم              | سابق   | M18.1  | planned | —                                                 |
| FR-25-004 | التقدم والتعلم الذكي          | سابق   | M18.1  | planned | —                                                 |
| FR-25-005 | الملكية والخروج               | سابق   | M18.1  | planned | —                                                 |
| FR-25-006 | استكمالات لاحقة               | مقترح  | M14.2  | planned | —                                                 |
| FR-25-007 | معايير جودة قبل التسليم       | مقترح  | M18.1  | planned | —                                                 |
