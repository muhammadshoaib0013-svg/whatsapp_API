export interface ValidationResult {
  isValid: boolean;
  phoneNumber: string;
  validationError?: string;
}

export interface RecipientValidationResult {
  validRecipients: string[];
  invalidRecipients: ValidationResult[];
  duplicateCount: number;
  totalUnique: number;
}

/**
 * Normalizes a phone number by removing spaces, dashes, and parentheses.
 * Keeps the leading '+' and digits only.
 * Example: "+92 300 1234567" -> "+923001234567"
 */
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove spaces, dashes, parentheses, and other common formatting characters
  return phoneNumber.replace(/[\s\-\(\)]/g, '');
}

/**
 * Validates a phone number in E.164 format.
 * E.164 format: + followed by country code and digits (no spaces, dashes, or parentheses)
 * Example: +923001234567
 * 
 * This function first normalizes the input by removing spaces, dashes, and parentheses,
 * then validates the normalized format.
 */
export function validatePhoneNumber(phoneNumber: string): ValidationResult {
  const trimmed = phoneNumber.trim();
  
  // Empty line
  if (!trimmed) {
    return {
      isValid: false,
      phoneNumber: trimmed,
      validationError: 'Empty phone number',
    };
  }
  
  // Normalize the phone number (remove spaces, dashes, parentheses)
  const normalized = normalizePhoneNumber(trimmed);
  
  // E.164 format: starts with +, followed by digits only, length 8-15
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  
  if (!e164Regex.test(normalized)) {
    return {
      isValid: false,
      phoneNumber: trimmed,
      validationError: 'Invalid E.164 format. Must start with + followed by country code and digits (e.g., +923001234567)',
    };
  }
  
  return {
    isValid: true,
    phoneNumber: normalized, // Return normalized version
  };
}

/**
 * Validates a list of phone numbers from a textarea input.
 * One phone number per line.
 * Removes blank lines, trims whitespace, normalizes format, de-duplicates.
 */
export function validateRecipientList(phoneNumbersText: string): RecipientValidationResult {
  const lines = phoneNumbersText.split('\n');
  const validRecipients: string[] = [];
  const invalidRecipients: ValidationResult[] = [];
  const seenNumbers = new Set<string>();
  let duplicateCount = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) {
      continue;
    }
    
    // Normalize the phone number for deduplication check
    const normalized = normalizePhoneNumber(trimmed);
    
    // Check for duplicates (using normalized version)
    if (seenNumbers.has(normalized)) {
      duplicateCount++;
      continue;
    }
    
    seenNumbers.add(normalized);
    
    const result = validatePhoneNumber(trimmed);
    
    if (result.isValid) {
      validRecipients.push(result.phoneNumber); // Store normalized version
    } else {
      invalidRecipients.push(result);
    }
  }
  
  return {
    validRecipients,
    invalidRecipients,
    duplicateCount,
    totalUnique: validRecipients.length + invalidRecipients.length,
  };
}

/**
 * Masks a phone number for display purposes.
 * Shows first 4 digits and last 3 digits, masks the middle.
 * Example: +9230******567
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 7) {
    return phoneNumber;
  }
  
  const start = phoneNumber.substring(0, 4);
  const end = phoneNumber.substring(phoneNumber.length - 3);
  const maskedLength = phoneNumber.length - 7;
  const masked = '*'.repeat(maskedLength);
  
  return `${start}${masked}${end}`;
}
