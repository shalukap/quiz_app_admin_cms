
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function cleanup() {
  console.log('Fetching questions...');
  const snapshot = await getDocs(collection(db, 'questions'));
  console.log(`Found ${snapshot.docs.length} questions.`);
  
  let deletedCount = 0;
  for (const qDoc of snapshot.docs) {
    const data = qDoc.data();
    if (data.grade === undefined) {
      console.log(`Deleting question without grade: ${data.text || qDoc.id}`);
      await deleteDoc(doc(db, 'questions', qDoc.id));
      deletedCount++;
    } else {
       // Check if subjectId exists
       if (!data.subjectId) {
          console.log(`Deleting question without subjectId: ${data.text || qDoc.id}`);
          await deleteDoc(doc(db, 'questions', qDoc.id));
          deletedCount++;
       }
    }
  }
  console.log(`Deleted ${deletedCount} inconsistent questions.`);
  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
