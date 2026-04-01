const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');
const firebaseConfig = require('./firebase_config.cjs');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateBuckets() {
  console.log('🔄 Starting Bucket migration...');
  
  try {
    const questionsRef = collection(db, 'questions');
    const questionSnapshot = await getDocs(questionsRef);
    const questions = questionSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    console.log(`📊 Found ${questions.length} questions.`);

    // Grouping by Subject, Grade, and Medium
    const groups = {};
    questions.forEach(q => {
      const key = `${q.subjectId}_${q.grade}_${q.medium || 'English'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(q);
    });

    console.log(`📁 Grouped into ${Object.keys(groups).length} Subject/Grade/Medium sets.`);

    // Grouping into atomic units (Solo questions or Scenario Clusters)
    const setGroups = {};
    for (const key in groups) {
      const groupQuestions = groups[key];
      const scenarioClusters = {};
      const soloQuestions = [];

      groupQuestions.forEach(q => {
        if (q.isScenarioBased && q.scenarioText) {
          const sKey = q.scenarioText.trim().toLowerCase();
          if (!scenarioClusters[sKey]) scenarioClusters[sKey] = [];
          scenarioClusters[sKey].push(q);
        } else {
          soloQuestions.push(q);
        }
      });

      const units = [
        ...Object.values(scenarioClusters).map(qs => ({ questions: qs, size: qs.length })),
        ...soloQuestions.map(q => ({ questions: [q], size: 1 }))
      ];
      
      // Randomizing units to ensure even distribution
      setGroups[key] = units.sort(() => Math.random() - 0.5);
    }

    console.log(`📁 Grouped into ${Object.keys(groups).length} sets. Applying bucket assignment...`);

    let totalUpdated = 0;
    let batch = writeBatch(db);
    let batchOpCount = 0;

    for (const key in setGroups) {
      const units = setGroups[key];
      const pool = [1, 2, 3];
      const bucketCounts = { 1: 0, 2: 0, 3: 0 };
      let maxBucketSeen = 3;

      for (const unit of units) {
        // Rule: Ensure at least 3 non-full buckets (capacity >= unit.size) in selection pool
        let available = pool.filter(b => (bucketCounts[b] || 0) + unit.size <= 20);
        
        while (available.length < 3) {
          maxBucketSeen++;
          pool.push(maxBucketSeen);
          bucketCounts[maxBucketSeen] = 0;
          available = pool.filter(b => (bucketCounts[b] || 0) + unit.size <= 20);
        }

        // Random assignment from available pool
        const bucket = available[Math.floor(Math.random() * available.length)];
        bucketCounts[bucket] = (bucketCounts[bucket] || 0) + unit.size;

        for (const q of unit.questions) {
          batch.update(doc(db, 'questions', q.id), { bucketNumber: bucket });
          batchOpCount++;

          if (batchOpCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchOpCount = 0;
          }
          totalUpdated++;
        }
      }
    }

    if (batchOpCount > 0) {
      await batch.commit();
    }

    console.log(`✅ Success! Migrated ${totalUpdated} questions.`);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  }
  
  process.exit(0);
}

migrateBuckets();
