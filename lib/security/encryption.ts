import crypto from 'crypto';

// Algorithm: AES-256-GCM (Authenticated Encryption)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for IV
const TAG_LENGTH = 16; // 16 bytes for auth tag

// Get and validate TOKEN_ENCRYPTION_KEY at runtime (not at module load)
// Returns a Buffer of exactly 32 bytes for AES-256
function getEncryptionKey(): Buffer {
  const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';
  
  if (!TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
  }

  // Support both 64-character hex string (32 bytes when decoded) and 32-character ASCII string
  let key: Buffer;
  
  if (/^[a-fA-F0-9]{64}$/.test(TOKEN_ENCRYPTION_KEY)) {
    // 64 hex characters = 32 bytes when decoded as hex
    key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'hex');
  } else {
    // Try UTF-8 encoding (32 ASCII characters = 32 bytes)
    key = Buffer.from(TOKEN_ENCRYPTION_KEY, 'utf-8');
  }

  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be either 64 hex characters or 32 ASCII characters');
  }

  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format: iv.tag.ciphertext (hex encoded)
 */
export function encrypt(plaintext: string): string {
  const encryptionKey = getEncryptionKey();
  
  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher using the 32-byte key directly
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Combine: iv + tag + encrypted (all hex encoded)
  const combined = Buffer.concat([
    iv,
    tag,
    Buffer.from(encrypted, 'hex')
  ]);

  return combined.toString('hex');
}

/**
 * Decrypts an encrypted string using AES-256-GCM
 * @param ciphertext - The encrypted string in format: iv.tag.ciphertext (hex encoded)
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string): string {
  const encryptionKey = getEncryptionKey();
  
  try {
    // Decode hex to buffer
    const combined = Buffer.from(ciphertext, 'hex');

    // Extract components (new format: iv.tag.ciphertext)
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

    // Create decipher using the 32-byte key directly
    const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf-8');
  } catch (error) {
    throw new Error('Decryption failed: Invalid ciphertext or key');
  }
}

/**
 * Masks a token for display purposes (shows only last 4 characters)
 * @param token - The token to mask
 * @returns Masked token (e.g., "••••1234")
 */
export function maskToken(token: string): string {
  if (!token || token.length < 4) {
    return '••••';
  }
  return `••••${token.slice(-4)}`;
}
