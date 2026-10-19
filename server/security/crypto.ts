/** Password hashing (scrypt), session tokens and secret encryption (AES-256-GCM). */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (pw: string, salt: Buffer, len: number, opts: ScryptOptions) =>
  new Promise<Buffer>((res, rej) => scryptCb(pw, salt, len, opts, (err, key) => (err ? rej(err) : res(key))));

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 12;

export function passwordPolicyError(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (pw.length > 256) return 'Password is too long.';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return 'Password must mix at least three of: lowercase, uppercase, digits, symbols.';
  return null;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A dummy hash so failed look-ups take as long as real verifications. */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(pw: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(18).toString('base64'));
  await verifyPassword(pw, await dummyHash);
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(s: string | Buffer): string {
  return createHash('sha256').update(s).digest('hex');
}

/* ---------------- secrets at rest ---------------- */

export class SecretBox {
  constructor(private readonly key: Buffer | null) {}

  get available(): boolean {
    return !!this.key;
  }

  seal(plaintext: string): string {
    if (!this.key) throw new Error('APP_ENCRYPTION_KEY is not configured; secrets cannot be stored.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
  }

  open(sealed: string): string {
    if (!this.key) throw new Error('APP_ENCRYPTION_KEY is not configured.');
    const [v, ivB64, tagB64, ctB64] = sealed.split('.');
    if (v !== 'v1') throw new Error('Unsupported secret format');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  }
}
