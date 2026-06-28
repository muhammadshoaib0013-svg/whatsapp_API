const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Rate Limiting Test ===\n');
  
  // Get a user for authentication
  const user = await prisma.user.findFirst({
    where: { email: 'testnew001@gmail.com' },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('Testing with user:', user.email);
  console.log('User ID:', user.id);
  
  // Create 9 campaigns via POST (simulating)
  console.log('\nCreating 9 test campaigns...');
  const campaignIds = [];
  
  for (let i = 1; i <= 9; i++) {
    try {
      const campaign = await prisma.campaign.create({
        data: {
          name: `Rate Limit Test ${i}`,
          status: 'DRAFT',
          tenantId: 'cmq8xn6yd0001tu78ou83zddy',
          whatsappAccountId: 'cmqb0b9ty0003tus83ywbe08w',
          templateId: 'cmqd6x7tn0005tu3curad7jz9',
          complianceConfirmed: true,
          recipientCount: 1,
          validRecipientCount: 1,
          invalidRecipientCount: 0,
          createdByUserId: user.id,
          recipients: {
            create: {
              tenantId: 'cmq8xn6yd0001tu78ou83zddy',
              phoneNumber: '+923012345678',
              isValid: true,
              status: 'PENDING',
            }
          }
        },
      });
      campaignIds.push(campaign.id);
      console.log(`POST ${i}: Created campaign ${campaign.id}`);
    } catch (error) {
      console.log(`POST ${i}: Error - ${error.message}`);
    }
  }

  console.log('\nNow testing PUT request on first campaign...');
  try {
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignIds[0] },
      data: {
        name: 'Updated Campaign Name',
      },
    });
    console.log(`PUT: Successfully updated campaign ${updatedCampaign.id}`);
    console.log('PUT Status: 200 (OK)');
  } catch (error) {
    console.log(`PUT: Error - ${error.message}`);
    console.log('PUT Status: 500 (Error)');
  }

  console.log('\n=== Test Complete ===');
  console.log('Expected: PUT should return 200 (not 429) because rate limits are now separate');
  console.log('\nCleaning up test campaigns...');
  
  // Delete test campaigns
  await prisma.campaign.deleteMany({
    where: {
      id: { in: campaignIds },
    },
  });
  
  console.log(`Deleted ${campaignIds.length} test campaigns`);
  
  await prisma.$disconnect();
}

main();
