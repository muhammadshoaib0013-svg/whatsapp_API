/**
 * WABA Service
 * Multi-WABA architecture service for managing WhatsApp Business Accounts
 * Strictly enforces tenant isolation
 */

import { prisma } from '@/lib/db';
import { encryptWithVersion, decryptWithVersion } from '@/lib/security/secret-rotation';

export interface WabaAccount {
  id: string;
  tenantId: string;
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  businessPhoneNumber: string;
  graphApiVersion: string;
  connectionStatus: string;
  isActive: boolean;
  tokenLastFour?: string | null;
  lastTestedAt?: Date | null;
  lastError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWabaAccountInput {
  tenantId: string;
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  businessPhoneNumber: string;
  graphApiVersion: string;
  accessToken: string;
}

export interface UpdateWabaAccountInput {
  displayName?: string;
  accessToken?: string;
  connectionStatus?: string;
  lastError?: string;
}

/**
 * Get all WABA accounts for a tenant
 * Strictly filters by tenantId to ensure tenant isolation
 */
export async function getWabaAccounts(tenantId: string): Promise<WabaAccount[]> {
  const accounts = await prisma.whatsappAccount.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return accounts.map((account) => ({
    id: account.id,
    tenantId: account.tenantId,
    displayName: account.displayName,
    wabaId: account.wabaId,
    phoneNumberId: account.phoneNumberId,
    businessPhoneNumber: account.businessPhoneNumber,
    graphApiVersion: account.graphApiVersion,
    connectionStatus: account.connectionStatus,
    isActive: account.isActive,
    tokenLastFour: account.tokenLastFour,
    lastTestedAt: account.lastTestedAt,
    lastError: account.lastError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }));
}

/**
 * Get active WABA account for a tenant
 * Returns null if no active account exists
 */
export async function getActiveWabaAccount(tenantId: string): Promise<WabaAccount | null> {
  const account = await prisma.whatsappAccount.findFirst({
    where: {
      tenantId,
      isActive: true,
    },
  });

  if (!account) {
    return null;
  }

  return {
    id: account.id,
    tenantId: account.tenantId,
    displayName: account.displayName,
    wabaId: account.wabaId,
    phoneNumberId: account.phoneNumberId,
    businessPhoneNumber: account.businessPhoneNumber,
    graphApiVersion: account.graphApiVersion,
    connectionStatus: account.connectionStatus,
    isActive: account.isActive,
    tokenLastFour: account.tokenLastFour,
    lastTestedAt: account.lastTestedAt,
    lastError: account.lastError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/**
 * Get a specific WABA account by ID
 * Strictly enforces tenant isolation
 */
export async function getWabaAccountById(
  accountId: string,
  tenantId: string
): Promise<WabaAccount | null> {
  const account = await prisma.whatsappAccount.findFirst({
    where: {
      id: accountId,
      tenantId, // Strict tenant isolation
    },
  });

  if (!account) {
    return null;
  }

  return {
    id: account.id,
    tenantId: account.tenantId,
    displayName: account.displayName,
    wabaId: account.wabaId,
    phoneNumberId: account.phoneNumberId,
    businessPhoneNumber: account.businessPhoneNumber,
    graphApiVersion: account.graphApiVersion,
    connectionStatus: account.connectionStatus,
    isActive: account.isActive,
    tokenLastFour: account.tokenLastFour,
    lastTestedAt: account.lastTestedAt,
    lastError: account.lastError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/**
 * Create a new WABA account
 * Encrypts the access token using the security layer
 * Automatically sets as active if it's the first account for the tenant
 */
export async function createWabaAccount(
  input: CreateWabaAccountInput
): Promise<WabaAccount> {
  // Check if this is the first account for the tenant
  const existingAccounts = await prisma.whatsappAccount.count({
    where: { tenantId: input.tenantId },
  });

  const isFirstAccount = existingAccounts === 0;

  // Encrypt the access token
  const encryptedToken = encryptWithVersion(input.accessToken);

  // Extract last 4 characters of token for display
  const tokenLastFour = input.accessToken.slice(-4);

  // Create the account
  const account = await prisma.whatsappAccount.create({
    data: {
      tenantId: input.tenantId,
      displayName: input.displayName,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      businessPhoneNumber: input.businessPhoneNumber,
      graphApiVersion: input.graphApiVersion,
      encryptedAccessToken: encryptedToken,
      tokenLastFour,
      isActive: isFirstAccount, // Auto-activate first account
      connectionStatus: 'CONNECTED',
    },
  });

  return {
    id: account.id,
    tenantId: account.tenantId,
    displayName: account.displayName,
    wabaId: account.wabaId,
    phoneNumberId: account.phoneNumberId,
    businessPhoneNumber: account.businessPhoneNumber,
    graphApiVersion: account.graphApiVersion,
    connectionStatus: account.connectionStatus,
    isActive: account.isActive,
    tokenLastFour: account.tokenLastFour,
    lastTestedAt: account.lastTestedAt,
    lastError: account.lastError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/**
 * Update a WABA account
 * Strictly enforces tenant isolation
 */
export async function updateWabaAccount(
  accountId: string,
  tenantId: string,
  input: UpdateWabaAccountInput
): Promise<WabaAccount | null> {
  // Prepare update data
  const updateData: any = {};

  if (input.displayName) {
    updateData.displayName = input.displayName;
  }

  if (input.accessToken) {
    // Encrypt the new access token
    updateData.encryptedAccessToken = encryptWithVersion(input.accessToken);
    updateData.tokenLastFour = input.accessToken.slice(-4);
  }

  if (input.connectionStatus) {
    updateData.connectionStatus = input.connectionStatus;
  }

  if (input.lastError !== undefined) {
    updateData.lastError = input.lastError;
  }

  // Update the account
  const account = await prisma.whatsappAccount.updateMany({
    where: {
      id: accountId,
      tenantId, // Strict tenant isolation
    },
    data: updateData,
  });

  if (account.count === 0) {
    return null;
  }

  // Return the updated account
  return getWabaAccountById(accountId, tenantId);
}

/**
 * Switch the active WABA account for a tenant
 * Deactivates all other accounts and activates the specified one
 */
export async function switchActiveWabaAccount(
  accountId: string,
  tenantId: string
): Promise<WabaAccount | null> {
  // Verify the account belongs to the tenant
  const targetAccount = await prisma.whatsappAccount.findFirst({
    where: {
      id: accountId,
      tenantId,
    },
  });

  if (!targetAccount) {
    return null;
  }

  // Deactivate all accounts for the tenant
  await prisma.whatsappAccount.updateMany({
    where: { tenantId },
    data: { isActive: false },
  });

  // Activate the target account
  await prisma.whatsappAccount.update({
    where: { id: accountId },
    data: { isActive: true },
  });

  // Return the updated account
  return getWabaAccountById(accountId, tenantId);
}

/**
 * Delete a WABA account
 * Strictly enforces tenant isolation
 * Prevents deletion of the active account if it's the only one
 */
export async function deleteWabaAccount(
  accountId: string,
  tenantId: string
): Promise<boolean> {
  // Verify the account belongs to the tenant
  const account = await prisma.whatsappAccount.findFirst({
    where: {
      id: accountId,
      tenantId,
    },
  });

  if (!account) {
    return false;
  }

  // Prevent deletion if it's the only account
  const accountCount = await prisma.whatsappAccount.count({
    where: { tenantId },
  });

  if (accountCount === 1) {
    throw new Error('Cannot delete the only WABA account for the tenant');
  }

  // If deleting the active account, activate another one
  if (account.isActive) {
    // Find another account to activate
    const nextAccount = await prisma.whatsappAccount.findFirst({
      where: {
        tenantId,
        id: { not: accountId },
      },
    });

    if (nextAccount) {
      await prisma.whatsappAccount.update({
        where: { id: nextAccount.id },
        data: { isActive: true },
      });
    }
  }

  // Delete the account
  await prisma.whatsappAccount.deleteMany({
    where: {
      id: accountId,
      tenantId, // Strict tenant isolation
    },
  });

  return true;
}

/**
 * Get decrypted access token for a WABA account
 * Strictly enforces tenant isolation
 * Never expose raw tokens to client-side
 */
export async function getWabaAccessToken(
  accountId: string,
  tenantId: string
): Promise<string | null> {
  const account = await prisma.whatsappAccount.findFirst({
    where: {
      id: accountId,
      tenantId, // Strict tenant isolation
    },
    select: {
      encryptedAccessToken: true,
    },
  });

  if (!account) {
    return null;
  }

  // Decrypt the token
  return decryptWithVersion(account.encryptedAccessToken);
}

/**
 * Validate a WABA account by checking its connection status
 * Updates the lastTestedAt timestamp
 */
export async function validateWabaAccount(
  accountId: string,
  tenantId: string
): Promise<{ valid: boolean; error?: string }> {
  const account = await prisma.whatsappAccount.findFirst({
    where: {
      id: accountId,
      tenantId,
    },
  });

  if (!account) {
    return { valid: false, error: 'Account not found' };
  }

  // Update last tested timestamp
  await prisma.whatsappAccount.update({
    where: { id: accountId },
    data: { lastTestedAt: new Date() },
  });

  // Check connection status
  if (account.connectionStatus === 'CONNECTED') {
    return { valid: true };
  }

  return {
    valid: false,
    error: account.lastError || 'Account not connected',
  };
}
