
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = require('./firebase_config.cjs');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateDurations() {
  console.log('Fetching questions...');
  const snapshot = await getDocs(collection(db, 'questions'));
  console.log(`Found ${snapshot.docs.length} questions.`);
  
  let updatedCount = 0;
  for (const qDoc of snapshot.docs) {
    const data = qDoc.data();
    if (data.timeLimit !== 90) {
      console.log(`Updating duration to 90s for question: ${data.text || qDoc.id}`);
      await updateDoc(doc(db, 'questions', qDoc.id), {
        timeLimit: 90
      });
      updatedCount++;
    }
  }
  console.log(`Successfully updated ${updatedCount} questions.`);
  process.exit(0);
}

updateDurations().catch(err => {
  console.error(err);
  process.exit(1);
});
