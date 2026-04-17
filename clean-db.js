import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC1eory_0jnHti3Kz06Sf1MCOgk3EOsYC4",
  appId: "1:1038214637528:web:7a91f8afb8c7fe7c7374ad",
  projectId: "quizapp-e7f6f",
  authDomain: "quizapp-e7f6f.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clean() {
  console.log("Fetching questions...");
  const snapshot = await getDocs(collection(db, 'questions'));
  
  let updatedCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    let changed = false;
    let newText = data.text || '';
    let newOptions = [...(data.options || [])];
    
    // Remove leading numbers/letters from text (e.g., "1. What is..." or "12) Who is...", or "Q1.")
    const oldText = newText;
    newText = newText.replace(/^\s*(Q\d*|\d+)\s*[\.\)]?\s*/i, '');
    if (oldText !== newText) {
      changed = true;
    }
    
    // Remove leading letters/numbers from options (e.g., "A. Blue", "1) Green", "a) Yellow")
    for (let i = 0; i < newOptions.length; i++) {
      const oldOpt = newOptions[i];
      newOptions[i] = newOptions[i].replace(/^\s*([A-Za-z]|\d+)[\.\)]\s*/, '');
      if (oldOpt !== newOptions[i]) {
        changed = true;
      }
    }
    
    if (changed) {
      console.log(`Updating document ${docSnap.id}...`);
      await updateDoc(doc(db, 'questions', docSnap.id), {
        text: newText,
        options: newOptions
      });
      updatedCount++;
    }
  }
  
  console.log(`Successfully updated ${updatedCount} questions.`);
  process.exit(0);
}

clean().catch(console.error);
