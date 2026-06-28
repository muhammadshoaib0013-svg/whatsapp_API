/**
 * Secret Rotation Readiness Layer
 * Provides key versioning, rotation support, and multiple active keys for graceful secret rotation
 */

import crypto from 'crypto';

// Algorithm: AES-256-GCM (Authenticated Encryption)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for IV
const SALT_LENGTH = 16; // 16 bytes for salt
const TAG_LENGTH = 16; // 16 bytes for auth tag

// Key version format: TOKEN_ENCRYPTION_KEY_V1, TOKEN_ENCRYPTION_KEY_V2, etc.
const CURRENT_KEY_VERSION = 'V1';
const MAX_KEY_VERSIONS = 10; // Maximum number of key versions to support

/**
 * Get encryption key for a specific version
 * @param version - Key version (e.g., 'V1', 'V2')
 * @returns Buffer of exactly 32 bytes for AES-256
 */
function getEncryptionKey(version: string = CURRENT_KEY_VERSION): Buffer {
  const envVarName = `TOKEN_ENCRYPTION_KEY_${version}`;
  const keyString = process.env[envVarName];

  if (!keyString) {
    // Fall back to current version if requested version doesn't exist
    if (version !== CURRENT_KEY_VERSION) {
      return getEncryptionKey(CURRENT_KEY_VERSION);
    }
    throw new Error(`${envVarName} environment variable is required`);
  }

  // Support both 64-character hex string (32 bytes when decoded) and 32-character ASCII string
  let key: Buffer;

  if (/^[a-fA-F0-9]{64}$/.test(keyString)) {
    key = Buffer.from(keyString, 'hex');
  } else {
    key = Buffer.from(keyString, 'utf-8');
  }

  if (key.length !== 32) {
    throw new Error(`${envVarName} must be either 64 hex characters or 32 ASCII characters`);
  }

  return key;
}

/**
 * Get all available key versions
 * @returns Array of available key version strings
 */
export function getAvailableKeyVersions(): string[] {
  const versions: string[] = [];

  for (let i = 1; i <= MAX_KEY_VERSIONS; i++) {
    const version = `V${i}`;
    const envVarName = `TOKEN_ENCRYPTION_KEY_${version}`;
    if (process.env[envVarName]) {
      versions.push(version);
    }
  }

  return versions;
}

/**
 * Get the current active key version
 * @returns Current key version string
 */
export function getCurrentKeyVersion(): string {
  return CURRENT_KEY_VERSION;
}

/**
 * Encrypt with key versioning support
 * @param plaintext - The text to encrypt
 * @param keyVersion - Key version to use (defaults to current)
 * @returns Encrypted string in format: version.salt.iv.tag.ciphertext (hex encoded)
 */
export function encryptWithVersion(
  plaintext: string,
  keyVersion: string = CURRENT_KEY_VERSION
): string {
  const encryptionKey = getEncryptionKey(keyVersion);

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key using PBKDF2
  const derivedKey = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000, // iterations
    32, // key length (256 bits)
    'sha256'
  );

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Encode version as hex (2 bytes)
  const versionBuffer = Buffer.from(keyVersion, 'utf-8');

  // Combine: version + salt + iv + tag + encrypted (all hex encoded)
  const combined = Buffer.concat([
    versionBuffer,
    salt,
    iv,
    tag,
    Buffer.from(encrypted, 'hex')
  ]);

  return combined.toString('hex');
}

/**
 * Decrypt with key versioning support (tries all available keys)
 * @param ciphertext - The encrypted string in format: version.salt.iv.tag.ciphertext (hex encoded)
 * @returns Decrypted plaintext string
 */
export function decryptWithVersion(ciphertext: string): string {
  // Decode hex to buffer
  const combined = Buffer.from(ciphertext, 'hex');

  // Extract version (first 2 bytes for V1, V2, etc.)
  const versionBuffer = combined.subarray(0, 2);
  const version = versionBuffer.toString('utf-8');

  // Extract components
  const salt = combined.subarray(2, 2 + SALT_LENGTH);
  const iv = combined.subarray(2 + SALT_LENGTH, 2 + SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(2 + SALT_LENGTH + IV_LENGTH, 2 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(2 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // Try to decrypt with the specified version first
  try {
    return decryptWithKeyVersion(ciphertext, version);
  } catch (error) {
    // If specified version fails, try all available versions
    const availableVersions = getAvailableKeyVersions();
    for (const v of availableVersions) {
      if (v === version) continue; // Already tried this version

      try {
        return decryptWithKeyVersion(ciphertext, v);
      } catch (e) {
        // Continue to next version
      }
    }
    throw new Error('Decryption failed: Unable to decrypt with any available key version');
  }
}

/**
 * Decrypt with a specific key version
 * @param ciphertext - The encrypted string
 * @param keyVersion - Key version to use
 * @returns Decrypted plaintext string
 */
function decryptWithKeyVersion(ciphertext: string, keyVersion: string): string {
  const encryptionKey = getEncryptionKey(keyVersion);

  // Decode hex to buffer
  const combined = Buffer.from(ciphertext, 'hex');

  // Extract components (skip version)
  const salt = combined.subarray(2, 2 + SALT_LENGTH);
  const iv = combined.subarray(2 + SALT_LENGTH, 2 + SALT_LENGTH + IV_LENGTH);
  const tag = combined.subarray(2 + SALT_LENGTH + IV_LENGTH, 2 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(2 + SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // Derive key using PBKDF2
  const derivedKey = crypto.pbkdf2Sync(
    encryptionKey,
    salt,
    100000,
    32,
    'sha256'
  );

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf-8');
}

/**
 * Re-encrypt data with a new key version
 * @param oldCiphertext - Data encrypted with old key
 * @param newKeyVersion - New key version to use
 * @returns New encrypted string
 */
export function reEncrypt(oldCiphertext: string, newKeyVersion: string): string {
  // Decrypt with old key
  const plaintext = decryptWithVersion(oldCiphertext);

  // Encrypt with new key
  return encryptWithVersion(plaintext, newKeyVersion);
}

/**
 * Check if a ciphertext is encrypted with a specific key version
 * @param ciphertext - The encrypted string
 * @param keyVersion - Key version to check
 * @returns True if encrypted with specified version
 */
export function isEncryptedWithVersion(ciphertext: string, keyVersion: string): boolean {
  const combined = Buffer.from(ciphertext, 'hex');
  const versionBuffer = combined.subarray(0, 2);
  const version = versionBuffer.toString('utf-8');
  return version === keyVersion;
}

/**
 * Get key version from ciphertext
 * @param ciphertext - The encrypted string
 * @returns Key version string
 */
export function getKeyVersionFromCiphertext(ciphertext: string): string {
  const combined = Buffer.from(ciphertext, 'hex');
  const versionBuffer = combined.subarray(0, 2);
  return versionBuffer.toString('utf-8');
}
