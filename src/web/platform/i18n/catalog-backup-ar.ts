import type { backupEn } from './catalog-backup-en.js';

/** Strings of full local backups; same keys as catalog-backup-en.ts. */
export const backupAr: Record<keyof typeof backupEn, string> = {
  'backup.title': 'النسخ الاحتياطية',
  'backup.lead':
    'ينسخ QBank كل شيء هنا مرة يومياً: البنوك والأسئلة والجلسات والملاحظات والصور. يحتفظ بأحدث 7 نسخ ونسخة من كل أسبوع من الأسابيع الأربعة قبلها. تسجيلات دخول الذكاء الاصطناعي ليست ضمن النسخ.',
  'backup.now.make': 'أنشئ نسخة احتياطية الآن',
  'backup.none': 'لا نسخ بعد. أول نسخة تُصنع اليوم.',
  'backup.reason.daily': 'يومية',
  'backup.reason.manual': 'صنعتها أنت',
  'backup.reason.before_restore': 'قبل استرجاع',
  'backup.open': 'استرجاع…',
  'backup.close': 'إغلاق',
  'backup.inBackup': 'في هذه النسخة',
  'backup.now': 'الموجود الآن',
  'backup.banks': 'بنوك',
  'backup.questions': 'أسئلة',
  'backup.sessions': 'جلسات',
  'backup.pictures': 'صور',
  'backup.restoreWarning':
    'كل ما هو موجود الآن يُستبدل بهذه النسخة. يحفظ QBank نسخة من الوضع الحالي أولاً، فتستطيع الرجوع.',
  'backup.restore': 'استرجع هذه النسخة',
  'backup.restore.confirm': 'استبدل كل شيء بهذه النسخة',
  'backup.copy.label': 'انسخ كل نسخة احتياطية أيضاً إلى هذا المجلد',
  'backup.copy.hint':
    'مجلد يزامنه تطبيقك السحابي (Google Drive أو iCloud أو OneDrive) لتبقى نسخة خارج هذا الجهاز. اكتب المسار الكامل، مثل /Users/you/Google Drive/QBank.',
  'backup.copy.save': 'استخدم هذا المجلد',
  'backup.copy.stop': 'أوقف النسخ',
  'backup.copy.none': 'النسخ الاحتياطية على هذا الجهاز فقط.',
  'backup.copy.last': 'آخر نسخ:',
  'backup.copy.failed': 'فشل آخر نسخ: تأكد أن المجلد ما زال موجوداً وفيه مساحة.',
  'backup.copy.problem.not_absolute': 'اكتب المسار الكامل بدءاً من المجلد الأعلى.',
  'backup.copy.problem.not_a_folder': 'لا يوجد مجلد في هذا المسار.',
  'backup.copy.problem.inside_data': 'اختر مجلداً خارج بيانات QBank نفسها.',
  'backup.copy.problem.not_writable': 'لا يستطيع QBank الكتابة في هذا المجلد.',
};
