import { config } from 'dotenv';
import { Redis } from '@upstash/redis';

// لوڈ .env فائل
config();

if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
  console.error("Error: REDIS_URL or REDIS_TOKEN is missing in .env file.");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

async function testConnection() {
  try {
    const response = await redis.ping();
    console.log("Redis Connection Success:", response);
  } catch (error) {
    console.error("Redis Connection Failed:", error);
  }
}

testConnection();