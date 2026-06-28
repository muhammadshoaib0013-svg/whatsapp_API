const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get a campaign with connected account and approved template
  const goodCampaign = await prisma.campaign.findFirst({
    where: {
      status: 'DRAFT',
    },
    include: {
      account: true,
      template: true,
    },
  });

  if (goodCampaign) {
    console.log('=== GOOD CAMPAIGN (Connected + Approved) ===');
    console.log('Campaign ID:', goodCampaign.id);
    console.log('Account Status:', goodCampaign.account.connectionStatus);
    console.log('Template Status:', goodCampaign.template.status);
    console.log('Valid Recipients:', goodCampaign.validRecipientCount);
    console.log('Compliance:', goodCampaign.complianceConfirmed);
  }

  // Get a campaign that might have issues
  const badCampaign = await prisma.campaign.findFirst({
    where: {
      OR: [
        { account: { connectionStatus: 'NOT_CONNECTED' } },
        { template: { status: 'PENDING' } },
      ],
    },
    include: {
      account: true,
      template: true,
    },
  });

  if (badCampaign) {
    console.log('\n=== BAD CAMPAIGN (Disconnected or Unapproved) ===');
    console.log('Campaign ID:', badCampaign.id);
    console.log('Account Status:', badCampaign.account.connectionStatus);
    console.log('Template Status:', badCampaign.template.status);
    console.log('Valid Recipients:', badCampaign.validRecipientCount);
    console.log('Compliance:', badCampaign.complianceConfirmed);
  } else {
    console.log('\n=== NO BAD CAMPAIGN FOUND ===');
    console.log('All campaigns have connected accounts and approved templates');
  }

  await prisma.$disconnect();
}

main();
