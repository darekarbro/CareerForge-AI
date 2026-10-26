const dotenv = require('dotenv');
const path = require('path');

const trimEnv = (value) => (typeof value === 'string' ? value.trim() : value);

// Load environment variables from server .env or root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const env = {
  NODE_ENV: trimEnv(process.env.NODE_ENV) || 'development',
  PORT: parseInt(trimEnv(process.env.PORT) || '5000', 10),
  CLIENT_URL: trimEnv(process.env.CLIENT_URL) || 'http://localhost:3000',
  MONGODB_URI: trimEnv(process.env.MONGODB_URI) || '',
  JWT_SECRET: trimEnv(process.env.JWT_SECRET) || 'careerforge-default-dev-secret-key-change-in-prod',
  JWT_EXPIRES_IN: trimEnv(process.env.JWT_EXPIRES_IN) || '7d',
  JOB_PAYLOAD_SECRET: trimEnv(process.env.JOB_PAYLOAD_SECRET) || '',

  // Firebase Admin
  FIREBASE_PROJECT_ID: trimEnv(process.env.FIREBASE_PROJECT_ID) || '',
  FIREBASE_CLIENT_EMAIL: trimEnv(process.env.FIREBASE_CLIENT_EMAIL) || '',
  FIREBASE_PRIVATE_KEY: trimEnv(process.env.FIREBASE_PRIVATE_KEY) || '',

  // AI Keys
  GROQ_API_KEY: trimEnv(process.env.GROQ_API_KEY) || '',
  GROQ_MODEL: trimEnv(process.env.GROQ_MODEL) || 'openai/gpt-oss-120b',
  GROQ_TIMEOUT_MS: Math.max(1000, parseInt(trimEnv(process.env.GROQ_TIMEOUT_MS) || '30000', 10) || 30000),
  OPENROUTER_API_KEY: trimEnv(process.env.OPENROUTER_API_KEY) || '',
  OPENROUTER_MODEL: trimEnv(process.env.OPENROUTER_MODEL) || 'meta-llama/llama-3.3-70b-instruct:free',
  GEMINI_API_KEY: trimEnv(process.env.GEMINI_API_KEY) || '',
  GEMINI_MODEL: trimEnv(process.env.GEMINI_MODEL) || 'gemini-3.8-flash',
  AI_PROVIDER_TIMEOUT_MS: Math.max(1000, parseInt(trimEnv(process.env.AI_PROVIDER_TIMEOUT_MS) || '15000', 10) || 15000),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: trimEnv(process.env.CLOUDINARY_CLOUD_NAME) || '',
  CLOUDINARY_API_KEY: trimEnv(process.env.CLOUDINARY_API_KEY) || '',
  CLOUDINARY_API_SECRET: trimEnv(process.env.CLOUDINARY_API_SECRET) || '',

  // Redis
  REDIS_URL: trimEnv(process.env.REDIS_URL) || '',
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '100', 10),
  AI_RATE_LIMIT_MAX: parseInt(process.env.AI_RATE_LIMIT_MAX || '30', 10),
  TRUST_PROXY: trimEnv(process.env.TRUST_PROXY) || '',
};

if (env.NODE_ENV === 'production' && (
  ['careerforge-default-dev-secret-key-change-in-prod', 'careerforge-super-secret-jwt-key-2026'].includes(env.JWT_SECRET) ||
  /^(?:your_|replace_|placeholder)/i.test(env.JWT_SECRET) || env.JWT_SECRET.length < 32
)) {
  throw new Error('Production requires a private JWT_SECRET of at least 32 characters');
}

module.exports = env;
