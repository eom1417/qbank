import type { pipelineEn } from './catalog-pipeline-en.js';

/** Arabic strings of the M34 import pipeline; the same keys as catalog-pipeline-en.ts. */
export const pipelineAr: Record<keyof typeof pipelineEn, string> = {
  'error.ai_consent_required':
    'الاستيراد بذكائك الاصطناعي يرسل الملف إلى مزوّدك: وافق على ذلك أولاً.',
  'error.ai_required':
    'على هذا الخادم لا يُستورد ملف إلا بذكائك الاصطناعي. اختر أحد مزوّديك ثم أعد الاستيراد.',
  'import.consent.label': 'سيُرسل نص الملف وصور الصفحات إلى مزوّد الذكاء الاصطناعي الذي ربطته',
  'import.error.ai_not_ready':
    'اتصال الذكاء الاصطناعي غير متاح، فلم يُستورد شيء. تحقّق منه في مزوّدي الذكاء الاصطناعي ثم أعد المحاولة.',
  'import.error.ai_failed':
    'توقف ذكاؤك الاصطناعي قبل قراءة الملف، فلم يُستورد شيء. تحقّق منه في مزوّدي الذكاء الاصطناعي ثم أعد المحاولة.',
  'import.ai.providerSaid': 'وقال مزوّدك:',
  'import.error.ai_stopped':
    'توقف ذكاؤك الاصطناعي في منتصف الاستيراد. حُفظت أسئلة الملف، وما كان يحتاجه ينتظر في المراجعة. أعد المحاولة لإكماله.',
  'import.error.no_quota':
    'بقي اشتراك الذكاء الاصطناعي عند حدّه أكثر من 7 أيام، فتوقف الاستيراد. أعد المحاولة بعد تجدّد الاشتراك.',
  'import.cancelPaused': 'ألغِ هذا الاستيراد',
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
  'review.reason.single_signal': 'الإجابة على دليل واحد فقط، وتحتاج تأكيدًا',
  'review.reason.picture_place_unsure': 'مكان صورة غير مؤكد؛ أُخفيت حتى الكشف',
  'review.reason.unread_question_text':
    'بعد هذا السؤال نص يشبه سؤالًا لم يُقرأ؛ فقد يكون هناك سؤال ناقص',
  'import.step.inspect': 'فحص الملف',
  'import.step.read': 'قراءة الكلام',
  'import.step.roles': 'تحديد الأدوار',
  'import.step.link': 'ربط الأسئلة',
  'import.step.check': 'الفحص الذاتي',
  'import.step.assist': 'المساعدة بالذكاء الاصطناعي',
  'import.step.save': 'الحفظ',
  'review.reason.detection_doubt': 'الالتقاط غير متأكد من هذا السؤال؛ راجع أجزاءه',
  'import.report.detectionIssues': 'مواضع الالتقاط التي تحتاج مراجعة',
  'import.report.lines': 'الأسطر',
  'import.check.number': 'ترقيم السؤال يحتاج مراجعة',
  'import.check.stem': 'نص السؤال يحتاج مراجعة',
  'import.check.option_sequence': 'حروف الخيارات تحتاج مراجعة',
  'import.check.option_holds_other': 'قد يتضمن خيار نصًا لا يخصّه',
  'import.check.answer_in_options': 'الإجابة تشير إلى خيار غير موجود',
  'import.check.explanation_holds_question': 'قد يحتوي الشرح سؤالًا آخر',
  'import.check.parts_in_order': 'أجزاء السؤال ليست مرتبة',
  'import.check.picture_place': 'موضع الصورة يحتاج مراجعة',
  'import.check.case_link': 'الحالة المشتركة تحتاج مراجعة',
  'import.check.coverage': 'بعض أسطر المصدر تحتاج مراجعة',
  'import.check.numbering': 'يوجد انقطاع في ترقيم الأسئلة',
  'import.check.key_use': 'مطابقة مفاتيح الإجابة تحتاج مراجعة',
};
