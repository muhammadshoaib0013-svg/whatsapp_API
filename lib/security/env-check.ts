/**
 * Environment Variable Validation
 * 
 * This utility validates that all mandatory production environment variables are present.
 * It should be called on server startup or first API hit to ensure configuration is correct.
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'SESSION_SECRET',
  'TOKEN_ENCRYPTION_KEY',
  'META_APP_SECRET',
] as const;

const OPTIONAL_ENV_VARS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_GROWTH',
  'STRIPE_PRICE_AGENCY',
  'NEXT_PUBLIC_APP_URL',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
] as const;

interface EnvCheckResult {
  valid: boolean;
  missing: string[];
  optionalMissing: string[];
}

/**
 * Validates that all required environment variables are present
 * @returns Object with validation result and missing variables
 */
export function validateEnvironmentVariables(): EnvCheckResult {
  const missing: string[] = [];
  const optionalMissing: string[] = [];

  // Check required environment variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional environment variables (log warnings only)
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar]) {
      optionalMissing.push(envVar);
    }
  }

  const valid = missing.length === 0;

  if (!valid) {
    console.error('='.repeat(80));
    console.error('CRITICAL: Missing Required Environment Variables');
    console.error('='.repeat(80));
    console.error('The following environment variables are required but not set:');
    missing.forEach((envVar) => {
      console.error(`  - ${envVar}`);
    });
    console.error('='.repeat(80));
    console.error('Please add these variables to your .env file or environment configuration.');
    console.error('='.repeat(80));
  }

  if (optionalMissing.length > 0) {
    console.warn('='.repeat(80));
    console.warn('WARNING: Missing Optional Environment Variables');
    console.warn('='.repeat(80));
    console.warn('The following optional environment variables are not set:');
    optionalMissing.forEach((envVar) => {
      console.warn(`  - ${envVar}`);
    });
    console.warn('='.repeat(80));
    console.warn('Some features may not work without these variables.');
    console.warn('='.repeat(80));
  }

  if (valid && optionalMissing.length === 0) {
    console.log('✅ All environment variables are configured correctly.');
  }

  return { valid, missing, optionalMissing };
}

/**
 * Throws an error if required environment variables are missing
 * Use this in critical initialization paths
 */
export function requireEnvironmentVariables(): void {
  const result = validateEnvironmentVariables();
  if (!result.valid) {
    throw new Error(
      `Missing required environment variables: ${result.missing.join(', ')}`
    );
  }
}

/**
 * Checks if a specific environment variable is set
 * @param envVar The environment variable name to check
 * @returns true if the variable is set and non-empty
 */
export function isEnvVarSet(envVar: string): boolean {
  return !!process.env[envVar];
}

/**
 * Gets an environment variable or throws an error if not set
 * @param envVar The environment variable name to get
 * @returns The environment variable value
 * @throws Error if the variable is not set
 */
export function getRequiredEnvVar(envVar: string): string {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
  return value;
}
