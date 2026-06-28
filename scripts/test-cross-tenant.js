// Cross-tenant isolation test script
// This script tests that Tenant A cannot access Tenant B's campaigns

const BASE_URL = 'http://localhost:3001';
const TEST_USER_A = {
  email: 'test-a@example.com',
  password: 'TestPassword123!',
};

let sessionCookie = '';

// Helper function to make HTTP requests with cookie
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
  
  // Capture Set-Cookie header if present
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
  console.log('=== Cross-Tenant Isolation Test ===\n');

  // Step 1: Login as Tenant A
  console.log('Step 1: Logging in as Tenant A user...');
  const loginResponse = await makeRequest('POST', '/api/auth/login', TEST_USER_A);
  console.log('POST /api/auth/login Status:', loginResponse.statusCode);
  console.log('Response body:', loginResponse.body);
  console.log('Session cookie captured:', sessionCookie ? 'YES' : 'NO');
  console.log();

  if (loginResponse.statusCode !== 200) {
    console.log('Login failed. Cannot proceed with test.');
    process.exit(1);
  }

  const loginData = JSON.parse(loginResponse.body);
  console.log('Logged in as:', loginData.user.email);
  console.log('Tenant:', loginData.tenant.name);
  console.log('Tenant ID:', loginData.tenant.id);
  console.log('User ID:', loginData.user.id);
  console.log();

  // Step 2: Get Tenant A's campaigns
  console.log('Step 2: Getting Tenant A campaigns...');
  const campaignsResponse = await makeRequest('GET', '/api/campaigns');
  console.log('GET /api/campaigns Status:', campaignsResponse.statusCode);
  console.log('Response body:', campaignsResponse.body);
  console.log();

  if (campaignsResponse.statusCode !== 200) {
    console.log('Failed to get campaigns. Cannot proceed with test.');
    process.exit(1);
  }

  const campaignsData = JSON.parse(campaignsResponse.body);
  console.log('Tenant A campaigns count:', campaignsData.campaigns.length);
  console.log();

  // Step 3: Attempt to access Tenant B's campaign
  // Using Tenant B's campaign ID from seed script
  const tenantBCampaignId = 'cmqnbwzfm000jtu30gv6xtqcm';
  console.log('Step 3: Attempting to access Tenant B campaign:', tenantBCampaignId);
  console.log();

  // 3a: GET Tenant B's campaign
  console.log('3a: GET /api/campaigns/[id] for Tenant B campaign...');
  const getResponse = await makeRequest('GET', `/api/campaigns/${tenantBCampaignId}`);
  console.log('Status:', getResponse.statusCode);
  console.log('Response body:', getResponse.body);
  console.log();

  // 3b: PUT Tenant B's campaign
  console.log('3b: PUT /api/campaigns/[id] for Tenant B campaign...');
  const putResponse = await makeRequest('PUT', `/api/campaigns/${tenantBCampaignId}`, {
    name: 'Attempted update from Tenant A',
  });
  console.log('Status:', putResponse.statusCode);
  console.log('Response body:', putResponse.body);
  console.log();

  // 3c: DELETE Tenant B's campaign
  console.log('3c: DELETE /api/campaigns/[id] for Tenant B campaign...');
  const deleteResponse = await makeRequest('DELETE', `/api/campaigns/${tenantBCampaignId}`);
  console.log('Status:', deleteResponse.statusCode);
  console.log('Response body:', deleteResponse.body);
  console.log();

  // Summary
  console.log('=== Summary ===');
  console.log('Tenant B GET:', getResponse.statusCode);
  console.log('Tenant B PUT:', putResponse.statusCode);
  console.log('Tenant B DELETE:', deleteResponse.statusCode);
  console.log();

  const allBlocked = 
    getResponse.statusCode === 404 || getResponse.statusCode === 403 ||
    putResponse.statusCode === 404 || putResponse.statusCode === 403 ||
    deleteResponse.statusCode === 404 || deleteResponse.statusCode === 403;

  if (allBlocked) {
    console.log('✅ CROSS-TENANT ISOLATION VERIFIED: All Tenant B access attempts blocked');
  } else {
    console.log('❌ CROSS-TENANT ISOLATION FAILED: Some Tenant B access attempts succeeded');
  }
}

main().catch(console.error);
