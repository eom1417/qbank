import { z } from 'zod';

// M34 P1 (DEC-43): pictures by where they belong, as every solver-facing contract sends them.
// A picture of the explanation is never in these: it goes out only with the explanation (Z1).

const Letter = z.string().regex(/^[A-J]$/);

/** Pictures shown next to each option, by its letter. */
export const OptionPictures = <T extends z.ZodType>(item: T) => z.record(Letter, z.array(item));

/** A case several questions share, sent in full with each of them (Z8). */
export const CaseView = <T extends z.ZodType>(item: T) =>
  z.object({ text: z.string(), pictures: z.array(item) }).strict();
