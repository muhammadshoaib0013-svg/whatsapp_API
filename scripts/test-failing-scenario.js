const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Temporarily disconnect the account for testing
  await prisma.whatsappAccount.update({
    where: { id: 'cmqb0b9ty0003tus83ywbe08w' },
    data: { connectionStatus: 'NOT_CONNECTED' },
  });

  console.log('Account status temporarily set to NOT_CONNECTED');

  // Now test safety check
  const campaign = await prisma.campaign.findUnique({
    where: { id: 'cmqq2ezg90001tuxszrr6wpag' },
    include: {
      account: true,
      template: true,
    },
  });

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

  console.log('\n=== Safety Check - Failing Scenario ===');
  console.log('Campaign ID:', campaign.id);
  console.log('Account Status:', campaign.account.connectionStatus);
  console.log('Template Status:', campaign.template.status);
  console.log('\nSafety Check Result:');
  console.log(JSON.stringify(safetyCheck, null, 2));

  // Restore account status
  await prisma.whatsappAccount.update({
    where: { id: 'cmqb0b9ty0003tus83ywbe08w' },
    data: { connectionStatus: 'CONNECTED' },
  });

  console.log('\nAccount status restored to CONNECTED');
  
  await prisma.$disconnect();
}

main();
