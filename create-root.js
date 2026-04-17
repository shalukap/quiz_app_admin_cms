import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC1eory_0jnHti3Kz06Sf1MCOgk3EOsYC4",
  appId: "1:1038214637528:web:7a91f8afb8c7fe7c7374ad",
  projectId: "quizapp-e7f6f",
  authDomain: "quizapp-e7f6f.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function createRootUser() {
  const email = "shaluka@quizapp.com";
  const password = "abc123";

  try {
    console.log(`Creating user with email: ${email}...`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log(`User created in Firebase Auth with UID: ${user.uid}`);
    
    console.log(`Creating Root profile in Firestore...`);
    await setDoc(doc(db, 'users', user.uid), {
      id: user.uid,
      email: email,
      role: 'Root',
      status: 'Active',
      allowedAccess: []
    });
    
    console.log("Root user profile successfully created in Firestore!");
    process.exit(0);
  } catch (error) {
    console.error("Error creating root user:", error);
    process.exit(1);
  }
}

createRootUser();
