const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Simulate the GET /api/whatsapp/accounts query
  const account = await prisma.whatsappAccount.findFirst({
    where: { tenantId: 'cmq8xn6yd0001tu78ou83zddy' },
    select: {
      id: true,
      displayName: true,
      wabaId: true,
      phoneNumberId: true,
      businessPhoneNumber: true,
      graphApiVersion: true,
      tokenLastFour: true,
      connectionStatus: true,
      lastTestedAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log('=== GET /api/whatsapp/accounts Response ===');
  console.log('Account object:', JSON.stringify(account, null, 2));
  console.log('\nChecking for encryptedAccessToken in account:');
  console.log('Has encryptedAccessToken:', 'encryptedAccessToken' in account);
  console.log('Has encryptedAccessToken in keys:', Object.keys(account).includes('encryptedAccessToken'));
  
  await prisma.$disconnect();
}

main();
