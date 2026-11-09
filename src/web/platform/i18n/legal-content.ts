import type { AppMode, Locale } from '../../../contracts/identity.js';

/** One titled section of a legal page. */
interface LegalSection {
  heading: string;
  body: string;
}

type LegalPage = 'terms' | 'privacy';

/**
 * Draft legal texts (FR-20-005..007). They describe what the product actually does today and
 * must be reviewed by a qualified person before public launch (FR-20-009, plan step M17.6).
 */
const LEGAL: Record<Locale, Record<LegalPage, LegalSection[]>> = {
  en: {
    terms: [
      {
        heading: 'Your content, your rights',
        body: 'Upload only files you are allowed to use. QBank Engine does not take ownership of your files and does not turn them into a library for anyone else.',
      },
      {
        heading: 'Personal, non-commercial use',
        body: 'The service builds personal libraries. It has no store and no resale of questions or publishers’ answers; a question leaves a bank only through a share its owner sets up and controls.',
      },
      {
        heading: 'Honest answers',
        body: 'A question is graded only when its answer is approved. AI suggestions are always labelled as suggestions and never presented as the book’s answer.',
      },
      {
        heading: 'Patient data',
        body: 'Do not upload images or documents that identify a patient. Remove names and identifiers before uploading.',
      },
    ],
    privacy: [
      {
        heading: 'Private by default',
        body: 'Every bank, file, image, question, note, session and report belongs to you only. QBank runs on your own computer: nothing is sent to its makers, and there is no support role that can read your content.',
      },
      {
        heading: 'What we keep after an import',
        body: 'The extracted questions, their options, keys, explanations, needed images and source page references, in QBank’s data folder on your computer. The original PDF is erased a few days after its import ends (7 by default), or at once when you delete it.',
      },
      {
        heading: 'AI processing',
        body: 'When you run an AI task, the pages it needs are sent to the AI provider you signed in to; that provider’s terms apply. Your sign-ins and keys stay with the AI providers part of QBank on your computer and are never exported.',
      },
      {
        heading: 'Deleting and exporting',
        body: 'You can export a bank, archive it, delete it, or delete your whole account. Each action explains what it affects before you confirm it.',
      },
    ],
  },
  ar: {
    terms: [
      {
        heading: 'محتواك وحقوقك',
        body: 'ارفع فقط الملفات التي يحق لك استخدامها. لا يتملّك محرك بنك الأسئلة ملفاتك، ولا يحوّلها إلى مكتبة لأي شخص آخر.',
      },
      {
        heading: 'استخدام شخصي غير تجاري',
        body: 'الخدمة تبني مكتبات شخصية. لا يوجد فيها متجر ولا إعادة بيع لأسئلة أو لإجابات الناشرين، ولا يخرج سؤال من بنك إلا بمشاركة ينشئها صاحبه ويتحكم فيها.',
      },
      {
        heading: 'إجابات صادقة',
        body: 'لا يُصحَّح سؤال إلا إذا كان جوابه معتمداً. اقتراحات AI تظهر دائماً بوصفها اقتراحات، ولا تُقدَّم أبداً على أنها جواب الكتاب.',
      },
      {
        heading: 'بيانات المرضى',
        body: 'لا ترفع صوراً أو مستندات تكشف هوية مريض. أزل الأسماء والمعرّفات قبل الرفع.',
      },
    ],
    privacy: [
      {
        heading: 'خاص افتراضياً',
        body: 'كل بنك وملف وصورة وسؤال وملاحظة وجلسة وتقرير ملك لك وحدك. يعمل QBank على جهازك: لا يُرسل شيء إلى صانعيه، ولا يوجد دور دعم يستطيع قراءة محتواك.',
      },
      {
        heading: 'ما نحتفظ به بعد الاستيراد',
        body: 'الأسئلة المستخرجة وخياراتها ومفاتيحها وشروحها، والصور اللازمة، ومرجع صفحة المصدر، في مجلد بيانات QBank على جهازك. ويُمحى ملف PDF الأصلي بعد أيام من انتهاء استيراده (7 افتراضياً)، أو فوراً عندما تحذفه.',
      },
      {
        heading: 'المعالجة بالذكاء الاصطناعي',
        body: 'عندما تشغّل مهمة AI تُرسل الصفحات التي تحتاجها إلى مزوّد AI الذي سجّلت دخولك فيه، وتسري شروطه. تسجيلات دخولك ومفاتيحك تبقى في جزء مزودي AI داخل QBank على جهازك، ولا تُصدَّر أبداً.',
      },
      {
        heading: 'الحذف والتصدير',
        body: 'يمكنك تصدير البنك أو أرشفته أو حذفه أو حذف حسابك كاملاً. وكل إجراء يشرح ما سيتأثر قبل أن تؤكده.',
      },
    ],
  },
};

/**
 * The privacy page on a server (M31, B3): the first three sections say where the data really is;
 * the last one is the same in both modes. `{operator}` is filled by the screen (DEC-40).
 */
const SERVER_PRIVACY: Record<Locale, LegalSection[]> = {
  en: [
    {
      heading: 'Private by default',
      body: 'Every bank, file, image, question, note, session and report belongs to your account only. This QBank runs on a server run by {operator}, and nothing is sent to its makers. Only {operator} has technical access to that server; no screen in the app shows your content to anyone else.',
    },
    {
      heading: 'What we keep after an import',
      body: 'The extracted questions, their options, keys, explanations, needed images and source page references, in QBank’s storage on that server. The original PDF is erased a few days after its import ends (7 by default), or at once when you delete it.',
    },
    {
      heading: 'AI processing',
      body: 'When you run an AI task, the pages it needs are sent to the AI provider you signed in to; that provider’s terms apply. Your sign-ins and keys stay in a folder of your account’s own on the server, apart from every other account, and are never exported.',
    },
  ],
  ar: [
    {
      heading: 'خاص افتراضياً',
      body: 'كل بنك وملف وصورة وسؤال وملاحظة وجلسة وتقرير ملك لحسابك وحدك. يعمل QBank هنا على خادم يديره {operator}، ولا يُرسل شيء إلى صانعيه. ووحده {operator} يستطيع الوصول التقني إلى الخادم، ولا تعرض أي شاشة في التطبيق محتواك لغيرك.',
    },
    {
      heading: 'ما نحتفظ به بعد الاستيراد',
      body: 'الأسئلة المستخرجة وخياراتها ومفاتيحها وشروحها، والصور اللازمة، ومرجع صفحة المصدر، في تخزين QBank على ذلك الخادم. ويُمحى ملف PDF الأصلي بعد أيام من انتهاء استيراده (7 افتراضياً)، أو فوراً عندما تحذفه.',
    },
    {
      heading: 'المعالجة بالذكاء الاصطناعي',
      body: 'عندما تشغّل مهمة AI تُرسل الصفحات التي تحتاجها إلى مزوّد AI الذي سجّلت دخولك فيه، وتسري شروطه. تسجيلات دخولك ومفاتيحك تبقى في مجلد خاص بحسابك على الخادم، منفصل عن كل حساب آخر، ولا تُصدَّر أبداً.',
    },
  ],
};

/** The sections a reader in this mode sees: a server reads its own privacy page. */
export function legalSections(locale: Locale, page: LegalPage, mode: AppMode | null) {
  const local = LEGAL[locale][page];
  if (page !== 'privacy' || mode !== 'accounts') return local;
  return [...SERVER_PRIVACY[locale], ...local.slice(SERVER_PRIVACY[locale].length)];
}
