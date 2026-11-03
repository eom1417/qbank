/** What a picture shows, named only from the question's own stem (FR-06-007). */
export type Modality = 'ecg' | 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo' | 'chart' | 'table';

const NAMES: readonly [RegExp, Modality][] = [
  [/\b(?:ECG|EKG|electrocardiogram)\b|تخطيط (?:ال)?قلب/i, 'ecg'],
  [/\b(?:X-?rays?|radiograph\w*|CXR)\b|أشعة (?:ال)?سينية|الأشعة/i, 'xray'],
  [/\b(?:CT|computed tomography)\b|مقطعية/i, 'ct'],
  [/\b(?:MRI|magnetic resonance)\b|رنين/i, 'mri'],
  [/\b(?:ultrasound|sonograph\w*|echo\w*)\b|موجات صوتية|سونار/i, 'ultrasound'],
  [/\b(?:graph|chart|curve|plot)\b|منحنى|رسم بياني/i, 'chart'],
  [/\b(?:photo\w*|picture|image|rash|lesion)\b|الصورة/i, 'photo'],
];

/**
 * A neutral name for the picture: only what the stem itself says it is ("the ECG below"),
 * never words from the options or the answer, so the description cannot give the answer away.
 */
export function modalityOf(kind: 'figure' | 'table', stem: string): Modality | null {
  if (kind === 'table') return 'table';
  return NAMES.find(([pattern]) => pattern.test(stem))?.[1] ?? null;
}
