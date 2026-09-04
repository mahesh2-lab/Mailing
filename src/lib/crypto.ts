const ALGORITHM = 'AES-GCM';

function getKeyBytes(): Uint8Array<ArrayBuffer> {
  const key = process.env.ENCRYPTION_KEY || "";
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Provide a 64-character hex string (32 bytes, AES-256) in your environment."
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      `ENCRYPTION_KEY must be a 64-character hex string (32 bytes / AES-256), but received ${key.length} character(s). ` +
        "Generate one with: openssl rand -hex 32"
    );
  }
  // Copy into a fresh ArrayBuffer-backed view so the type satisfies WebCrypto's
  // BufferSource (which requires ArrayBuffer, not the wider ArrayBufferLike).
  const bytes = new Uint8Array(32);
  bytes.set(Buffer.from(key, 'hex'));
  return bytes;
}

async function getCryptoKey() {
  return await crypto.subtle.importKey(
    "raw",
    getKeyBytes(),
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await getCryptoKey();
  
  const encoded = new TextEncoder().encode(plaintext);
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    cryptoKey,
    encoded
  );
  
  const encryptedBuffer = Buffer.from(encrypted);
  
  const ciphertext = encryptedBuffer.subarray(0, encryptedBuffer.length - 16);
  const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
  
  return Buffer.concat([Buffer.from(iv), authTag, ciphertext]).toString('base64');
}

export async function decrypt(payload: string) {
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  
  const cryptoKey = await getCryptoKey();
  
  const encrypted = Buffer.concat([ciphertext, authTag]);
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    cryptoKey,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}