
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyC1eory_0jnHti3Kz06Sf1MCOgk3EOsYC4',
  appId: '1:1038214637528:web:7a91f8afb8c7fe7c7374ad',
  messagingSenderId: '1038214637528',
  projectId: 'quizapp-e7f6f',
  authDomain: 'quizapp-e7f6f.firebaseapp.com',
  storageBucket: 'quizapp-e7f6f.firebasestorage.app',
};

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
