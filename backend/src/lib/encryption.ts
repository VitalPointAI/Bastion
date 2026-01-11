import crypto from 'crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';

const KEY_LENGTH = 32; // 256 bits
const NONCE_LENGTH = 24; // 192 bits for XChaCha20

/**
 * Generate encryption key using Node.js crypto (server-side RNG)
 */
export async function generateEncryptionKey(): Promise<string> {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('hex');
}

/**
 * Encrypt data using XChaCha20-Poly1305
 */
export async function encryptData(
  data: string | Buffer,
  key: string
): Promise<{ encrypted: string; nonce: string }> {
  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  const keyBuffer = Buffer.from(key, 'hex');
  const nonce = crypto.randomBytes(NONCE_LENGTH);

  const cipher = xchacha20poly1305(keyBuffer, nonce);
  const encrypted = cipher.encrypt(dataBuffer);

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    nonce: nonce.toString('hex')
  };
}

/**
 * Decrypt data using XChaCha20-Poly1305
 */
export async function decryptData(
  encrypted: string,
  key: string,
  nonce: string
): Promise<Buffer> {
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const keyBuffer = Buffer.from(key, 'hex');
  const nonceBuffer = Buffer.from(nonce, 'hex');

  const cipher = xchacha20poly1305(keyBuffer, nonceBuffer);
  const decrypted = cipher.decrypt(encryptedBuffer);
  return Buffer.from(decrypted);
}
