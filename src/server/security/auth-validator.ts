/**
 * Cortex AI - Authentication Input Validation & Password Policy Enforcement
 *
 * Implements CWE-521 (Weak Password Requirements), CWE-20 (Improper Input Validation),
 * and CWE-400 (bcrypt CPU DoS mitigation via password length clamping).
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedEmail?: string;
  sanitizedName?: string;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_NAME_LENGTH = 100;
export const MAX_EMAIL_LENGTH = 254;

/**
 * Validates registration input parameters.
 */
export function validateRegistrationInput(input: {
  email?: unknown;
  name?: unknown;
  password?: unknown;
}): ValidationResult {
  if (!input.email || typeof input.email !== 'string') {
    return { valid: false, error: 'A valid email address is required.' };
  }
  const cleanEmail = input.email.trim().toLowerCase();
  if (cleanEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(cleanEmail)) {
    return { valid: false, error: 'Please provide a valid email address.' };
  }

  if (!input.name || typeof input.name !== 'string') {
    return { valid: false, error: 'Name is required.' };
  }
  const cleanName = input.name.trim();
  if (cleanName.length < 1 || cleanName.length > MAX_NAME_LENGTH) {
    return { valid: false, error: `Name must be between 1 and ${MAX_NAME_LENGTH} characters.` };
  }

  if (!input.password || typeof input.password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    };
  }
  if (input.password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    sanitizedEmail: cleanEmail,
    sanitizedName: cleanName,
  };
}

/**
 * Validates login input credentials.
 */
export function validateLoginInput(input: {
  email?: unknown;
  password?: unknown;
}): ValidationResult {
  if (!input.email || typeof input.email !== 'string') {
    return { valid: false, error: 'A valid email address is required.' };
  }
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    return { valid: false, error: 'Please provide a valid email address.' };
  }

  if (!input.password || typeof input.password !== 'string' || input.password.length === 0) {
    return { valid: false, error: 'Password is required.' };
  }
  if (input.password.length > MAX_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    sanitizedEmail: cleanEmail,
  };
}
