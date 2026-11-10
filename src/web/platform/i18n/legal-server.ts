import type { Locale } from '../../../contracts/identity.js';
import { SHARED_LEGAL, type LegalPage, type LegalSection } from './legal-shared.js';

type ServerOnly = 'runs' | 'signIn' | 'stored' | 'seen' | 'ai' | 'backups';

/**
 * What a server's pages say (M31 B3, M32): who runs it, how people sign in, what is stored and who
 * can see it, and its own backups. `{operator}` is filled by the screen (DEC-40).
 */
const SERVER_ONLY: Record<Locale, Record<ServerOnly, LegalSection>> = {
  en: {
    runs: {
      heading: 'Who runs this server',
      body: 'This QBank runs on a private server run by {operator} for the people they share its link with. Nothing is sent to QBank’s makers. {operator} decides who may use the server and may close an account that breaks these terms.',
    },
    signIn: {
      heading: 'Signing in',
      body: 'When this server uses Google sign-in, you sign in with your Google account: QBank never sees your Google password and keeps no password of its own for you. Otherwise you sign in with your e-mail and a password, stored only as a one-way hash.',
    },
    stored: {
      heading: 'What is stored',
      body: 'Your account’s e-mail and name (from Google when you sign in with Google), and what you make here: banks, uploaded files, questions and their images, notes, results and the shares you set up. The original PDF is erased a few days after its import ends (7 by default), or at once when you delete it.',
    },
    seen: {
      heading: 'Who can see it',
      body: 'Only you, inside the app, and the people you share with, only what each share shows them. {operator} has technical access to the server, but no screen in the app shows them your content. A note you send from Help goes to {operator}.',
    },
    ai: {
      heading: 'AI only through your provider',
      body: 'When you run an AI task, the pages it needs are sent to the AI provider you signed in to; that provider’s terms apply. Your sign-ins and keys stay in a folder of your account’s own on the server, apart from every other account, and are never exported.',
    },
    backups: {
      heading: 'Backups',
      body: 'The server is backed up every day. The backups stay on the server (and on a second disk if {operator} sets one up): the 7 newest daily copies and 4 weekly ones, and older copies are deleted by themselves. So something you delete stays in the backups for a few weeks at most.',
    },
  },
  ar: {
    runs: {
      heading: 'من يشغّل هذا الخادم',
      body: 'يعمل QBank هذا على خادم خاص يديره {operator} لمن يعطيهم رابطه. لا يُرسل شيء إلى صانعي QBank. و{operator} يقرر من يستخدم الخادم، وله أن يغلق حساباً يخالف هذه الشروط.',
    },
    signIn: {
      heading: 'تسجيل الدخول',
      body: 'إذا كان هذا الخادم يستخدم الدخول بـ Google فأنت تدخل بحساب Google: لا يرى QBank كلمة مرورك في Google، ولا يحفظ لك كلمة مرور خاصة به. وإلا فتدخل ببريدك وكلمة مرور تُحفظ مشفّرة تشفيراً لا يُعكس.',
    },
    stored: {
      heading: 'ما يُحفظ',
      body: 'بريد حسابك واسمك (من Google إذا دخلت بـ Google)، وما تصنعه هنا: البنوك، والملفات المرفوعة، والأسئلة وصورها، والملاحظات، والنتائج، والمشاركات التي تنشئها. ويُمحى ملف PDF الأصلي بعد أيام من انتهاء استيراده (7 افتراضياً)، أو فوراً عندما تحذفه.',
    },
    seen: {
      heading: 'من يراه',
      body: 'أنت وحدك داخل التطبيق، ومن تشارك معهم ما تعرضه المشاركة لهم فقط. ولـ{operator} وصول تقني إلى الخادم، لكن لا تعرض له أي شاشة في التطبيق محتواك. والملاحظة التي ترسلها من المساعدة تصل إلى {operator}.',
    },
    ai: {
      heading: 'الذكاء الاصطناعي عبر مزوّدك فقط',
      body: 'عندما تشغّل مهمة AI تُرسل الصفحات التي تحتاجها إلى مزوّد AI الذي سجّلت دخولك فيه، وتسري شروطه. تسجيلات دخولك ومفاتيحك تبقى في مجلد خاص بحسابك على الخادم، منفصل عن كل حساب آخر، ولا تُصدَّر أبداً.',
    },
    backups: {
      heading: 'النسخ الاحتياطية',
      body: 'يُنسخ الخادم احتياطياً كل يوم. وتبقى النسخ على الخادم (وعلى قرص ثانٍ إن جهّزه {operator}): أحدث 7 نسخ يومية و4 أسبوعية، وتُحذف الأقدم وحدها. فما تحذفه يبقى في النسخ بضعة أسابيع على الأكثر.',
    },
  },
};

function serverPages(locale: Locale): Record<LegalPage, LegalSection[]> {
  const shared = SHARED_LEGAL[locale];
  const own = SERVER_ONLY[locale];
  return {
    terms: [own.runs, own.signIn, shared.rights, shared.personal, shared.honest, shared.patients],
    privacy: [own.runs, own.stored, own.seen, own.ai, own.backups, shared.exportDelete],
  };
}

/** A server's terms and privacy pages, in each language. */
export const SERVER_LEGAL: Record<Locale, Record<LegalPage, LegalSection[]>> = {
  en: serverPages('en'),
  ar: serverPages('ar'),
};
