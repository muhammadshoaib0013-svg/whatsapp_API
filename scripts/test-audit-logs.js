// Test script to verify audit log entries for campaign actions
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const TEST_USER_A = {
  email: 'test-a@example.com',
  password: 'TestPassword123!',
};

let sessionCookie = '';
let campaignId = '';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (sessionCookie) {
      options.headers['Cookie'] = sessionCookie;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          sessionCookie = setCookie[0].split(';')[0];
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function main() {
  console.log('=== Audit Log Verification Test ===\n');

  // Step 1: Login as Tenant A
  console.log('Step 1: Logging in as Tenant A user...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', TEST_USER_A);
  console.log('Login Status:', loginResponse.statusCode);
  
  if (loginResponse.statusCode !== 200) {
    console.error('Login failed:', loginResponse.body);
    process.exit(1);
  }

  const loginData = JSON.parse(loginResponse.body);
  console.log('Logged in as:', loginData.user.email);
  console.log('Tenant:', loginData.tenant.name);
  console.log('Tenant ID:', loginData.tenant.id);
  console.log('User ID:', loginData.user.id);
  console.log();

  // Use existing campaign from seed script
  const campaignId = 'cmqnbwxgj0009tu30ouk9c8j0';
  console.log('Using existing campaign ID from seed:', campaignId);
  console.log();

  // Step 2: Update the campaign
  console.log('Step 2: Updating the campaign...');
  const updateCampaignResponse = await makeRequest('PUT', `/api/campaigns/${campaignId}`, {
    name: 'Audit Log Test Campaign - Updated',
  });
  console.log('PUT /api/campaigns/[id] Status:', updateCampaignResponse.statusCode);
  console.log('Response body:', updateCampaignResponse.body);
  
  if (updateCampaignResponse.statusCode !== 200) {
    console.log('Update failed, but we can still check if audit logs were written for the seed campaign creation');
  }
  console.log();

  // Step 3: Delete the campaign
  console.log('Step 3: Deleting the campaign...');
  const deleteCampaignResponse = await makeRequest('DELETE', `/api/campaigns/${campaignId}`);
  console.log('DELETE /api/campaigns/[id] Status:', deleteCampaignResponse.statusCode);
  console.log('Response body:', deleteCampaignResponse.body);
  console.log();

  console.log('=== Test Complete ===');
  console.log('Campaign ID:', campaignId);
  console.log('Tenant ID:', loginData.tenant.id);
  console.log('User ID:', loginData.user.id);
  console.log('\nNow check the database for audit log entries:');
  console.log('SELECT * FROM "AuditLog" WHERE "tenantId" = \'' + loginData.tenant.id + '\' AND "action" IN (\'CAMPAIGN_CREATED\', \'CAMPAIGN_UPDATED\', \'CAMPAIGN_DELETED\') ORDER BY "createdAt" DESC;');
}

main().catch(console.error);
