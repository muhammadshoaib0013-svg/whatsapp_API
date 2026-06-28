// Cleanup script to delete test campaigns created during Phase 4.0.2 testing
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanup() {
  try {
    console.log('=== Campaign Cleanup ===\n');

    // Count campaigns before cleanup
    const beforeCount = await prisma.campaign.count();
    console.log(`Campaigns before cleanup: ${beforeCount}`);

    // Get all campaigns for test tenant
    const testTenantId = 'cmqnbwuji0000tu302salayol'; // Test Tenant A
    const campaigns = await prisma.campaign.findMany({
      where: {
        tenantId: testTenantId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    console.log(`\nFound ${campaigns.length} campaigns for test tenant`);
    
    if (campaigns.length === 0) {
      console.log('No campaigns to delete');
      return;
    }

    // Delete all campaigns for test tenant
    const deleteResult = await prisma.campaign.deleteMany({
      where: {
        tenantId: testTenantId,
      },
    });

    console.log(`Deleted ${deleteResult.count} campaigns`);

    // Count campaigns after cleanup
    const afterCount = await prisma.campaign.count();
    console.log(`\nCampaigns after cleanup: ${afterCount}`);
    console.log(`Campaigns removed: ${beforeCount - afterCount}`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
