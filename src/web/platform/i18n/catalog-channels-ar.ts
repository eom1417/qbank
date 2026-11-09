import type { channelsEn } from './catalog-channels-en.js';
import { sharingAr } from './catalog-sharing-ar.js';

/** Arabic strings of sharing; the same keys as catalog-channels-en.ts. */
export const channelsAr: Record<keyof typeof channelsEn, string> = {
  ...sharingAr,
  'channels.open': 'المشاركات',
  'channels.stats.cycle': 'الدورة',
  'channels.stats.progress': 'أُرسل في هذه الدورة',
  'channels.stats.sent': 'أُرسل إجمالاً',
  'channels.stats.batches': 'الدفعات',
  'channels.stats.answers': 'الإجابات المستلمة',
  'channels.stats.correct': 'صحيحة',
  'channels.stats.questions': 'الأسئلة المرسلة',
  'channels.stats.times': 'مرات',
  'channels.stats.recent': 'آخر الدفعات',
};
