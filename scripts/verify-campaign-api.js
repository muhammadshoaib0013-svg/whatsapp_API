const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Simulate the GET /api/campaigns/[id] query
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: 'cmqq2ezg90001tuxszrr6wpag',
      tenantId: 'cmq8xn6yd0001tu78ou83zddy',
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          language: true,
          status: true,
        },
      },
      account: {
        select: {
          id: true,
          displayName: true,
          businessPhoneNumber: true,
          connectionStatus: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  console.log('=== GET /api/campaigns/[id] Response ===');
  console.log('Campaign ID:', campaign.id);
  console.log('Account object:', JSON.stringify(campaign.account, null, 2));
  console.log('\nChecking for encryptedAccessToken in account:');
  console.log('Has encryptedAccessToken:', 'encryptedAccessToken' in campaign.account);
  console.log('Has encryptedAccessToken in keys:', Object.keys(campaign.account).includes('encryptedAccessToken'));
  
  await prisma.$disconnect();
}

main();
