import type { helpEn } from './catalog-help-en.js';

/** Strings of notices, help and support (M14); same keys as catalog-help-en.ts. */
export const helpAr: Record<keyof typeof helpEn, string> = {
  'notice.title': 'مؤخراً',
  'notice.import.done': 'اكتمل استيراد:',
  'notice.import.review': 'ينتظر مراجعتك',
  'notice.import.partial': 'استُورد جزئياً فقط:',
  'notice.import.failed': 'تعذّر استيراد:',
  'notice.import.open': 'افتح التقرير',
  'notice.due': 'مراجعات مستحقة اليوم:',
  'notice.due.go': 'راجعها',
  'notice.dismiss': 'إخفاء',
  'settings.reminders': 'تذكير بالمراجعات المستحقة',
  'settings.reminders.off': 'متوقف',
  'settings.reminders.daily': 'مرة يومياً',
  'settings.reminders.weekly': 'مرة أسبوعياً',
  'help.link': 'المساعدة',
  'help.title': 'المساعدة',
  'help.lead': 'إجابات قصيرة عن أكثر الأسئلة شيوعاً. لا شيء هنا يقرأ محتواك.',
  'help.pending.title': 'لماذا ينتظر سؤال المراجعة؟',
  'help.pending.body':
    'لا يُذاكر السؤال إلا إذا كانت إجابته مؤكدة: من الكتاب، أو منك، أو من AI الخاص بك بعد قبولك. افتح المراجعة لترى سبب كل سؤال، ثم أصلحه أو اعتمده.',
  'help.due.title': 'ماذا يعني «مستحق»؟',
  'help.due.body':
    'السؤال الذي أجبت عنه يعود بعد مدة تطول مع كل إجابة صحيحة متتالية: 1، 2، 4، 8، 16، ثم 32 يوماً. والإجابة الخاطئة تعيده في اليوم التالي.',
  'help.ai.title': 'كيف أصحح إجابة اقترحها AI الخاص بي؟',
  'help.ai.body':
    'افتح السؤال من المراجعة. اختر الخيار الصحيح واحفظ: تصبح الإجابة إجابتك. وإن أردت إبقاء إجابة AI فاعتمدها؛ وتبقى عليها شارة «AI».',
  'help.import.title': 'كيف أتحقق مما أعطاه الاستيراد؟',
  'help.import.body':
    'افتح البنك ثم تقرير الملف. وتعرض التحليلات لكل ملف ما اكتُشف وما جهز وما ينتظر وما تكرر وما ينقصه مفتاح الإجابة.',
  'help.rights.title': 'ما الملفات التي يحق لي رفعها؟',
  'help.rights.body':
    'فقط الملفات التي يحق لك استخدامها لمذاكرتك. لا ترفع أبداً صفحات تكشف هوية مريض. QBank للمكتبات الشخصية: لا متجر فيه ولا مشاركة عامة.',
  'help.privacy.title': 'أين بياناتي؟',
  'help.privacy.body':
    'على جهازك، في مجلد بيانات QBank. مهام AI لا ترسل إلا الصفحات التي تحتاجها إلى المزوّد الذي اخترته. ويمكنك تصدير أي شيء أو حذفه من الإعدادات.',
  'support.title': 'أبلغ عن مشكلة',
  'support.lead':
    'يُنشئ هذا تقريراً بلا أسئلتك أو ملفاتك أو ملاحظاتك. اقرأه، ثم انسخه في رسالة أو بلاغ لمشروع QBank.',
  'support.build': 'أنشئ التقرير',
  'support.copy': 'انسخ التقرير',
  'support.copied': 'نُسخ',
  'error.screen.title': 'تعذّر فتح هذه الشاشة',
  'error.screen.body': 'لم يضع شيء مما حفظته. حاول مرة أخرى، أو ارجع إلى مكتبتك.',
  'error.screen.reload': 'حاول مرة أخرى',
  'error.screen.home': 'العودة إلى المكتبة',
};
