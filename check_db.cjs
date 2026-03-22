
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('./firebase_config.cjs');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const collections = ['subjects', 'questions', 'users', 'results'];
  for (const collName of collections) {
    try {
      const snapshot = await getDocs(collection(db, collName));
      console.log(`Collection ${collName}: ${snapshot.docs.length} documents.`);
    } catch (err) {
      console.error(`Error checking ${collName}:`, err.message);
    }
  }
  process.exit(0);
}

check();
