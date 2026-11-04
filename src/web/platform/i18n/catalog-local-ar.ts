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
  'local.devices.copied': 'نُسخ',
};
