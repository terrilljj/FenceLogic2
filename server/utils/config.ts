import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { dirname } from 'path';

export type GoogleConfig = {
  oauthClientId: string;
  oauthClientSecret: string;
  spreadsheetId: string;
};

const CONFIG_DIR = './server/config/secure';
const ENCRYPTED_FILE = `${CONFIG_DIR}/google.json.enc`;
const SECRET_FILE = `${CONFIG_DIR}/.app.enc.secret`;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

type EncryptedPayload = {
  iv: string;
  tag: string;
  ciphertext: string;
  createdAt: string;
};

/**
 * Ensures directory exists with secure permissions
 */
async function ensureDir(path: string): Promise<void> {
  try {
    await fs.mkdir(path, { recursive: true, mode: 0o700 });
  } catch (err: any) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * Reads file safely, returns null if not found
 */
async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf8');
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * Writes file with secure permissions
 */
async function writeFileSafe(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path));
  await fs.writeFile(path, content, { mode: 0o600 });
}

/**
 * Encrypts object to AES-256-GCM payload
 */
function encryptJson(obj: any, secretB64: string): EncryptedPayload {
  const key = Buffer.from(secretB64, 'base64');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const plaintext = JSON.stringify(obj);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypts AES-256-GCM payload to object
 */
function decryptJson(payload: EncryptedPayload, secretB64: string): any {
  const key = Buffer.from(secretB64, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  return JSON.parse(plaintext.toString('utf8'));
}

/**
 * Gets or generates encryption secret
 */
export async function getAppEncSecret(): Promise<string> {
  // Check environment first
  if (process.env.APP_ENC_SECRET) {
    return process.env.APP_ENC_SECRET;
  }
  
  // Try to read from file
  const existing = await readFileSafe(SECRET_FILE);
  if (existing) {
    const secret = existing.trim();
    // Cache in environment for this process
    process.env.APP_ENC_SECRET = secret;
    return secret;
  }
  
  // Generate new 32-byte secret
  const secret = randomBytes(32).toString('base64');
  await writeFileSafe(SECRET_FILE, secret);
  process.env.APP_ENC_SECRET = secret;
  console.log('[Config] Generated new encryption secret:', SECRET_FILE);
  
  return secret;
}

/**
 * Checks if Google config is available in environment variables
 */
export function hasGoogleConfigInEnv(): boolean {
  return !!(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

/**
 * Loads Google config (ENV-first, then encrypted file)
 */
export async function loadGoogleConfig(): Promise<GoogleConfig | null> {
  // Priority 1: Environment variables
  if (hasGoogleConfigInEnv()) {
    return {
      oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    };
  }
  
  // Priority 2: Encrypted file
  const encryptedData = await readFileSafe(ENCRYPTED_FILE);
  if (!encryptedData) {
    return null;
  }
  
  try {
    const payload: EncryptedPayload = JSON.parse(encryptedData);
    const secret = await getAppEncSecret();
    return decryptJson(payload, secret);
  } catch (err) {
    console.error('[Config] Failed to decrypt Google config:', err);
    return null;
  }
}

/**
 * Saves Google config encrypted to disk
 */
export async function saveGoogleConfig(config: GoogleConfig): Promise<void> {
  const secret = await getAppEncSecret();
  const payload = encryptJson(config, secret);
  
  await writeFileSafe(ENCRYPTED_FILE, JSON.stringify(payload, null, 2));
  console.log('[Config] Saved encrypted Google config to:', ENCRYPTED_FILE);
}
