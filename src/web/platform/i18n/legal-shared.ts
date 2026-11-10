import type { Locale } from '../../../contracts/identity.js';

/** One titled section of a legal page. */
export interface LegalSection {
  heading: string;
  body: string;
}

export type LegalPage = 'terms' | 'privacy';

/** The sections every reader sees, whatever runs QBank: rights, honest answers, patient data. */
interface SharedLegal {
  rights: LegalSection;
  personal: LegalSection;
  honest: LegalSection;
  patients: LegalSection;
  exportDelete: LegalSection;
}

/**
 * Final legal texts (FR-20-005..007, M32): short, plain words about what the product actually
 * does. They promise nothing the code does not do and claim no certification.
 */
export const SHARED_LEGAL: Record<Locale, SharedLegal> = {
  en: {
    rights: {
      heading: 'Your material, your rights',
      body: 'Upload only files you are allowed to use. You keep every right you have over them: QBank does not take ownership of your files and does not turn them into a library for anyone else.',
    },
    personal: {
      heading: 'Personal, non-commercial use',
      body: 'QBank builds personal study libraries. It has no store and no resale of questions or publishers’ answers; a question leaves a bank only through a share its owner sets up and controls.',
    },
    honest: {
      heading: 'Honest answers',
      body: 'A question is graded only when its answer is approved. AI suggestions are always labelled as suggestions and never presented as the book’s answer. QBank is a study aid: check what matters against your sources.',
    },
    patients: {
      heading: 'No patient-identifying pages',
      body: 'Do not upload images or documents that identify a patient. Remove names and identifiers before uploading.',
    },
    exportDelete: {
      heading: 'Export and delete, any time',
      body: 'You can export a bank, archive it, delete it, or delete your whole account whenever you like. Each action explains what it affects before you confirm it.',
    },
  },
  ar: {
    rights: {
      heading: 'مادتك وحقوقك',
      body: 'ارفع فقط الملفات التي يحق لك استخدامها. وتبقى لك كل حقوقك فيها: لا يتملّك QBank ملفاتك، ولا يحوّلها إلى مكتبة لأي شخص آخر.',
    },
    personal: {
      heading: 'استخدام شخصي غير تجاري',
      body: 'يبني QBank مكتبات شخصية للمذاكرة. لا يوجد فيه متجر ولا إعادة بيع لأسئلة أو لإجابات الناشرين، ولا يخرج سؤال من بنك إلا بمشاركة ينشئها صاحبه ويتحكم فيها.',
    },
    honest: {
      heading: 'إجابات صادقة',
      body: 'لا يُصحَّح سؤال إلا إذا كان جوابه معتمداً. اقتراحات AI تظهر دائماً بوصفها اقتراحات، ولا تُقدَّم أبداً على أنها جواب الكتاب. وQBank أداة مذاكرة: راجع ما يهمك في مصادرك.',
    },
    patients: {
      heading: 'لا صفحات تكشف هوية مريض',
      body: 'لا ترفع صوراً أو مستندات تكشف هوية مريض. أزل الأسماء والمعرّفات قبل الرفع.',
    },
    exportDelete: {
      heading: 'التصدير والحذف متى شئت',
      body: 'يمكنك تصدير البنك أو أرشفته أو حذفه أو حذف حسابك كاملاً متى أردت. وكل إجراء يشرح ما سيتأثر قبل أن تؤكده.',
    },
  },
};
