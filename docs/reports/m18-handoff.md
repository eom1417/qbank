# M18.3 and M18.5: Handoff report

Date: 2026-11-04. QBank Engine, open source (MIT), running on its owner's own computer.

## What was completed

| Area                               | What it delivers                                                                                                                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import (M3–M6)                     | Text and scanned PDFs (OCR in Arabic and English). Answer keys, pen marks, figures and tables. Separate answer files. An honest report per file.                                                                                                                 |
| AI (DEC-30, then on)               | The owner's own subscription or key through the vendored kit. Sign-in to Codex and Claude from any device. The model is chosen per task. The AI can read whole pages (questions, options, the printed key and explanation, pictures). AI is optional throughout. |
| Review (M7–M8)                     | A queue by severity. A full editor: text, options, key, explanation, newer note, chapter, topic, tags, difficulty. History and undo. AI fix suggestions as a diff. Duplicates side by side.                                                                      |
| Study (M9–M11)                     | Tutor and exams with server-side timing. Mastery and spaced review. Smart Mix and today's plan. Reports from study. Preferences that apply.                                                                                                                      |
| Progress (M12)                     | One definition per figure (score, accuracy, each with its base). Trend, history, search, reading mode.                                                                                                                                                           |
| Ownership and exit (M13)           | Export and untrusted restore. Bank and full deletion with a preview. A results report.                                                                                                                                                                           |
| Privacy (M14)                      | Neutral not-found everywhere, a patient-data warning, notices, optional reminders, Help, and a content-free support report.                                                                                                                                      |
| Quality (M15, DEC-32)              | WCAG 2.2 AA in every skin, light and dark, desktop and phone. Four skins chosen in Settings.                                                                                                                                                                     |
| Local install (DEC-31, M16.5, M17) | One-command install; a phone through a QR code and PWA; daily backups with restore; a copy to a synced folder; logs and a system-health card; a security review with every finding fixed; scale checks (1,500 pages, 10,000 questions).                          |

The evidence is in `docs/reports/m18-acceptance.md` (all 86 acceptance cases, each with its test), `m17-security.md` and `m17-performance.md`.

## Known limits

- **Reading quality.** Measured only on the reference samples there are. A real scan, a two-column book, a separate key file and essays are still missing (FR-24-006, DEC-21).
- **Reading a whole book with AI.** It sends one request per page: slower, and it counts against the owner's subscription. Every question it reads waits for review.
- **The phone on the LAN uses plain HTTP.** Use a trusted network. "Sign out every other device" cuts off a lost phone. HTTPS installs the PWA fully.
- **Windows runs QBank inside WSL.**
- **FR-16-009.** Linking an OCR defect that the owner confirmed to the "possible question problems" figure is not built. The figure counts questions that were reported and then answered wrong.
- **One OCR-heavy integration test** (`imports-media`) failed once under full-suite load and passed on rerun.

## Support plan

- **Self-service:** Settings → System health, the log (`.data/app/logs/qbank.log`, no content), the backups, and Help.
- **Reporting:** Help → "Report a problem" builds a report with counts and versions only, which the owner reads and copies.
- **Updating:** pull the new version, run `bash scripts/install.sh` again (it adds only what is missing), then `qbank`. The database migrates itself at start, and a backup is made on the day's first start.

## Waiting for the owner

1. **M16.1, GitHub:** the repository, CI and branch protection. This needs `GITHUB_SSH_KEY` and your approval before any push. `G prove` and `ready=true` follow; DEC-27 is applied there.
2. **M16.2, live check:** sign in to Codex too, then a one-page check per provider and the extraction benchmark with your vision model.
3. **FR-20-009:** a legal review of data protection by a specialist, before any public release.
4. **FR-24-006:** the missing reference samples, each with its answer key.
5. **M18.3 and FR-25-001:** sign the decisions applied with the spec's default (`assumed`), or change any of them.

| Decision | Question                                                                | Applied                                                                                                                                                                                                                      |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-03   | هل يمكن اعتماد جواب مقترح من AI بقرار المستخدم دون مفتاح من المصدر؟     | مؤقت منذ M6.6: المستخدم يعتمد جواب AI صراحةً، وتبقى شارة «اقترحه AI» دائماً على السؤال.                                                                                                                                      |
| DEC-04   | ما نطاق إصلاح AI: تغيير لغة المصدر أم أخطاء القراءة الواضحة فقط؟        | مؤقت منذ M6.10: تُكشف الأخطاء المثبتة فقط (خيارات مكررة، أقل من خيارين، نص مشوه)، ولا يُعاد صياغة شيء.                                                                                                                       |
| DEC-05   | هل الأسئلة متعددة الإجابات (Multiple Select) إلزامية من أول إصدار؟      | مؤقت منذ M6.7: نموذج البيانات يحمل عدة إجابات، ويُكتشف السؤال متعدد الإجابات من نصه («اختر اثنين»)؛ عرضه في المذاكرة حسب العينات.                                                                                            |
| DEC-06   | هل يُسلَّم الامتحان تلقائياً عند نهاية الوقت الإجمالي؟                  | نعم: عند انتهاء الوقت الإجمالي يُسلَّم الامتحان بالإجابات المحفوظة، ويحسم ذلك الخادم لا المتصفح، والقاعدة تُعرض قبل البدء.                                                                                                   |
| DEC-07   | هل يُسمح بالرجوع بعد انتهاء وقت السؤال؟                                 | في وقت لكل سؤال: التنقل للأمام فقط، ويُقفل السؤال عند انتهاء وقته أو مغادرته، ويُعلن ذلك قبل البدء.                                                                                                                          |
| DEC-08   | هل يُحسب السؤال المتروك خطأً في الدرجة الإجمالية؟                       | المتروك يظهر منفصلاً؛ الدرجة = الصحيح ÷ كل الأسئلة، والدقة = الصحيح ÷ المُجاب، وتُعرض المعادلتان.                                                                                                                            |
| DEC-09   | هل خلط ترتيب الخيارات افتراضي أم اختياري؟                               | ترتيب الخيارات كما في المصدر، بلا خلط.                                                                                                                                                                                       |
| DEC-10   | هل تبقى نسب Smart Mix ثابتة على 50/30/20، أم يختار المستخدم حصصاً أخرى؟ | الافتراضي 50/30/20 مع تعديل اختياري وزر للعودة؛ النقص يُوزَّع بنسبة الحصص ويُعرض التكوين الفعلي. التفاصيل: `docs/policies/mastery.md`.                                                                                       |
| DEC-11   | ما الشروط الدقيقة للانتقال بين مستويات الإتقان؟                         | المستويات من الثبات: جديد، ضعيف (خطآن من آخر ثلاث)، قيد التعلم، جيد (2–3 صحيحة متتالية)، متقن (4 متتالية عبر أسبوع فأكثر). `docs/policies/mastery.md`.                                                                       |
| DEC-12   | ما فواصل المراجعة الأساسية، وكيف تؤثر المحاولة الخاطئة؟                 | الفاصل يتضاعف مع السلسلة: 1، 2، 4، 8، 16، 32 يوماً؛ الخطأ يعيده إلى يوم؛ لا عقوبة على الانقطاع. `docs/policies/mastery.md`.                                                                                                  |
| DEC-13   | كم يبقى الملف الأصلي متاحاً للاستعادة إن تعطّل الاستيراد؟               | مؤقت منذ M6.12: الأصل يُحذف تلقائياً بعد 7 أيام من انتهاء استيراده (`QBANK_ORIGINAL_RETENTION_DAYS`)، ويُعرض تاريخ الحذف، ويمكن حذفه فوراً.                                                                                  |
| DEC-14   | هل يعتمد المستخدم الجزء المنجز قبل حذف الأصل بعد نجاح جزئي؟             | مؤقت منذ M6.12: بعد نجاح جزئي لا يُحذف الأصل تلقائياً حتى يحسم المستخدم.                                                                                                                                                     |
| DEC-15   | هل تُدعم استعادة سجلات المحاولات القديمة من ملف صادر، أم الأسئلة فقط؟   | الاستعادة تشمل الأسئلة والخيارات والإجابات والشروح والصور والتصنيف والوسوم والملاحظات، لا سجل المحاولات؛ ويُذكر ذلك في الملف وفي المعاينة.                                                                                   |
| DEC-17   | ما مزوّدو AI الذين تظهر أسماؤهم للمستخدم عند الإطلاق؟                   | مؤقتاً: (1) الدخول بالاشتراك: Claude (Pro/Max) وChatGPT (Plus/Pro عبر Codex) بالأدوات الرسمية — **المالك قرر 2026-11-03 تفعيله ويتحمل خطر شروط Anthropic**؛ (2) مفتاح API: OpenAI، وAnthropic، وDeepSeek، وGoogle Gemini، وO |
| DEC-19   | هل يكفي تنزيل شخصي للتقرير، أم يلزم رابط قابل للمشاركة؟                 | تنزيل شخصي فقط (ملف HTML للتقرير، وZIP للبنك)؛ بلا روابط مشاركة.                                                                                                                                                             |
| DEC-20   | بعد حذف بنك: هل يبقى تقرير تاريخي مجرد، أم يُحذف كل أثر؟                | حذف البنك يمحو كل أثر لأسئلته، ومنه بنودها في الجلسات، وتُحذف الجلسة التي تفرغ؛ نتائج البنوك الأخرى لا تتأثر.                                                                                                                |
| DEC-21   | ما حدود جودة القراءة والاستخراج المقبولة حسب نوع المصدر؟                | مؤقتاً، مقيسة على 3 ملفات (163 سؤالاً): ملف بطبقة نص: أسئلة ≥98%، صفحات ≥98%، خيارات ≥95%، إجابات مُكتشفة ≥85%، إجابات خاطئة ≤2%. القراءة الضوئية (مسح محاكى): حدود دنيا ضد التراجع فقط (خيارات ≥65%، إجابات ≥45%، خاطئة ≤5% |
| DEC-22   | هل تُفعَّل تذكيرات الدراسة تلقائياً؟                                    | التذكير بالمراجعات المستحقة مطفأ افتراضياً؛ يختار المالك من الإعدادات: مطفأ، يومياً، أسبوعياً. يظهر داخل التطبيق فقط، بلا بريد أو إشعار خارجي.                                                                               |
| DEC-23   | هل يُوسَّع النطاق لاحقاً إلى متجر أو مشاركة عامة؟                       | لا متجر ولا مشاركة عامة: كل بنك شخصي على جهاز صاحبه، والنقل بين الأجهزة بالتصدير والاستعادة فقط.                                                                                                                             |
| DEC-24   | هل يلزم تطبيق هاتف مستقل (Native App) بجانب الويب؟                      | لا تطبيق هاتف مستقل؛ الويب يعمل كاملاً على الهاتف الصغير ويُفحص في كل اختبارات المتصفح (desktop + phone).                                                                                                                    |

## Sign-off

Scope accepted by the owner: ______________________ Date: ____________
