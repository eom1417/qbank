# مرجع الخطة: الملفات والتحقق

نُقل من `docs/PLAN.md` في M30 ليبقى ملف الخطة تحت 400 سطر (القسمان كما كانا، بلا تغيير في المعنى). الخطة نفسها ومراحلها في `docs/PLAN.md`.

## الملفات الأساسية

- **قائمة الآن:** `BLUEPRINT.md` (خريطة المالكين، تُحدَّث كل مرحلة)، و`engineering.json` (الفحوص)، و`setup.sh`.
- **مجلدات قائمة تُوسَّع:** `src/server/capabilities/*` لكل قدرة، و`src/contracts/*` لمصدر الصيغ الوحيد، و`migrations/`.
- **ملفات وقدرات جديدة:**
  - ملفات وثائق: `docs/traceability/` و`docs/DECISIONS.md` و`docs/PLAN.md` (هذه الخطة).
  - قدرات جديدة في الخادم: `sources` و`questions` و`ai` و`study` و`learning` و`analytics` و`portability`.
- **عناصر قائمة يُعاد استخدامها:**
  - `requireActor` في `identity/index.ts`.
  - `parseInput` و`AppError` و`notFound` و`createOriginGuard` في `platform/`.
  - `apiRequest` و`useQuery` و`useSubmit` في الواجهة.
  - مكونات `design-system`.
  - `useTestApp` و`registeredBrowser` في الاختبارات.

## التحقق من كل مرحلة

- **أثناء العمل:** اختبارات مركّزة، ثم `G check`.
- **في نهاية المرحلة:**
  - `G check --full`.
  - اختبارات المتصفح بالعربي والإنجليزي.
  - تشغيل حالات القبول الخاصة بالمرحلة.
  - لقطات شاشة، ورابط تجربة لك.
  - تحديث ملف التتبّع.
- **عند تغيير أي فحص:** `G prove`.
- **قبل الإطلاق:** `G check --release` وفحوص البيئة الحقيقية.
