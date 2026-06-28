// Test script for audit logging on campaign actions
const BASE_URL = 'http://localhost:3001';

let sessionCookie = '';

async function makeRequest(method, path, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie,
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${BASE_URL}${path}`, options);
  
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie;
  }

  const body = await response.text();
  return {
    statusCode: response.status,
    body,
  };
}

async function main() {
  console.log('=== Audit Logging Test ===\n');

  // Step 1: Login
  console.log('Step 1: Logging in...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', {
    email: 'test-a@example.com',
    password: 'TestPassword123!',
  });
  console.log('Login Status:', loginResponse.statusCode);
  
  if (loginResponse.statusCode !== 200) {
    console.log('Login failed:', loginResponse.body);
    process.exit(1);
  }

  const loginData = JSON.parse(loginResponse.body);
  console.log('Logged in as:', loginData.user.email);
  console.log('Tenant ID:', loginData.tenant.id);
  console.log('User ID:', loginData.user.id);
  console.log();

  // Step 2: Get existing campaigns to find WhatsApp account and template IDs
  console.log('Step 2: Getting existing campaigns...');
  const campaignsResponse = await makeRequest('GET', '/api/campaigns');
  console.log('Campaigns Status:', campaignsResponse.statusCode);
  
  if (campaignsResponse.statusCode !== 200) {
    console.log('Failed to get campaigns:', campaignsResponse.body);
    process.exit(1);
  }

  const campaignsData = JSON.parse(campaignsResponse.body);
  console.log('Existing campaigns:', campaignsData.campaigns.length);
  
  if (campaignsData.campaigns.length === 0) {
    console.log('No existing campaigns found. Cannot proceed with test.');
    process.exit(1);
  }

  const existingCampaign = campaignsData.campaigns[0];
  console.log('Using WhatsApp Account ID:', existingCampaign.account.id);
  console.log('Using Template ID:', existingCampaign.template.id);
  console.log();

  // Step 3: Create a test campaign
  console.log('Step 3: Creating test campaign for audit log...');
  const createResponse = await makeRequest('POST', '/api/campaigns', {
    name: 'Audit Log Test Campaign',
    whatsappAccountId: existingCampaign.account.id,
    templateId: existingCampaign.template.id,
    recipients: '+923001234567',
    complianceConfirmed: true,
  });
  console.log('Create Campaign Status:', createResponse.statusCode);
  console.log('Response body:', createResponse.body);
  console.log();

  if (createResponse.statusCode !== 201) {
    console.log('Campaign creation failed. Cannot verify audit log.');
    process.exit(1);
  }

  const createdCampaign = JSON.parse(createResponse.body).campaign;
  console.log('Created Campaign ID:', createdCampaign.id);
  console.log();

  // Step 4: Update the campaign
  console.log('Step 4: Updating campaign for audit log...');
  const updateResponse = await makeRequest('PUT', `/api/campaigns/${createdCampaign.id}`, {
    name: 'Audit Log Test Campaign - Updated',
  });
  console.log('Update Campaign Status:', updateResponse.statusCode);
  console.log('Response body:', updateResponse.body);
  console.log();

  // Step 5: Delete the campaign
  console.log('Step 5: Deleting campaign for audit log...');
  const deleteResponse = await makeRequest('DELETE', `/api/campaigns/${createdCampaign.id}`);
  console.log('Delete Campaign Status:', deleteResponse.statusCode);
  console.log('Response body:', deleteResponse.body);
  console.log();

  console.log('=== Test Complete ===');
  console.log('Now run: npx tsx scripts/check-audit-logs.ts');
  console.log('Tenant ID:', loginData.tenant.id);
  console.log('User ID:', loginData.user.id);
}

main().catch(console.error);
