import type { triageEn } from './catalog-triage-en.js';

/** Arabic strings of the AI triage choice; the same keys as catalog-triage-en.ts. */
export const triageAr: Record<keyof typeof triageEn, string> = {
  'triage.with':
    'ذكاؤك الاصطناعي يفحص كل سؤال: نموذجان يحلّانه كلٌّ وحده، ونموذج أقوى يحسم أي خلاف، ولا يصلك إلا الخلاف الحقيقي.',
  'triage.quality': 'مستوى الدقة',
  'triage.quality.high': 'عالية (أقوى النماذج، تستهلك من اشتراكك أكثر)',
  'triage.quality.balanced': 'متوازنة (موصى بها)',
  'triage.quality.economy': 'اقتصادية (أخف النماذج)',
  'triage.quality.custom': 'مخصّصة (اختر كل نموذج)',
  'triage.role.solvers': 'الحل',
  'triage.role.first': 'الحلّال الأول',
  'triage.role.second': 'الحلّال الثاني',
  'triage.role.judge': 'الحَكَم',
  'triage.role.improver': 'التحسين',
  'triage.improve': 'حسّن الأسئلة أولاً',
  'triage.improve.hint':
    'يصحح الإملاء والقواعد وتشويه القراءة دون تغيير المطلوب، ويضيف للسؤال الذي فيه أقل من 3 خيارات خيارات خاطئة منطقية (4 خيارات). الأصل يبقى في سجل السؤال.',
  'triage.recheck': 'افحص من جديد بالذكاء الاصطناعي',
  'triage.recheck.lead':
    'ذكاؤك الاصطناعي يفحص أسئلة هذا الملف من جديد: يحسم إجاباتها، ويحسّنها إن اخترت. الإجابات التي حددتها بنفسك لا تتغيّر أبداً.',
  'triage.recheck.start': 'ابدأ الفحص',
  'triage.fileSaid': 'الملف يقول:',
  'triage.why': 'السبب:',
  'triage.improve.off': 'دون تحسين الأسئلة',
};
