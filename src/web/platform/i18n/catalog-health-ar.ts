import type { healthEn } from './catalog-health-en.js';

/** Strings of system health; same keys as catalog-health-en.ts. */
export const healthAr: Record<keyof typeof healthEn, string> = {
  'health.title': 'صحة النظام',
  'health.allGood': 'كل شيء يعمل.',
  'health.ok': 'سليم',
  'health.attention': 'يحتاج انتباهك',
  'health.never': 'لم يحدث بعد',
  'health.ai': 'خدمة الذكاء الاصطناعي',
  'health.ai.ready': 'مزوّدون مسجّلو الدخول',
  'health.ai.unreachable': 'لا تستجيب',
  'health.ai.not_configured': 'غير مفعّلة (اختيارية)',
  'health.disk': 'القرص',
  'health.disk.free': 'متاحة',
  'health.backup': 'آخر نسخة احتياطية',
  'health.imports': 'الاستيراد هذا الأسبوع',
  'health.imports.fine': 'لم يفشل شيء',
  'health.imports.failed': 'تعذّر استيراد:',
  'health.imports.partial': 'استُورد جزئياً فقط:',
  'health.log': 'يحفظ QBank سجلّه هنا (بلا أسئلة أو ملاحظات):',
  'health.open': 'اعرف ما العمل',
  'health.problem.ai_unreachable':
    'خدمة الذكاء الاصطناعي لا تستجيب. أعد تشغيل QBank؛ مكتبتك تعمل بدونها.',
  'health.problem.disk_low':
    'المساحة المتاحة أقل من 1 غيغابايت: قد لا تتسع عمليات الاستيراد والنسخ الجديدة. أفرغ بعض المساحة.',
  'health.problem.backup_old':
    'لا نسخة احتياطية منذ يومين. أبقِ QBank يعمل قليلاً، أو انسخ الآن من الإعدادات.',
  'health.problem.import_failed':
    'لم يكتمل استيراد هذا الأسبوع. افتح تقريره لتعيد المحاولة أو تعرف السبب.',
};
