const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Test safety-check on the DRAFT campaign
  const campaign = await prisma.campaign.findUnique({
    where: { id: 'cmqq2ezg90001tuxszrr6wpag' },
    include: {
      account: true,
      template: true,
    },
  });

  if (!campaign) {
    console.log('Campaign not found');
    return;
  }

  // Simulate safety check logic
  const safetyCheck = {
    whatsappAccountConnected: campaign.account.connectionStatus === 'CONNECTED',
    templateApproved: campaign.template.status === 'APPROVED',
    hasValidRecipients: campaign.validRecipientCount > 0,
    complianceConfirmed: campaign.complianceConfirmed,
    estimatedMessageCount: campaign.validRecipientCount,
    estimatedCost: `$${(campaign.validRecipientCount * 0.01).toFixed(2)}`,
    allChecksPassed: 
      campaign.account.connectionStatus === 'CONNECTED' &&
      campaign.template.status === 'APPROVED' &&
      campaign.validRecipientCount > 0 &&
      campaign.complianceConfirmed
  };

  console.log('=== Safety Check - Passing Scenario ===');
  console.log('Campaign ID:', campaign.id);
  console.log('Campaign Name:', campaign.name);
  console.log('Account Status:', campaign.account.connectionStatus);
  console.log('Template Status:', campaign.template.status);
  console.log('Valid Recipients:', campaign.validRecipientCount);
  console.log('Compliance:', campaign.complianceConfirmed);
  console.log('\nSafety Check Result:');
  console.log(JSON.stringify(safetyCheck, null, 2));

  await prisma.$disconnect();
}

main();
