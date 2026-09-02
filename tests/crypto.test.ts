import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';

describe('Crypto functions', () => {
  let encrypt: (plaintext: string) => Promise<string>;
  let decrypt: (ciphertext: string) => Promise<string>;

  beforeAll(async () => {
    // Generate a proper 32-byte key (64 hex characters)
    const mockKey = crypto.randomBytes(32).toString('hex');
    process.env.ENCRYPTION_KEY = mockKey;
    
    // Dynamically import so the module reads the env var correctly
    const mod = await import('../src/lib/crypto');
    encrypt = mod.encrypt;
    decrypt = mod.decrypt;
  });

  it('should encrypt and decrypt a string successfully', async () => {
    const plaintext = 'my-super-secret-api-key';
    const encrypted = await encrypt(plaintext);
    
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');
    
    const decrypted = await decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail to decrypt with an invalid payload', async () => {
    await expect(() => decrypt('invalid-base64-payload')).rejects.toThrow();
  });

  it('should generate different ciphertexts for the same plaintext due to IV', async () => {
    const plaintext = 'test-key';
    const encrypted1 = await encrypt(plaintext);
    const encrypted2 = await encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2);
    expect(await decrypt(encrypted1)).toBe(plaintext);
    expect(await decrypt(encrypted2)).toBe(plaintext);
  });
});
