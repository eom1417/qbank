import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .default(null);

export const CreateBankRequest = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(2000),
  subject: optionalText(120),
});
export type CreateBankRequest = z.infer<typeof CreateBankRequest>;

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
