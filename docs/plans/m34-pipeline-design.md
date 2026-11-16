# M34: تصميم خط الإنتاج في الكود (P2–P5)

يحكمه `m34-reading-curriculum.md`. هذا الملف يحدد **أين يعيش كل جزء وما عقده**، حتى يعمل الوكلاء بالتوازي بلا تداخل.

## المبدأ الحاكم من P0

القواعد الحالية تقرأ النص المكتوب بدقة عالية (لا إجابة خاطئة واحدة على الملفات الستة)، وتسقط حيث يكون الكلام داخل صور.
لذلك **خط الإنتاج يبني على القواعد ولا يستبدلها**:

1. **طبقة نص افتراضية:** نص الصفحة + نص OCR لكل صورة «كلام مطبوع» في مكانها من ترتيب القراءة. ثم يمر المحلل القائم
   (`parseQuestions`) على هذه الطبقة، فيقرأ أسئلة اللقطات (Allergy) كما يقرأ المكتوب، بلا AI.
2. **الـAI للحكم البصري فقط** وبأسئلة مغلقة على ورقة تجميع: نوع الصورة حين يتردد الكود، والخيار المعلَّم حين لا يحسمه الحبر.
3. **المكان بالترتيب:** صورة قبل خيارات سؤال = صورة السؤال، وبعد خياراته وقبل التالي = شرح، إلا ما يقول نصه «الصورة/الأشعة».

## الوحدات والملكية

| الملف | المحتوى | المرحلة |
| --- | --- | --- |
| `sources/domain/pipeline/units.ts` | `Unit` و`UnitKind` وترتيب القراءة (أعمدة، ويمين لليسار للعربية) | P2 |
| `sources/domain/pipeline/image-class.ts` | تصنيف الصورة بالكود من OCR وألوانها: `text_picture`، `handwriting`، `figure`، `table`، `unsure` | P2 |
| `sources/domain/pipeline/filler.ts` | الحشو: بصمة تتكرر في ≥30% من الصفحات، أو إطار/علامة مائية/شريط | P2 |
| `sources/domain/pipeline/family.ts` | عائلة المستند (D0.1) من إشارات الكود، وأي الدروس تعمل لها | P2 |
| `sources/adapters/pipeline-units.ts` | يبني وحدات ملف: طبقة النص، الصور الملصقة، قصها، OCR لكل صورة، إحصاء ألوانها، بصمتها | P2 |
| `sources/domain/pipeline/lesson.ts` | بطاقة الدرس (`id`، `level`، `needs`، السؤال، الإشارات، المخطط، الفحص الذاتي، `onFail`) | P3 |
| `sources/domain/pipeline/prompt-standard.ts` | القالب الواحد للتعليمات، برقم إصدار | P3 |
| `sources/domain/pipeline/sheet-layout.ts` و`adapters/sheet-image.ts` | ورقة التجميع: تخطيط الخلايا بأرقامها، وتركيب PNG بلا مكتبة جديدة (zlib المدمج) | P3 |
| `sources/use-cases/run-lesson.ts` و`adapters/step-cache.ts` | تشغيل درس: ذاكرة `ai_step_cache` بالبصمة، الفحص، الإعادة برسالة الخطأ، التصعيد، المراجعة بسبب مسمّى، والتوكنز | P3 |
| `sources/domain/pipeline/approved-models.ts` | النماذج المعتمدة لكل درس، وخفيف/قوي | P3 |
| `sources/domain/pipeline/lessons/*.ts` | الدروس: D1.2 نوع الصورة، D4.mark الخيار المعلَّم | P4 |
| `sources/domain/pipeline/virtual-text.ts` | طبقة النص الافتراضية من الوحدات لمحلل القواعد | P4 |
| `sources/domain/pipeline/placement.ts` | الملكية والمكان (D3.1، D3.2) | P4 |
| `sources/domain/pipeline/evidence.ts` | تجميع الأدلة (D4.6): الحبر، والمفتاح، ودرس الرؤية | P4 |
| `sources/domain/pipeline/value-filter.ts` | مُرشِّح القيمة وحدوده (Q56–Q58) | P5 |
| `sources/use-cases/read-with-pipeline.ts` | التنسيق: وحدات ← نص افتراضي ← محلل ← مكان ← أدلة ← مُرشِّح ← أسئلة بمكان صورها | P5 |
| الحفظ | `ImportedMedia` يحمل `placement` و`optionLetter`، و`replaceMedia` يكتبهما | P5 |
| `tools/extraction-bench/pipeline-bench.ts` | قياس خط الإنتاج على الحقيقة: التقسيم، الإجابات، المكان، اللقطات نصاً، تسرّب الشرح، المراجعة، التوكنز | P4–P5 |

## العقود بين الأجزاء

```ts
type UnitKind = 'text_line' | 'image' | 'filler';
interface Unit {
  id: string;            // "p3-u12": ثابت لكل ملف
  page: number;
  box: Box;              // نقاط PDF، الأصل أعلى اليسار
  kind: UnitKind;
  text: string | null;   // نص السطر، أو نص OCR للصورة
  ocr: { words: number; confidence: number } | null;
  imageClass: ImageClass | null;
  fingerprint: string | null; // للصور: بصمة المحتوى (K5)
  order: number;         // ترتيب القراءة في الصفحة
}
interface LessonCard<I, O> {
  id: string; level: number; needs: 'text' | 'vision'; version: number;
  question: string; yesCues: string[]; noCues: string[];
  schema: z.ZodType<O>; check(input: I, output: O): string | null; // رسالة الخطأ للإعادة
  reviewReason: string;
}
```

## التشغيل

- `import_job.ai_mode = 'pipeline'` هو الوضع الوحيد على الخادم عند وجود مزوّد وموافقة (`account.ai_consent_at`). بلا AI: لا استيراد،
  برسالة واضحة (Z4)، ولا تراجع صامت إلى القواعد.
- حد الاشتراك (`no_quota`، `rate_limited`): المهمة تتوقف وتعود بعد `locked_until`، وتكمل من ذاكرة الخطوات (لا يُدفع شيء مرتين).
- كل استدعاء يسجَّل: الدرس، النموذج، التوكنز، النتيجة. وتقرير الاستيراد يجمعها.

## القياس (البوابات)

- P2: ملفات مصطنعة 100%، وعلى الضبط: لا وحدة ضائعة (كل وحدة لها نوع)، والحشو معروف.
- P4/P5: على حقيقة الملفات السبعة بالخفيف: التقسيم ≥99%، الإجابة المطبوعة 100%، مكان الصور 100%، لا شرح مكشوف، والمراجعة ≤5%.
  ما لا يتحقق يُسجَّل بدرسه، ولا يُخفَّض حد.
