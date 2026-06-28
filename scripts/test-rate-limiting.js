// Test script for rate limiting on campaign APIs
const BASE_URL = 'http://localhost:3000';

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
    headers: {
      'retry-after': response.headers.get('retry-after'),
    },
  };
}

async function main() {
  console.log('=== Rate Limiting Test ===\n');

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
  console.log();

  // Step 2: Get existing campaigns to find WhatsApp account and template IDs
  console.log('Step 2: Getting existing campaigns...');
  const campaignsResponse = await makeRequest('GET', '/api/campaigns');
  
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

  // Step 3: Test allowed requests (2-3 normal campaign creations)
  console.log('Step 3: Testing allowed requests (2 campaign creations)...');
  for (let i = 1; i <= 2; i++) {
    console.log(`\nRequest ${i}: Creating campaign...`);
    const createResponse = await makeRequest('POST', '/api/campaigns', {
      name: `Rate Limit Test Campaign ${i}`,
      whatsappAccountId: existingCampaign.account.id,
      templateId: existingCampaign.template.id,
      recipients: '+923001234567',
      complianceConfirmed: true,
    });
    console.log('Status:', createResponse.statusCode);
    console.log('Retry-After:', createResponse.headers['retry-after']);
    
    if (createResponse.statusCode === 429) {
      console.log('Response body:', createResponse.body);
      console.log('Rate limit triggered earlier than expected!');
    } else if (createResponse.statusCode === 201) {
      const createdCampaign = JSON.parse(createResponse.body).campaign;
      console.log('Campaign ID:', createdCampaign.id);
      console.log('✅ Request allowed');
    } else {
      console.log('Response body:', createResponse.body);
    }
  }
  console.log();

  // Step 4: Test throttled requests (exceed limit)
  console.log('Step 4: Testing throttled requests (exceeding 10/min limit)...');
  console.log('Making 15 rapid requests to trigger rate limit...\n');
  
  let throttledCount = 0;
  for (let i = 1; i <= 15; i++) {
    const createResponse = await makeRequest('POST', '/api/campaigns', {
      name: `Rate Limit Test Campaign ${i + 2}`,
      whatsappAccountId: existingCampaign.account.id,
      templateId: existingCampaign.template.id,
      recipients: '+923001234567',
      complianceConfirmed: true,
    });
    
    if (createResponse.statusCode === 429) {
      throttledCount++;
      console.log(`Request ${i}: Status 429 (THROTTLED) - Retry-After: ${createResponse.headers['retry-after']}s`);
    } else if (createResponse.statusCode === 201) {
      console.log(`Request ${i}: Status 201 (ALLOWED)`);
    } else {
      console.log(`Request ${i}: Status ${createResponse.statusCode}`);
    }
  }
  
  console.log();
  console.log(`Total throttled requests: ${throttledCount}/15`);
  console.log();

  // Step 5: Test PUT rate limiting
  console.log('Step 5: Testing PUT rate limiting...');
  if (campaignsData.campaigns.length > 0) {
    const testCampaignId = campaignsData.campaigns[0].id;
    
    // Test allowed PUT requests
    console.log('\nTesting 2 allowed PUT requests...');
    for (let i = 1; i <= 2; i++) {
      const updateResponse = await makeRequest('PUT', `/api/campaigns/${testCampaignId}`, {
        name: `Rate Limit Test Update ${i}`,
      });
      console.log(`PUT Request ${i}: Status ${updateResponse.statusCode}`);
      if (updateResponse.statusCode === 429) {
        console.log('Retry-After:', updateResponse.headers['retry-after']);
      }
    }
    
    // Test throttled PUT requests
    console.log('\nTesting 25 rapid PUT requests to trigger rate limit...');
    let putThrottledCount = 0;
    for (let i = 1; i <= 25; i++) {
      const updateResponse = await makeRequest('PUT', `/api/campaigns/${testCampaignId}`, {
        name: `Rate Limit Test Update ${i + 2}`,
      });
      
      if (updateResponse.statusCode === 429) {
        putThrottledCount++;
        console.log(`PUT Request ${i}: Status 429 (THROTTLED)`);
      } else if (i % 5 === 0) {
        console.log(`PUT Request ${i}: Status ${updateResponse.statusCode}`);
      }
    }
    
    console.log();
    console.log(`Total PUT throttled requests: ${putThrottledCount}/25`);
  }
  
  console.log();
  console.log('=== Test Complete ===');
}

main().catch(console.error);
