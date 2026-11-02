import { hash, verify } from '@node-rs/argon2';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export const argon2Hasher: PasswordHasher = {
  hash: (password) => hash(password, OPTIONS),
  verify: (passwordHash, password) => verify(passwordHash, password),
};
