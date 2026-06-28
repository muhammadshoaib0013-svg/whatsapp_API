const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.campaign.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      account: {
        select: {
          id: true,
          displayName: true,
          connectionStatus: true,
        }
      },
      template: {
        select: {
          id: true,
          name: true,
          status: true,
        }
      }
    },
    take: 10,
  });
  
  console.log(JSON.stringify(campaigns, null, 2));
  await prisma.$disconnect();
}

main();
