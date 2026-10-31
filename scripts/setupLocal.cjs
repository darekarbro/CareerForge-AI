const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const target = path.resolve(__dirname, '../.env.compose');
try {
  fs.writeFileSync(target, '# Local Docker secrets. Do not commit this file.\nJWT_SECRET=' + crypto.randomBytes(48).toString('hex') + '\nJOB_PAYLOAD_SECRET=' + crypto.randomBytes(48).toString('hex') + '\nAPP_URL=http://localhost:3000\nGROQ_API_KEY=\n', { flag: 'wx', mode: 0o600 });
  console.log('Created private .env.compose. Optional: add your Groq key there.');
} catch (error) { if (error.code !== 'EEXIST') throw error; console.log('Keeping existing .env.compose.'); }
console.log('Start: docker compose --env-file .env.compose up --build -d\nApp: http://localhost:3000\nLocal email inbox: http://localhost:8025');
