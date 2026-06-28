const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create a test DRAFT campaign
  const testCampaign = await prisma.campaign.create({
    data: {
      name: 'Safety Check Test Campaign',
      status: 'DRAFT',
      tenantId: 'cmq8xn6yd0001tu78ou83zddy',
      whatsappAccountId: 'cmqb0b9ty0003tus83ywbe08w',
      templateId: 'cmqd6x7tn0005tu3curad7jz9',
      complianceConfirmed: true,
      recipientCount: 1,
      validRecipientCount: 1,
      invalidRecipientCount: 0,
      createdByUserId: 'cmq8xn6mb0000tu78dq6jy7s3',
      recipients: {
        create: {
          tenantId: 'cmq8xn6yd0001tu78ou83zddy',
          phoneNumber: '+923012345678',
          isValid: true,
          status: 'PENDING',
        }
      }
    },
    include: {
      account: true,
      template: true,
    },
  });
  
  console.log('Created test DRAFT campaign:');
  console.log('ID:', testCampaign.id);
  console.log('Name:', testCampaign.name);
  console.log('Status:', testCampaign.status);
  console.log('Account Status:', testCampaign.account.connectionStatus);
  console.log('Template Status:', testCampaign.template.status);
  console.log('\nUse this ID for safety-check test:');
  console.log(testCampaign.id);
  
  await prisma.$disconnect();
}

main();
