import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

/**
 * Authenticated encryption for secrets at rest (AES-256-GCM under QBANK_MASTER_KEY). `context`
 * binds a ciphertext to its row, so a value copied into another account's row cannot be opened.
 */
export interface SecretBox {
  seal(plaintext: string, context: string): string;
  /** Returns null when the value was tampered with, moved to another row or sealed elsewhere. */
  open(sealed: string, context: string): string | null;
}

export function createSecretBox(masterKey: Buffer): SecretBox {
  if (masterKey.length !== 32) throw new Error('QBANK_MASTER_KEY must decode to 32 bytes');
  return {
    seal(plaintext, context) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, masterKey, iv);
      cipher.setAAD(Buffer.from(context, 'utf8'));
      const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const parts = [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64url'));
      return [VERSION, ...parts].join(':');
    },
    open(sealed, context) {
      const [version, iv, tag, body] = sealed.split(':');
      if (version !== VERSION || !iv || !tag || body === undefined) return null;
      try {
        const decipher = createDecipheriv(ALGORITHM, masterKey, Buffer.from(iv, 'base64url'));
        decipher.setAAD(Buffer.from(context, 'utf8'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        const plain = Buffer.concat([
          decipher.update(Buffer.from(body, 'base64url')),
          decipher.final(),
        ]);
        return plain.toString('utf8');
      } catch {
        return null;
      }
    },
  };
}
