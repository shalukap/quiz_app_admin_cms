const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require('firebase/firestore');
const firebaseConfig = require('./firebase_config.cjs');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function promoteUser(email) {
  console.log(`Searching for user with email: ${email}...`);
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`❌ No user found with email: ${email}`);
      process.exit(1);
    }

    querySnapshot.forEach(async (d) => {
      console.log(`✅ Found user: ${d.id}. Promoting to Root...`);
      await updateDoc(doc(db, 'users', d.id), {
        role: 'Root',
        status: 'Active'
      });
      console.log(`🚀 Successfully promoted ${email} to Root!`);
    });

  } catch (err) {
    console.error('❌ Error promoting user:', err.message);
  }
}

const emailToPromote = 'jude.shaluka.perera@gmail.com';
promoteUser(emailToPromote);
