import type { localEn } from './catalog-local-en.js';

/** Arabic strings of local mode; the same keys as catalog-local-en.ts. */
export const localAr: Record<keyof typeof localEn, string> = {
  'local.pair.title': 'افتح QBank الخاص بك هنا',
  'local.pair.lead':
    'يعمل QBank على جهازك أنت، ويفتح فيه مباشرة. لتستخدمه من جوالك أو من متصفح آخر، أدخل رمز الربط من الجهاز الذي يشغّله (الإعدادات ← أجهزتك الأخرى).',
  'local.pair.code': 'رمز الربط',
  'local.pair.submit': 'اربط هذا المتصفح',
  'local.devices.title': 'أجهزتك الأخرى',
  'local.devices.lead':
    'افتح هذا الرابط في جوالك أو في متصفح آخر لتستخدم QBank نفسه هناك. من يملك الرابط يستطيع فتح QBank الخاص بك، فلا تعطه إلا لأجهزتك.',
  'local.devices.code': 'رمز الربط',
  'local.devices.copy': 'انسخ الرابط',
  'local.devices.qr': 'رمز QR لرابط QBank الخاص بك: امسحه بكاميرا الجوال',
  'local.devices.lanOff':
    'لا يستطيع الجوال فتح عنوان هذا الجهاز الداخلي. شغّل QBank بالأمر npm run qbank -- --lan ثم امسح الرمز الذي يظهر هنا (على نفس شبكة الواي فاي فقط).',
  'local.devices.install':
    'من الجوال اختر «إضافة إلى الشاشة الرئيسية» ليفتح QBank كتطبيق. التثبيت الكامل يعمل على العناوين الآمنة (https).',
  'local.devices.revokeLead':
    'فقدت جوالاً أو شاركت الرابط بالخطأ؟ أخرج كل الأجهزة الأخرى: يتوقف الرابط القديم ويحل محله رابط جديد.',
  'local.devices.revoke': 'أخرج كل الأجهزة الأخرى',
  'local.devices.revoke.confirm': 'أخرجها واصنع رابطاً جديداً',
  'local.devices.copied': 'نُسخ',
};
