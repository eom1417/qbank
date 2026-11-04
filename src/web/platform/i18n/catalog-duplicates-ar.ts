import type { duplicatesEn } from './catalog-duplicates-en.js';

/** Strings of duplicates, re-import choices and moving questions (M8); same keys as catalog-duplicates-en.ts. */
export const duplicatesAr: Record<keyof typeof duplicatesEn, string> = {
  'duplicates.link': 'التكرارات',
  'duplicates.title': 'الأسئلة المكررة والمتشابهة',
  'duplicates.empty': 'لا أسئلة مكررة أو متشابهة في هذا البنك.',
  'duplicates.lead':
    'السؤال نفسه مرتين، أو سؤالان متقاربان. المتشابهان لا يُدمجان عنك أبداً: كلمة مثل «except» قد تقلب الإجابة.',
  'duplicates.exact': 'السؤال نفسه',
  'duplicates.similar': 'متشابه',
  'duplicates.likeness': 'التقارب:',
  'duplicates.differences': 'كلمات قد تغيّر الإجابة:',
  'duplicates.answersDiffer': 'إجابتاهما المعتمدتان مختلفتان.',
  'duplicates.answer': 'الإجابة:',
  'duplicates.from': 'من',
  'duplicates.keepBoth': 'أبقِ الاثنين',
  'duplicates.reference': 'اجعل هذا المرجع',
  'duplicates.hide': 'أخفِ هذا',
  'duplicates.acknowledge': 'أعرف أن الإجابتين مختلفتان، وأختار المرجع عن قصد.',
  'duplicates.decided.kept_both': 'أُبقي الاثنان',
  'duplicates.decided.reference': 'اختير مرجع',
  'duplicates.decided.excluded': 'أُخفي أحدهما',
  'reimport.title': 'استيراد جديد قرأ هذا السؤال بشكل مختلف',
  'reimport.lead': 'بقي نصك كما هو. قارنه بالقراءة الجديدة ثم اختر.',
  'reimport.mine': 'أبقِ نصي',
  'reimport.new': 'استخدم القراءة الجديدة',
  'transfer.title': 'انقل أو انسخ إلى بنك آخر',
  'transfer.target': 'البنك',
  'transfer.move': 'انقل',
  'transfer.copy': 'انسخ',
  'transfer.done': 'تم. الأسئلة المحتمل تكرارها في ذلك البنك:',
  'transfer.none': 'ليس لديك بنك آخر بعد.',
};
