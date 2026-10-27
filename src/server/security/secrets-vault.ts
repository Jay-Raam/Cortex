import crypto from 'node:crypto';
import { db, EncryptedSecretRecord } from '../db/database';
import { getJwtSecret } from '../auth/auth';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
  salt: string;
}

export interface MaskedSecretItem {
  id: string;
  workspaceId: string;
  key: string;
  maskedValue: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Validates whether an environment variable key name adheres to standard POSIX naming conventions.
 * Strictly prevents header injection, control characters, or invalid formatting.
 */
export function isValidSecretKey(key: string): { valid: boolean; reason?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, reason: 'Secret key must be a non-empty string' };
  }
  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Secret key cannot be empty' };
  }
  if (trimmed.length > 128) {
    return { valid: false, reason: 'Secret key exceeds maximum allowed length of 128 characters' };
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    return {
      valid: false,
      reason: 'Secret key must start with a letter or underscore, and contain only alphanumeric characters or underscores',
    };
  }
  return { valid: true };
}

/**
 * Masks a secret value for safe UI display and logging.
 */
export function maskSecretValue(value: string): string {
  if (!value || typeof value !== 'string') {
    return '••••••••';
  }
  if (value.length <= 8) {
    return '••••••••';
  }
  const prefix = value.substring(0, 3);
  const suffix = value.substring(value.length - 3);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Resolves the master key used to derive encryption keys.
 */
function getMasterVaultKey(): string {
  if (process.env.CORTEX_VAULT_KEY) {
    return process.env.CORTEX_VAULT_KEY;
  }
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  try {
    return getJwtSecret();
  } catch {
    return 'cortex-vault-master-key-local-machine-' + (process.env.COMPUTERNAME || process.env.HOSTNAME || 'default');
  }
}

/**
 * Encrypts a plaintext secret using AES-256-GCM and scrypt key derivation.
 */
export function encryptSecret(
  plaintext: string,
  masterKey?: string
): EncryptedPayload {
  const secretKey = masterKey || getMasterVaultKey();
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(secretKey, salt, 32, { N: 16384, r: 8, p: 1 });
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    salt: salt.toString('hex'),
  };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM.
 * Throws an explicit error if ciphertext or authentication tag has been tampered with.
 */
export function decryptSecret(
  payload: EncryptedPayload,
  masterKey?: string
): string {
  const secretKey = masterKey || getMasterVaultKey();
  const salt = Buffer.from(payload.salt, 'hex');
  const derivedKey = crypto.scryptSync(secretKey, salt, 32, { N: 16384, r: 8, p: 1 });
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(tag);

  try {
    let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    throw new Error(`Vault decryption error: Data integrity verification failed. Ciphertext or authentication tag was corrupted or tampered with.`);
  }
}

/**
 * Parses raw .env file text into an array of key-value pairs.
 */
export function parseDotEnv(content: string): Array<{ key: string; value: string }> {
  const lines = content.split(/\r?\n/);
  const result: Array<{ key: string; value: string }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;

    const rawKey = line.substring(0, eqIdx).trim();
    let rawVal = line.substring(eqIdx + 1).trim();

    // Strip wrapping quotes if present
    if (
      (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
      (rawVal.startsWith("'") && rawVal.endsWith("'"))
    ) {
      rawVal = rawVal.substring(1, rawVal.length - 1);
    }

    const valRes = isValidSecretKey(rawKey);
    if (valRes.valid) {
      result.push({ key: rawKey.toUpperCase(), value: rawVal });
    }
  }

  return result;
}

export class SecretsVaultManager {
  /**
   * Encrypts and securely saves a secret in the workspace vault.
   */
  setSecret(
    workspaceId: string,
    key: string,
    value: string,
    description?: string
  ): MaskedSecretItem {
    const valRes = isValidSecretKey(key);
    if (!valRes.valid) {
      throw new Error(`Invalid secret key: ${valRes.reason}`);
    }

    const normalizedKey = key.trim().toUpperCase();
    const encrypted = encryptSecret(value);
    const masked = maskSecretValue(value);

    const record: EncryptedSecretRecord = {
      id: `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      workspaceId,
      key: normalizedKey,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
      salt: encrypted.salt,
      maskedValue: masked,
      description: typeof description === 'string' && description.trim() ? description.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = db.saveWorkspaceSecret(record);
    return {
      id: saved.id,
      workspaceId: saved.workspaceId,
      key: saved.key,
      maskedValue: saved.maskedValue,
      description: saved.description,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * Retrieves and decrypts a single secret value by key.
   */
  getSecret(workspaceId: string, key: string): string | null {
    const record = db.getWorkspaceSecret(workspaceId, key);
    if (!record) return null;

    return decryptSecret({
      ciphertext: record.ciphertext,
      iv: record.iv,
      tag: record.tag,
      salt: record.salt,
    });
  }

  /**
   * Securely removes a secret from the workspace vault.
   */
  deleteSecret(workspaceId: string, key: string): boolean {
    return db.deleteWorkspaceSecret(workspaceId, key);
  }

  /**
   * Lists all masked secrets stored in the workspace vault.
   */
  listSecrets(workspaceId: string): MaskedSecretItem[] {
    const records = db.getWorkspaceSecrets(workspaceId);
    return records.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      key: r.key,
      maskedValue: r.maskedValue,
      description: r.description,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Decrypts all workspace secrets into an environment variable key-value map.
   * Used for safe runtime injection into execution runners.
   */
  getDecryptedEnv(workspaceId: string): Record<string, string> {
    const records = db.getWorkspaceSecrets(workspaceId);
    const env: Record<string, string> = {};

    for (const record of records) {
      try {
        const val = decryptSecret({
          ciphertext: record.ciphertext,
          iv: record.iv,
          tag: record.tag,
          salt: record.salt,
        });
        env[record.key] = val;
      } catch (err: any) {
        console.warn(`[SecretsVault] Warning: skipping secret "${record.key}" due to decryption failure:`, err.message);
      }
    }

    return env;
  }

  /**
   * Parses and securely imports multiple secrets from a raw .env file string.
   */
  importDotEnv(workspaceId: string, dotEnvContent: string): { importedCount: number; keys: string[] } {
    const parsed = parseDotEnv(dotEnvContent);
    const keys: string[] = [];

    for (const item of parsed) {
      this.setSecret(workspaceId, item.key, item.value);
      keys.push(item.key);
    }

    return { importedCount: keys.length, keys };
  }

  /**
   * Exports masked .env representation for safe download or preview.
   */
  exportMaskedDotEnv(workspaceId: string): string {
    const secrets = this.listSecrets(workspaceId);
    const lines = [
      '# Cortex Workspace Secrets Vault (Masked Preview)',
      `# Total Secrets: ${secrets.length}`,
      '',
    ];

    for (const s of secrets) {
      if (s.description) {
        lines.push(`# ${s.description}`);
      }
      lines.push(`${s.key}=${s.maskedValue}`);
    }

    return lines.join('\n');
  }
}

export const secretsVault = new SecretsVaultManager();
