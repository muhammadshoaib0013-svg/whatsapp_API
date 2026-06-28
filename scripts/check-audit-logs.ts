import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking Audit Log Entries ===\n');

  // Get Tenant A's ID from the seed script
  const tenantAId = 'cmqnbwuji0000tu302salayol';
  
  console.log('Querying audit logs for Tenant A:', tenantAId);
  console.log();

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      tenantId: tenantAId,
      action: {
        in: ['CAMPAIGN_CREATED', 'CAMPAIGN_UPDATED', 'CAMPAIGN_DELETED'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  console.log(`Found ${auditLogs.length} audit log entries for campaign actions:\n`);

  if (auditLogs.length === 0) {
    console.log('No campaign audit logs found yet. This is expected if no campaigns have been created/updated/deleted via the API.');
  } else {
    auditLogs.forEach((log) => {
      console.log(`ID: ${log.id}`);
      console.log(`Action: ${log.action}`);
      console.log(`User ID: ${log.userId}`);
      console.log(`Tenant ID: ${log.tenantId}`);
      console.log(`Timestamp: ${log.createdAt.toISOString()}`);
      console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2));
      console.log('---');
    });
  }

  console.log('\n=== Summary ===');
  console.log('CAMPAIGN_CREATED entries:', auditLogs.filter(l => l.action === 'CAMPAIGN_CREATED').length);
  console.log('CAMPAIGN_UPDATED entries:', auditLogs.filter(l => l.action === 'CAMPAIGN_UPDATED').length);
  console.log('CAMPAIGN_DELETED entries:', auditLogs.filter(l => l.action === 'CAMPAIGN_DELETED').length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
