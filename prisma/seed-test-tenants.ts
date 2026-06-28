import { PrismaClient } from '@prisma/client';
import { encrypt } from '@/lib/security/encryption';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanupTestData() {
  console.log('Cleaning up test data...');
  
  // Delete existing test data in reverse order of dependencies
  await prisma.campaignRecipient.deleteMany({
    where: {
      campaign: {
        name: { startsWith: 'Test Campaign' }
      }
    }
  });
  
  await prisma.campaign.deleteMany({
    where: {
      name: { startsWith: 'Test Campaign' }
    }
  });
  
  await prisma.whatsAppTemplate.deleteMany({
    where: {
      name: { startsWith: 'Test Template' }
    }
  });
  
  await prisma.whatsappAccount.deleteMany({
    where: {
      displayName: { startsWith: 'Test WhatsApp' }
    }
  });
  
  await prisma.teamMember.deleteMany({
    where: {
      user: {
        email: { startsWith: 'test-' }
      }
    }
  });
  
  await prisma.user.deleteMany({
    where: {
      email: { startsWith: 'test-' }
    }
  });
  
  await prisma.tenant.deleteMany({
    where: {
      slug: { startsWith: 'test-tenant-' }
    }
  });
  
  console.log('Test data cleaned up successfully.');
}

async function main() {
  // Check if we should cleanup or create
  const args = process.argv.slice(2);
  if (args[0] === 'cleanup') {
    await cleanupTestData();
    return;
  }
  
  console.log('Cleaning up existing test data...');
  
  // Delete existing test data in reverse order of dependencies
  await prisma.campaignRecipient.deleteMany({
    where: {
      campaign: {
        name: { startsWith: 'Test Campaign' }
      }
    }
  });
  
  await prisma.campaign.deleteMany({
    where: {
      name: { startsWith: 'Test Campaign' }
    }
  });
  
  await prisma.whatsAppTemplate.deleteMany({
    where: {
      name: { startsWith: 'Test Template' }
    }
  });
  
  await prisma.whatsappAccount.deleteMany({
    where: {
      displayName: { startsWith: 'Test WhatsApp' }
    }
  });
  
  await prisma.teamMember.deleteMany({
    where: {
      user: {
        email: { startsWith: 'test-' }
      }
    }
  });
  
  await prisma.user.deleteMany({
    where: {
      email: { startsWith: 'test-' }
    }
  });
  
  await prisma.tenant.deleteMany({
    where: {
      slug: { startsWith: 'test-tenant-' }
    }
  });
  
  console.log('Existing test data cleaned up.');
  console.log('Creating test tenants for cross-tenant isolation test...');

  // Create Tenant A
  const tenantA = await prisma.tenant.create({
    data: {
      slug: 'test-tenant-a',
      name: 'Test Tenant A',
      status: 'TRIAL',
    },
  });
  console.log('Created Tenant A:', tenantA.id);

  // Create User A
  const passwordHashA = await bcrypt.hash('TestPassword123!', 10);
  const userA = await prisma.user.create({
    data: {
      email: 'test-a@example.com',
      name: 'Test User A',
      passwordHash: passwordHashA,
    },
  });
  console.log('Created User A:', userA.id);

  // Link User A to Tenant A
  await prisma.teamMember.create({
    data: {
      userId: userA.id,
      tenantId: tenantA.id,
      role: 'OWNER',
    },
  });

  // Create WhatsApp Account for Tenant A
  const encryptedTokenA = encrypt('test-token-a');
  const whatsappAccountA = await prisma.whatsappAccount.create({
    data: {
      tenantId: tenantA.id,
      displayName: 'Test WhatsApp A',
      wabaId: 'test-waba-a',
      phoneNumberId: 'test-phone-a',
      businessPhoneNumber: '+923001234567',
      graphApiVersion: 'v18.0',
      encryptedAccessToken: encryptedTokenA,
      tokenLastFour: 'test',
      connectionStatus: 'CONNECTED',
      isActive: true,
    },
  });
  console.log('Created WhatsApp Account A:', whatsappAccountA.id);

  // Create Template for Tenant A
  const templateA = await prisma.whatsAppTemplate.create({
    data: {
      tenantId: tenantA.id,
      whatsappAccountId: whatsappAccountA.id,
      metaTemplateId: 'test-template-a',
      name: 'Test Template A',
      language: 'en',
      category: 'MARKETING',
      status: 'APPROVED',
      componentsJson: '{}',
    },
  });
  console.log('Created Template A:', templateA.id);

  // Create Campaign for Tenant A
  const campaignA = await prisma.campaign.create({
    data: {
      tenantId: tenantA.id,
      whatsappAccountId: whatsappAccountA.id,
      templateId: templateA.id,
      name: 'Test Campaign A',
      status: 'DRAFT',
      complianceConfirmed: true,
      recipientCount: 1,
      validRecipientCount: 1,
      invalidRecipientCount: 0,
      createdByUserId: userA.id,
    },
  });
  console.log('Created Campaign A:', campaignA.id);

  // Create Tenant B
  const tenantB = await prisma.tenant.create({
    data: {
      slug: 'test-tenant-b',
      name: 'Test Tenant B',
      status: 'TRIAL',
    },
  });
  console.log('Created Tenant B:', tenantB.id);

  // Create User B
  const passwordHashB = await bcrypt.hash('TestPassword123!', 10);
  const userB = await prisma.user.create({
    data: {
      email: 'test-b@example.com',
      name: 'Test User B',
      passwordHash: passwordHashB,
    },
  });
  console.log('Created User B:', userB.id);

  // Link User B to Tenant B
  await prisma.teamMember.create({
    data: {
      userId: userB.id,
      tenantId: tenantB.id,
      role: 'OWNER',
    },
  });

  // Create WhatsApp Account for Tenant B
  const encryptedTokenB = encrypt('test-token-b');
  const whatsappAccountB = await prisma.whatsappAccount.create({
    data: {
      tenantId: tenantB.id,
      displayName: 'Test WhatsApp B',
      wabaId: 'test-waba-b',
      phoneNumberId: 'test-phone-b',
      businessPhoneNumber: '+923007654321',
      graphApiVersion: 'v18.0',
      encryptedAccessToken: encryptedTokenB,
      tokenLastFour: 'test',
      connectionStatus: 'CONNECTED',
      isActive: true,
    },
  });
  console.log('Created WhatsApp Account B:', whatsappAccountB.id);

  // Create Template for Tenant B
  const templateB = await prisma.whatsAppTemplate.create({
    data: {
      tenantId: tenantB.id,
      whatsappAccountId: whatsappAccountB.id,
      metaTemplateId: 'test-template-b',
      name: 'Test Template B',
      language: 'en',
      category: 'MARKETING',
      status: 'APPROVED',
      componentsJson: '{}',
    },
  });
  console.log('Created Template B:', templateB.id);

  // Create Campaign for Tenant B
  const campaignB = await prisma.campaign.create({
    data: {
      tenantId: tenantB.id,
      whatsappAccountId: whatsappAccountB.id,
      templateId: templateB.id,
      name: 'Test Campaign B',
      status: 'DRAFT',
      complianceConfirmed: true,
      recipientCount: 1,
      validRecipientCount: 1,
      invalidRecipientCount: 0,
      createdByUserId: userB.id,
    },
  });
  console.log('Created Campaign B:', campaignB.id);

  console.log('\n=== Test Data Created Successfully ===');
  console.log('Tenant A ID:', tenantA.id);
  console.log('User A Email:', userA.email);
  console.log('Campaign A ID:', campaignA.id);
  console.log('\nTenant B ID:', tenantB.id);
  console.log('User B Email:', userB.email);
  console.log('Campaign B ID:', campaignB.id);
  console.log('\nSave these IDs for the cross-tenant isolation test.');
}

main()
  .catch((e) => {
    console.error('Error creating test data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
