import type { operatorEn } from './catalog-operator-en.js';

/** Strings of the server operator's console (M31); same keys as catalog-operator-en.ts. */
export const operatorAr: Record<keyof typeof operatorEn, string> = {
  'operator.title': 'إدارة الخادم',
  'operator.nav': 'الإدارة',
  'operator.lead': 'ما يحتاجه منك مستخدمو هذا الموقع. ترى من طلب ومتى، ولا ترى بنوكهم ولا أسئلتهم.',
  'operator.refresh': 'حدّث',
  'operator.feedback.title': 'الملاحظات',
  'operator.feedback.empty':
    'لا توجد ملاحظات مفتوحة. حين يستخدم أحدٌ «أرسل ملاحظة» في المساعدة، تظهر ملاحظته هنا.',
  'operator.feedback.meta': '{name} · {email} · {when}',
  'operator.feedback.where': 'الشاشة: {screen} · الإصدار: {version}',
  'operator.feedback.close': 'تمت المعالجة',
  'operator.resets.title': 'طلبات استعادة كلمة المرور',
  'operator.resets.lead':
    'أرسل لكل شخص رابطه بنفسك، بالواتساب أو الرسائل. كل رابط صالح لساعة واحدة.',
  'operator.resets.empty':
    'لا أحد ينتظر رابط استعادة. يظهر الطلب هنا حين يستخدم أحدٌ «نسيت كلمة المرور؟».',
  'operator.resets.requested': 'طلبه {when}',
  'operator.resets.validUntil': 'الرابط صالح حتى {when}',
  'operator.resets.expired': 'منتهي الصلاحية',
  'operator.resets.expiredHint':
    'انتهت صلاحية هذا الطلب. نسخ الرابط أو إرساله يُنشئ رابطاً جديداً صالحاً لساعة، فلا يحتاج صاحبه أن يطلب من جديد.',
  'operator.resets.copy': 'انسخ الرابط',
  'operator.resets.copied': 'نُسخ الرابط',
  'operator.resets.whatsapp': 'أرسل بالواتساب',
  'operator.resets.fresh': 'كان الرابط السابق منتهياً، فأُنشئ رابط جديد صالح حتى {when}.',
  'operator.resets.message':
    'مرحباً {name}، هذا رابط اختيار كلمة مرور جديدة لحسابك في QBank، وهو صالح لساعة واحدة: {link}',
  'operator.queue.title': 'طابور الاستيراد',
  'operator.queue.workers': 'يعمل حتى {n} من الاستيرادات في الوقت نفسه، واحد لكل حساب.',
  'operator.queue.empty': 'لا يوجد استيراد جارٍ ولا منتظر.',
  'operator.queue.running': 'جارٍ',
  'operator.queue.waiting': 'في الانتظار',
  'operator.queue.pages': 'الصفحات {done} من {total}',
  'operator.queue.since': 'منذ {when}',
  'feedback.lead.server':
    'مشكلة، أو قراءة سيئة لملف، أو فكرة: اكتبها هنا فتصل مباشرة إلى {operator}. لا يُرفق أي نص من أسئلتك أو ملفاتك.',
  'feedback.toOperator.send': 'أرسل',
  'feedback.toOperator.sent': 'وصلت ملاحظتك إلى {operator}. شكراً لك.',
  'feedback.toOperator.tooMany':
    'أرسلت ملاحظات كثيرة خلال الساعة الأخيرة. انتظر قليلاً ثم أرسل من جديد.',
  'auth.forgot.intro.server':
    'اكتب بريدك الإلكتروني. سيصل طلبك إلى {operator}، وسيرسل لك رابط الاستعادة بالواتساب أو الرسائل. الرابط صالح لساعة واحدة.',
  'auth.forgot.sent.server':
    'إن كان لهذا البريد حساب فقد وصل طلبك إلى {operator}، وسيرسل لك رابط الاستعادة بالواتساب أو الرسائل. الرابط صالح لساعة واحدة.',
  'auth.signUp.operator': 'هذا الموقع يديره {operator}.',
  'auth.signUp.whereData': 'أين بياناتي؟',
  'import.queue.next': 'ملفك هو التالي، ويبدأ تلقائياً.',
  'import.queue.ahead.one': 'في الطابور: قبلك ملف واحد، ويبدأ ملفك تلقائياً بعده.',
  'import.queue.ahead.two': 'في الطابور: قبلك ملفان، ويبدأ ملفك تلقائياً بعدهما.',
  'import.queue.ahead.few': 'في الطابور: قبلك {n} ملفات، ويبدأ ملفك تلقائياً بعدها.',
  'import.queue.ahead.many': 'في الطابور: قبلك {n} ملفاً، ويبدأ ملفك تلقائياً بعدها.',
  'import.queue.ahead.other': 'في الطابور: قبلك {n} ملف، ويبدأ ملفك تلقائياً بعدها.',
  'auth.google.continue': 'متابعة بحساب Google',
  'auth.google.signUpHint':
    'يُنشأ حسابك هنا ببريد حسابك في Google، ولا نرى كلمة مرور Google أبداً.',
  'auth.google.error.google': 'تعذّر الدخول بحساب Google. حاول مرة أخرى.',
  'auth.google.error.terms': 'وافق على الشروط أولاً لإنشاء حسابك.',
  'auth.google.error.too_many_attempts':
    'محاولات كثيرة خلال وقت قصير. انتظر ربع ساعة ثم حاول من جديد.',
  'settings.google.title': 'الدخول',
  'settings.google.signedInAs': 'تدخل بحساب Google:',
  'operator.backup.title': 'النسخ الاحتياطي',
  'operator.backup.last': 'آخر نسخة احتياطية {when}',
  'operator.backup.ok': 'نجحت',
  'operator.backup.failedBadge': 'فشلت',
  'operator.backup.kept': 'النسخ المحفوظة على الخادم: {n}',
  'operator.backup.none': 'لم تُنفَّذ نسخة احتياطية بعد على هذا الخادم.',
  'operator.backup.failed':
    'فشلت آخر نسخة احتياطية. راجع خدمة النسخ على الخادم قبل أن تتعرض البيانات للخطر.',
  'operator.backup.late':
    'مضى على آخر نسخة احتياطية أكثر من يومين. تأكد أن خدمة النسخ ما زالت تعمل.',
};
