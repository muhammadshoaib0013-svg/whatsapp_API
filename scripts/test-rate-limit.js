// This script tests rate limiting by making 9 POST requests followed by 1 PUT request
// Note: This requires authentication cookies

const http = require('http');

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function main() {
  console.log('=== Rate Limiting Test ===\n');
  console.log('Making 9 POST requests to /api/campaigns...');
  
  for (let i = 1; i <= 9; i++) {
    try {
      const response = await makeRequest('POST', '/api/campaigns', {
        name: `Test Campaign ${i}`,
        whatsappAccountId: 'cmqb0b9ty0003tus83ywbe08w',
        templateId: 'cmqd6x7tn0005tu3curad7jz9',
        recipients: '+923012345678',
        complianceConfirmed: true,
      });
      console.log(`POST ${i}: Status ${response.statusCode}`);
    } catch (error) {
      console.log(`POST ${i}: Error - ${error.message}`);
    }
  }

  console.log('\nMaking 1 PUT request to /api/campaigns/[id]...');
  try {
    const response = await makeRequest('PUT', '/api/campaigns/cmqgyfghr0003tugs6lnnq87s', {
      name: 'Updated Campaign',
    });
    console.log(`PUT: Status ${response.statusCode}`);
    console.log(`PUT Body: ${response.body}`);
  } catch (error) {
    console.log(`PUT: Error - ${error.message}`);
  }

  console.log('\n=== Test Complete ===');
  console.log('Expected: PUT should return 200 (not 429) because rate limits are now separate');
}

main();
