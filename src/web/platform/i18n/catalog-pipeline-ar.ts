import type { pipelineEn } from './catalog-pipeline-en.js';

/** Arabic strings of the M34 import pipeline; the same keys as catalog-pipeline-en.ts. */
export const pipelineAr: Record<keyof typeof pipelineEn, string> = {
  'error.ai_consent_required':
    'الاستيراد بذكائك الاصطناعي يرسل الملف إلى مزوّدك: وافق على ذلك أولاً.',
  'import.consent.label': 'سيُرسل نص الملف وصور الصفحات إلى مزوّد الذكاء الاصطناعي الذي ربطته',
  'import.error.ai_not_ready':
    'اتصال الذكاء الاصطناعي غير متاح، فلم يُستورد شيء. تحقّق منه في مزوّدي الذكاء الاصطناعي ثم أعد المحاولة.',
  'import.error.ai_failed':
    'توقف ذكاؤك الاصطناعي قبل قراءة الملف، فلم يُستورد شيء. تحقّق منه في مزوّدي الذكاء الاصطناعي ثم أعد المحاولة.',
  'import.paused': 'بلغ اشتراك الذكاء الاصطناعي حدّه. سيكمل الاستيراد وحده من حيث توقف عند',
  'import.usage.title': 'استهلاك الذكاء الاصطناعي',
  'import.usage.lesson': 'الخطوة',
  'import.usage.calls': 'الطلبات',
  'import.usage.tokens': 'التوكنز دخولاً / خروجاً',
  'import.usage.estimated': 'تقديري',
  'import.usage.review': 'أسئلة ذهبت للمراجعة',
  'review.reason.single_option': 'طُبع خيار واحد فقط',
  'review.reason.none_of_options': 'يقول الملف إن الإجابة ليست من الخيارات',
  'review.reason.key_doubt': 'المفتاح المطبوع نفسه مشكوك فيه',
  'review.reason.answer_conflict': 'علامات الإجابة في الملف متعارضة',
  'review.reason.mark_unclear': 'تعذّرت قراءة الخيار المعلَّم',
  'review.reason.picture_unreadable': 'تعذّرت قراءة صورة فيها كلام السؤال',
};
