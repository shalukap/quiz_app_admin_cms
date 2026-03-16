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
  path: `/v1/accounts:signUp?key=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log(`Attempting to create Root User via REST API: ${email}...`);

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    try {
      const response = JSON.parse(body);
      if (res.statusCode === 200) {
        console.log('✅ User created in Firebase Auth!');
        console.log(`UID: ${response.localId}`);
        console.log('\nUse these credentials for Web CMS Login:');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
      } else {
        console.error('❌ Failed to create user:', response.error.message);
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', e.message);
      console.log('Raw response:', body);
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
