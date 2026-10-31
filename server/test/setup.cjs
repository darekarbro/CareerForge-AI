// Tests must never read the developer's .env or call configured external services.
require('dotenv').config = () => ({ parsed: {} });
for (const key of ['MONGODB_URI', 'REDIS_URL', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY',
  'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) process.env[key] = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'careerforge-test-only-private-secret-123456789';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX ||= '1000';
process.env.AI_RATE_LIMIT_MAX ||= '1000';
