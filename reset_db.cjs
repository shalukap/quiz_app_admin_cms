
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch, query, limit } = require('firebase/firestore');

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

async function deleteCollection(collName) {
  console.log(`Processing deletion for: ${collName}...`);
  let count = 0;
  while (true) {
    const q = query(collection(db, collName), limit(500));
    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      batch.delete(d.ref);
    });
    
    try {
      await batch.commit();
      count += snapshot.docs.length;
      console.log(`Deleted ${count} documents from ${collName}...`);
    } catch (err) {
      if (err.code === 'resource-exhausted') {
        console.error(`QUOTA EXCEEDED during ${collName} deletion. Stopped at ${count}.`);
        throw err;
      }
      throw err;
    }
  }
}

async function resetDatabase() {
  const collections = ['subjects', 'questions', 'users', 'results'];
  
  console.log('--- CLEANUP START ---');
  try {
    for (const collName of collections) {
      await deleteCollection(collName);
    }
    console.log('--- CLEANUP COMPLETE ---');

    console.log('\n--- RESET COMPLETE (No Seeding) ---');

  } catch (err) {
    console.error('Operation failed:', err.message);
  }
  process.exit(0);
}

resetDatabase();
