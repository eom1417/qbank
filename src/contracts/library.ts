import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

const Name = z.string().trim().min(1).max(120);

export const CreateBankRequest = z.object({
  name: Name,
  description: optionalText(2000).default(null),
  subject: optionalText(120).default(null),
});
export type CreateBankRequest = z.infer<typeof CreateBankRequest>;

/** Partial update of a bank's descriptive fields; an empty body is rejected. */
export const UpdateBankRequest = z
  .object({ name: Name, description: optionalText(2000), subject: optionalText(120) })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });
export type UpdateBankRequest = z.infer<typeof UpdateBankRequest>;

/** Which banks the library lists: archived banks are hidden by default (FR-03-008). */
export const BankListFilter = z.object({
  archived: z.enum(['exclude', 'include', 'only']).default('exclude'),
});
export type BankListFilter = z.infer<typeof BankListFilter>;

export const BankResponse = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    subject: z.string().nullable(),
    archived: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export type BankResponse = z.infer<typeof BankResponse>;

export const BankListResponse = z.object({ banks: z.array(BankResponse) }).strict();
export type BankListResponse = z.infer<typeof BankListResponse>;

/** Body for creating or renaming a chapter, topic or tag. */
export const NameRequest = z.object({ name: Name }).strict();
export type NameRequest = z.infer<typeof NameRequest>;

export const TopicResponse = z.object({ id: z.uuid(), name: z.string() }).strict();
export type TopicResponse = z.infer<typeof TopicResponse>;

export const ChapterResponse = z
  .object({ id: z.uuid(), name: z.string(), topics: z.array(TopicResponse) })
  .strict();
export type ChapterResponse = z.infer<typeof ChapterResponse>;

export const TaxonomyResponse = z.object({ chapters: z.array(ChapterResponse) }).strict();
export type TaxonomyResponse = z.infer<typeof TaxonomyResponse>;

export const TagResponse = z.object({ id: z.uuid(), name: z.string() }).strict();
export type TagResponse = z.infer<typeof TagResponse>;

export const TagListResponse = z.object({ tags: z.array(TagResponse) }).strict();
export type TagListResponse = z.infer<typeof TagListResponse>;
