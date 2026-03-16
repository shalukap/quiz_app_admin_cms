
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
  console.log('Fetching subjects...');
  const snapshot = await getDocs(collection(db, 'subjects'));
  console.log(`Found ${snapshot.docs.length} subjects.`);
  
  let deletedCount = 0;
  for (const subjectDoc of snapshot.docs) {
    const data = subjectDoc.data();
    if (data.grade === undefined) {
      console.log(`Deleting subject without grade: ${data.name || subjectDoc.id}`);
      await deleteDoc(doc(db, 'subjects', subjectDoc.id));
      deletedCount++;
    } else {
      console.log(`Keeping subject: ${data.name} (Grade: ${data.grade})`);
    }
  }
  console.log(`Deleted ${deletedCount} inconsistent subjects.`);
  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
