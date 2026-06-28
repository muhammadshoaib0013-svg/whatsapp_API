const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ['CAMPAIGN_READY', 'CAMPAIGN_REVERTED_TO_DRAFT']
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5,
  });

  console.log('=== AuditLog Query ===');
  console.log('Query: SELECT * FROM "AuditLog" WHERE action IN (\'CAMPAIGN_READY\', \'CAMPAIGN_REVERTED_TO_DRAFT\') ORDER BY "createdAt" DESC LIMIT 5');
  console.log('\nResults:');
  console.log(JSON.stringify(auditLogs, null, 2));
  
  await prisma.$disconnect();
}

main();
