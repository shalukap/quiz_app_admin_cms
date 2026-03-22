require('./load_env.cjs');

module.exports = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  appId: process.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
};
