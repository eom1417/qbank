import type { AppMode, Locale } from '../../../contracts/identity.js';
import { SERVER_LEGAL } from './legal-server.js';
import { SHARED_LEGAL, type LegalPage, type LegalSection } from './legal-shared.js';

/** What only a local install says: you run it, and its data and backups stay with you. */
const LOCAL_ONLY: Record<Locale, Record<'runs' | 'keep' | 'ai' | 'backups', LegalSection>> = {
  en: {
    runs: {
      heading: 'Who runs it',
      body: 'You do: this QBank runs on your own computer. Nothing is sent to its makers, and there is no support role that can read your content.',
    },
    keep: {
      heading: 'What is kept',
      body: 'Your banks, the extracted questions, their options, keys, explanations, needed images and source page references, your notes and results, in QBank’s data folder on your computer. The original PDF is erased a few days after its import ends (7 by default), or at once when you delete it.',
    },
    ai: {
      heading: 'AI only through your provider',
      body: 'When you run an AI task, the pages it needs are sent to the AI provider you signed in to; that provider’s terms apply. Your sign-ins and keys stay with the AI providers part of QBank on your computer and are never exported.',
    },
    backups: {
      heading: 'Backups',
      body: 'QBank backs itself up once a day on your computer and keeps the 7 newest copies and 4 weekly ones; older copies are deleted by themselves. AI sign-ins are not in backups.',
    },
  },
  ar: {
    runs: {
      heading: 'من يشغّله',
      body: 'أنت: يعمل QBank هذا على جهازك. لا يُرسل شيء إلى صانعيه، ولا يوجد دور دعم يستطيع قراءة محتواك.',
    },
    keep: {
      heading: 'ما يُحفظ',
      body: 'بنوكك، والأسئلة المستخرجة وخياراتها ومفاتيحها وشروحها، والصور اللازمة، ومرجع صفحة المصدر، وملاحظاتك ونتائجك، في مجلد بيانات QBank على جهازك. ويُمحى ملف PDF الأصلي بعد أيام من انتهاء استيراده (7 افتراضياً)، أو فوراً عندما تحذفه.',
    },
    ai: {
      heading: 'الذكاء الاصطناعي عبر مزوّدك فقط',
      body: 'عندما تشغّل مهمة AI تُرسل الصفحات التي تحتاجها إلى مزوّد AI الذي سجّلت دخولك فيه، وتسري شروطه. تسجيلات دخولك ومفاتيحك تبقى في جزء مزودي AI داخل QBank على جهازك، ولا تُصدَّر أبداً.',
    },
    backups: {
      heading: 'النسخ الاحتياطية',
      body: 'ينسخ QBank كل شيء على جهازك مرة في اليوم، ويحتفظ بأحدث 7 نسخ ونسخة من كل أسبوع من الأسابيع الأربعة السابقة، ويحذف الأقدم وحده. ولا تدخل تسجيلات دخول AI في النسخ.',
    },
  },
};

function localSections(locale: Locale, page: LegalPage): LegalSection[] {
  const shared = SHARED_LEGAL[locale];
  const own = LOCAL_ONLY[locale];
  if (page === 'terms')
    return [own.runs, shared.rights, shared.personal, shared.honest, shared.patients];
  return [own.runs, own.keep, own.ai, own.backups, shared.exportDelete];
}

/** The sections a reader in this mode sees: a server reads its own pages, naming its operator. */
export function legalSections(locale: Locale, page: LegalPage, mode: AppMode | null) {
  return mode === 'accounts' ? SERVER_LEGAL[locale][page] : localSections(locale, page);
}
