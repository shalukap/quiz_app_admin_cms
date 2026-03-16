const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyC1eory_0jnHti3Kz06Sf1MCOgk3EOsYC4',
  appId: '1:1038214637528:web:7a91f8afb8c7fe7c7374ad',
  messagingSenderId: '1038214637528',
  projectId: 'quizapp-e7f6f',
  authDomain: 'quizapp-e7f6f.firebaseapp.com',
  storageBucket: 'quizapp-e7f6f.firebasestorage.app',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createRootUser() {
  const email = 'admin@quizbank.com';
  const password = 'adminPassword123';
  const username = 'admin_root';

  console.log(`Attempting to create user: ${email}...`);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    console.log(`✅ User created in Firebase Auth! UID: ${uid}`);

    // Create Firestore User Profile
    await setDoc(doc(db, 'users', uid), {
      username: username,
      email: email,
      uid: uid,
      points: 1000, // starting point for admin?
      quizzesTaken: 0,
      accuracy: 100.0,
      createdAt: new Date(),
    });
    console.log('✅ User profile document created in Firestore!');
    
    console.log('\nUse these credentials for Web CMS Login:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('⚠️  User already exists in Firebase Auth.');
    } else {
      console.error('❌ Failed to create root user:', err.message);
    }
  }
  process.exit(0);
}

createRootUser();
