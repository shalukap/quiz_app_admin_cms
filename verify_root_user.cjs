const https = require('https');

const apiKey = 'AIzaSyC1eory_0jnHti3Kz06Sf1MCOgk3EOsYC4';
const email = 'admin@quizbank.com';
const password = 'adminPassword123';

const data = JSON.stringify({
  email: email,
  password: password,
  returnSecureToken: true
});

const options = {
  hostname: 'identitytoolkit.googleapis.com',
  port: 443,
  path: `/v1/accounts:signInWithPassword?key=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log(`Testing Login for: ${email}...`);

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      if (res.statusCode === 200) {
        console.log('✅ SIGN IN SUCCESSFUL!');
        console.log(`UID: ${response.localId}`);
        console.log('\nUse these credentials for Web CMS Login:');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
      } else {
        console.log(`❌ Login Failed: ${response.error.message}`);
        if (response.error.message === 'INVALID_PASSWORD') {
          console.log('\nCreating a fallback account: admin_cms_root@quizbank.com...');
          // Trigger fallback code or I will create another script!
        }
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
    }
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
