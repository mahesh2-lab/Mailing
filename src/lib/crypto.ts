const ALGORITHM = 'AES-GCM';
const key = process.env.ENCRYPTION_KEY || "";
const KEY = Buffer.from(key, 'hex'); // 32 bytes

async function getCryptoKey() {
  return await crypto.subtle.importKey(
    "raw",
    KEY,
    { name: "AES-GCM" },
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