import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, X, ChevronLeft, Filter, Database, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import mammoth from 'mammoth';
import { useAuth } from '../context/AuthContext';
import { createLog } from '../utils/logger';

const sha1 = async (str: string) => {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

interface Subject {
  id: string;
  name: string;
  questionCount?: number;
}

interface Question {
  id: string;
  subjectId: string;
  grade: number;
  text: string;
  options: string[];
  correctIndex: number;
  imageUrl?: string;
  optionImages?: string[]; // Added
  timeLimit?: number;
  medium?: string;
  isScenarioBased?: boolean;
  scenarioText?: string;
  scenarioImageUrl?: string;
  bucketNumber: number;
}

export const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  const allowedGrades = userProfile?.role === 'User' 
    ? Array.from(new Set(userProfile.allowedAccess?.map(a => a.grade) || []))
    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  const [uploadLoading, setUploadLoading] = useState(false); // Added
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [selectedMedium, setSelectedMedium] = useState<string>(''); // Added

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<any[]>([]);
  const [currentExtractedIndex, setCurrentExtractedIndex] = useState<number>(-1);
  const [formData, setFormData] = useState({
    subjectId: '',
    grade: 10,
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    imageUrl: '',
    optionImages: ['', '', '', ''],
    timeLimit: 90,
    medium: 'English',
    isScenarioBased: false,
    scenarioText: '',
    scenarioImageUrl: '',
    bucketNumber: 0
  });
  const [scenarioCount, setScenarioCount] = useState(1);
  const [currentScenarioStep, setCurrentScenarioStep] = useState(1);
  const [scenarioBatchQuestions, setScenarioBatchQuestions] = useState<any[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);

  useEffect(() => {
    if (userProfile?.role === 'User' && !allowedGrades.includes(selectedGrade)) {
      if (allowedGrades.length > 0) {
        setSelectedGrade(allowedGrades[0]);
      }
    }
  }, [userProfile, selectedGrade]);

  useEffect(() => {
    const checkDuplicate = async () => {
      const text = formData.text.trim().toLowerCase();
      if (!text || !formData.subjectId) {
        setIsDuplicate(false);
        return;
      }

      // Check if we already have the relevant questions in memory
      const matchesFilter = 
        formData.subjectId === selectedSubjectId && 
        formData.grade === selectedGrade && 
        formData.medium === (selectedMedium || 'English');

      if (matchesFilter) {
        const found = questions.some(q => 
          q.text.trim().toLowerCase() === text && 
          q.id !== editingId
        );
        setIsDuplicate(found);
      } else {
        // Fetch questions for the new context to check
        try {
          const q = query(
            collection(db, 'questions'),
            where('subjectId', '==', formData.subjectId),
            where('grade', '==', formData.grade),
            where('medium', '==', formData.medium)
          );
          const snapshot = await getDocs(q);
          const found = snapshot.docs.some(d => {
            const data = d.data();
            return d.id !== editingId && (data.text || '').trim().toLowerCase() === text;
          });
          setIsDuplicate(found);
        } catch (err) {
          console.error("Error checking duplicate", err);
          setIsDuplicate(false);
        }
      }
    };

    const debounce = setTimeout(checkDuplicate, 300);
    return () => clearTimeout(debounce);
  }, [formData.text, formData.subjectId, formData.grade, formData.medium, questions, editingId, selectedSubjectId, selectedGrade, selectedMedium]);

  const fetchSubjects = async () => {
    try {
      const q = query(
        collection(db, 'subjects'),
        where('grade', '==', selectedGrade)
      );
      const subSnapshot = await getDocs(q);
      const subsData = subSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      
      // Fetch counts for each subject in this grade
      const subsWithCountsRaw = await Promise.all(
        subsData.map(async (sb) => {
          try {
            const countQuery = query(
              collection(db, 'questions'),
              where('subjectId', '==', sb.id),
              where('grade', '==', selectedGrade)
            );
            const countSnapshot = await getCountFromServer(countQuery);
            return { ...sb, questionCount: countSnapshot.data().count };
          } catch (err) {
            console.error(`Error counting questions for ${sb.name}:`, err);
            return { ...sb, questionCount: 0 };
          }
        })
      );

      const subsWithCounts = userProfile?.role === 'User'
        ? subsWithCountsRaw.filter((s: any) => userProfile.allowedAccess?.some(a => a.grade === selectedGrade && a.subjectId === s.id))
        : subsWithCountsRaw;

      setSubjects(subsWithCounts);
      
      // Update selected subject if current one is not in the new list
      if (subsWithCounts.length > 0) {
        if (!subsWithCounts.find((s: Subject) => s.id === selectedSubjectId)) {
          setSelectedSubjectId(subsWithCounts[0].id);
          setFormData(prev => ({ ...prev, subjectId: subsWithCounts[0].id }));
        }
      } else {
        setSelectedSubjectId('');
        setFormData(prev => ({ ...prev, subjectId: '' }));
      }
    } catch (error) {
      console.error("Error fetching subjects", error);
    }
  };

  const runBucketMigration = async () => {
    setIsMigrating(true);
    setShowMigrationConfirm(false);
    try {
      const querySnapshot = await getDocs(collection(db, 'questions'));
      const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      setMigrationProgress({ current: 0, total: docs.length });

      const groups: Record<string, any[]> = {};
      docs.forEach(q => {
        const key = `${q.subjectId}_${q.grade}_${q.medium || 'English'}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(q);
      });

      let processedCount = 0;
      const { writeBatch } = await import('firebase/firestore');
      let batch = writeBatch(db);
      let batchOpCount = 0;

      for (const key in groups) {
        const groupQuestions = groups[key];
        const pool = [1, 2, 3];
        const bucketCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
        let maxBucketSeen = 3;

        for (const q of groupQuestions) {
          // Rule: Ensure at least 3 non-full buckets are in the selection pool
          let available = pool.filter(b => (bucketCounts[b] || 0) < 20);
          
          while (available.length < 3) {
            maxBucketSeen++;
            pool.push(maxBucketSeen);
            bucketCounts[maxBucketSeen] = 0;
            available = pool.filter(b => (bucketCounts[b] || 0) < 20);
          }

          const bucket = available[Math.floor(Math.random() * available.length)];
          bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;

          batch.update(doc(db, 'questions', q.id), { bucketNumber: bucket });
          batchOpCount++;

          if (batchOpCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchOpCount = 0;
          }
          
          processedCount++;
          setMigrationProgress({ current: processedCount, total: docs.length });
        }
      }

      if (batchOpCount > 0) {
        await batch.commit();
      }

      alert("Migration completed successfully!");
      fetchQuestions();
    } catch (err) {
      console.error("Migration failed:", err);
      alert("Migration failed. Check console for details.");
    } finally {
      setIsMigrating(false);
    }
  };

  const getRandomBucketNumber = async (subjectId: string, grade: number, medium: string, pendingCounts?: Record<number, number>, requiredCapacity: number = 1): Promise<number> => {
    const availableBuckets: number[] = [];
    let currentBucket = 1;

    // We want to find the first 3 buckets that have room for requiredCapacity (count + requiredCapacity <= 20)
    while (availableBuckets.length < 3) {
      const q = query(
        collection(db, 'questions'),
        where('subjectId', '==', subjectId),
        where('grade', '==', grade),
        where('medium', '==', medium),
        where('bucketNumber', '==', currentBucket)
      );
      const snapshot = await getCountFromServer(q);
      const firestoreCount = snapshot.data().count;
      const pendingCount = pendingCounts?.[currentBucket] || 0;
      
      const totalCount = firestoreCount + pendingCount;

      if (totalCount + requiredCapacity <= 20) {
        availableBuckets.push(currentBucket);
      }
      currentBucket++;
      if (currentBucket > 1000) break; // Safety
    }

    const randomIndex = Math.floor(Math.random() * availableBuckets.length);
    return availableBuckets[randomIndex];
  };

  const handleImageUpload = async (file: File, optionIndex?: number): Promise<string> => {
    setUploadLoading(true);
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
      const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const signature = await sha1(`timestamp=${timestamp}${apiSecret}`);

      const formDataCloud = new FormData();
      formDataCloud.append('file', file);
      formDataCloud.append('api_key', apiKey);
      formDataCloud.append('timestamp', timestamp.toString());
      formDataCloud.append('signature', signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formDataCloud
      });

      const data = await response.json();
      if (data.secure_url) {
        if (optionIndex !== undefined) {
          const newImages = [...formData.optionImages];
          newImages[optionIndex] = data.secure_url;
          setFormData(prev => ({ ...prev, optionImages: newImages }));
        } else if (!file.name.includes('scenario')) {
          setFormData(prev => ({ ...prev, imageUrl: data.secure_url }));
        }
        return data.secure_url;
      } else {
        console.error("Upload failed", data);
        return '';
      }
    } catch (err) {
      console.error("Image upload exception", err);
      return '';
    } finally {
      setUploadLoading(false);
    }
  };

  const handleGeminiExtract = async (file: File) => {
    setGeminiLoading(true);
    try {
      const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isPdf = file.type === 'application/pdf';
      
      let promptText = "Extract the question text and its options from the attached content. Output only a JSON array of objects with the structure: [{ \"text\": \"...\", \"options\": [\"...\", \"...\"], \"correctIndex\": 0-indexed number if indicated, otherwise -1 }]. Do not include any descriptive text, header, or markdown formatting. Extract all questions present. Do not include question numbers in the question text. Do not include option numbers/letters (like A., B., 1., 2.) in the options text.";
      let bodyData: any = {};

      if (isDocx) {
         const arrayBuffer = await file.arrayBuffer();
         const result = await mammoth.extractRawText({ arrayBuffer });
         const docText = result.value;
         
         if (!docText.trim()) {
            alert("No text found in the DOCX file.");
            setGeminiLoading(false);
            return;
         }

         promptText = "Extract all question texts and options from the following text. Output only a JSON array of objects with the structure: [{ \"text\": \"...\", \"options\": [\"...\", \"...\"], \"correctIndex\": 0-indexed number if indicated, otherwise -1 }]. Do not include any descriptive text, header, or markdown formatting. Do not include question numbers in the question text. Do not include option numbers/letters (like A., B., 1., 2.) in the options text.";
         
         bodyData = {
           contents: [{
             parts: [
               { text: promptText + "\n\nText:\n" + docText }
             ]
           }]
         };
      } else {
         if (isPdf) {
            promptText = "Extract all question texts and options from the attached PDF document. Output only a JSON array of objects with the structure: [{ \"text\": \"...\", \"options\": [\"...\", \"...\"], \"correctIndex\": 0-indexed number if indicated, otherwise -1 }]. Do not include any descriptive text, header, or markdown formatting. Do not include question numbers in the question text. Do not include option numbers/letters (like A., B., 1., 2.) in the options text.";
         }

         const reader = new FileReader();
         const base64Promise = new Promise<string>((resolve, reject) => {
           reader.onload = () => {
             if (typeof reader.result === 'string') {
               resolve(reader.result.split(',')[1]);
             } else {
               reject(new Error("Failed to read file"));
             }
           };
           reader.onerror = reject;
           reader.readAsDataURL(file);
         });

         const base64Image = await base64Promise;
         const mimeType = isPdf ? 'application/pdf' : file.type;

         bodyData = {
           contents: [{
             parts: [
               { inlineData: { mimeType: mimeType, data: base64Image } },
               { text: promptText }
             ]
           }]
         };
      }

      if (isPdf && file.size > 50 * 1024 * 1024) {
         alert("PDF file is too large (max 50MB).");
         setGeminiLoading(false);
         return;
      }

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
         alert("Gemini API key not found. Please set VITE_GEMINI_API_KEY in .env");
         setGeminiLoading(false);
         return;
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
         try {
            const cleanText = textResponse.trim().replace(/^```j?s?o?n?\s*/, '').replace(/```$/, '');
            const result = JSON.parse(cleanText);
            
            if (Array.isArray(result) && result.length > 0) {
               const formattedQuestions = result.map((q: any) => ({
                  subjectId: formData.subjectId || '',
                  grade: formData.grade,
                  text: q.text || '',
                  options: q.options ? [
                    ...q.options, 
                    ...Array(Math.max(0, formData.options.length - q.options.length)).fill('')
                  ].slice(0, formData.options.length) : Array(formData.options.length).fill(''),
                  correctIndex: q.correctIndex !== undefined && q.correctIndex >= 0 && q.correctIndex < formData.options.length ? q.correctIndex : -1,
                  imageUrl: '',
                  optionImages: Array(formData.options.length).fill(''),
                  timeLimit: formData.timeLimit,
                  medium: formData.medium,
                  isScenarioBased: formData.isScenarioBased,
                  scenarioText: formData.scenarioText,
                  scenarioImageUrl: formData.scenarioImageUrl,
                  bucketNumber: 0
               }));

               setExtractedQuestions(formattedQuestions);
               setCurrentExtractedIndex(0);
               setFormData(formattedQuestions[0]);
            } else if (!Array.isArray(result) && result.text) {
               const formatted = {
                  subjectId: formData.subjectId || '',
                  grade: formData.grade,
                  text: result.text || '',
                  options: result.options ? [
                    ...result.options, 
                    ...Array(Math.max(0, formData.options.length - result.options.length)).fill('')
                  ].slice(0, formData.options.length) : Array(formData.options.length).fill(''),
                  correctIndex: result.correctIndex !== undefined && result.correctIndex >= 0 && result.correctIndex < formData.options.length ? result.correctIndex : -1,
                  imageUrl: '',
                  optionImages: Array(formData.options.length).fill(''),
                  timeLimit: formData.timeLimit,
                  medium: formData.medium,
                  isScenarioBased: formData.isScenarioBased,
                  scenarioText: formData.scenarioText,
                  scenarioImageUrl: formData.scenarioImageUrl,
                  bucketNumber: 0
               };
               setExtractedQuestions([formatted]);
               setCurrentExtractedIndex(0);
               setFormData(formatted);
            } else {
               alert("No questions found or invalid format.");
            }
         } catch (e) {
            console.error("Failed to parse Gemini response", textResponse, e);
            alert("Failed to parse extracted text. Please check the file and try again.");
         }
      } else {
         console.error("No response from Gemini", data);
         if (data.error) {
            alert(`Gemini API Error: ${data.error.message}`);
         } else if (data.promptFeedback?.blockReason) {
            alert(`Content Blocked: ${data.promptFeedback.blockReason}`);
         } else if (data.candidates?.[0]?.finishReason) {
            alert(`Extraction failed: ${data.candidates[0].finishReason}`);
         } else {
            alert("No text found in the file. Full response logged in console.");
         }
      }
    } catch (err) {
      console.error("Gemini extraction error", err);
      alert("Error extracting question.");
    } finally {
      setGeminiLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [selectedGrade]);

  const fetchQuestions = async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    try {
      let q = query(
        collection(db, 'questions'),
        where('subjectId', '==', selectedSubjectId),
        where('grade', '==', selectedGrade)
      );
      
      if (selectedMedium) {
        q = query(q, where('medium', '==', selectedMedium));
      }

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Question[];
      setQuestions(data);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [selectedSubjectId, selectedGrade, selectedMedium]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDuplicate && !editingId) {
      alert("Please fix duplicate question before saving.");
      return;
    }
    
    setSaveLoading(true);
    try {
      if (formData.isScenarioBased && scenarioCount > 1 && !editingId) {
        // Handling Batch Scenario Mode
        if (currentScenarioStep < scenarioCount) {
          // Add current to batch and move to next
          setScenarioBatchQuestions(prev => [...prev, { ...formData }]);
          setCurrentScenarioStep(prev => prev + 1);
          // Reset question-specific fields but keep scenario
          setFormData(prev => ({
            ...prev,
            text: '',
            options: Array(prev.grade >= 12 ? 5 : 4).fill(''),
            correctIndex: 0,
            imageUrl: '',
            optionImages: Array(prev.grade >= 12 ? 5 : 4).fill(''),
            bucketNumber: 0
          }));
          setSaveLoading(false);
          return;
        } else {
          // Saving the whole batch (Previous questions + current one)
          const allQuestions = [...scenarioBatchQuestions, { ...formData }];
          
          // Assign all questions in the scenario to the same bucket
          const batchSize = allQuestions.length;
          const bucket = await getRandomBucketNumber(formData.subjectId, formData.grade, formData.medium, {}, batchSize);
          const finalBatch = allQuestions.map(q => ({ ...q, bucketNumber: bucket } as Question));

          const batchPromises = finalBatch.map(q => addDoc(collection(db, 'questions'), q));
          await Promise.all(batchPromises);
          
          if (userProfile) {
            await createLog(userProfile.id, userProfile.username || userProfile.email, 'CREATE_QUESTION', `Created a batch of ${batchSize} scenario questions for Subject ID: ${formData.subjectId}`);
          }

          setIsModalOpen(false);
          setScenarioBatchQuestions([]);
          setCurrentScenarioStep(1);
          setScenarioCount(1);
        }
      } else {
        // Normal Single Question Save / Edit
        if (editingId) {
          await updateDoc(doc(db, 'questions', editingId), formData);
          if (userProfile) {
            await createLog(userProfile.id, userProfile.username || userProfile.email, 'UPDATE_QUESTION', `Updated question ID: ${editingId}`);
          }
        } else {
          const bucket = await getRandomBucketNumber(formData.subjectId, formData.grade, formData.medium);
          await addDoc(collection(db, 'questions'), { ...formData, bucketNumber: bucket });
          if (userProfile) {
            await createLog(userProfile.id, userProfile.username || userProfile.email, 'CREATE_QUESTION', `Created single question for Subject ID: ${formData.subjectId}`);
          }
        }
        
        if (extractedQuestions.length > 0 && currentExtractedIndex < extractedQuestions.length - 1) {
           const list = [...extractedQuestions];
           list[currentExtractedIndex] = { ...formData };
           setExtractedQuestions(list);
           
           const nextIndex = currentExtractedIndex + 1;
           setCurrentExtractedIndex(nextIndex);
           setFormData(list[nextIndex]);
           setSaveLoading(false);
           return;
        } else {
           setIsModalOpen(false);
           setExtractedQuestions([]);
           setCurrentExtractedIndex(-1);
        }
      }
      fetchQuestions();
    } catch (error: any) {
      console.error('Error saving question:', error);
      alert('Failed to save question.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = (id: string | null) => {
    if (!id) return;
    setQuestionToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!questionToDelete) return;
    try {
      await deleteDoc(doc(db, 'questions', questionToDelete));
      if (userProfile) {
        await createLog(userProfile.id, userProfile.username || userProfile.email, 'DELETE_QUESTION', `Deleted question ID: ${questionToDelete}`);
      }
      setIsDeleteModalOpen(false);
      setQuestionToDelete(null);
      if (isModalOpen) setIsModalOpen(false);
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Error deleting question. Please check permissions or network.');
    }
  };

  const openModal = (question?: Question) => {
    setExtractedQuestions([]);
    setCurrentExtractedIndex(-1);
    
    if (question) {
      setEditingId(question.id);
      const needs5 = question.grade === 12 || question.grade === 13;
      const opts = [...question.options];
      const optImgs = question.optionImages ? [...question.optionImages] : ['', '', '', ''];
      while(opts.length < (needs5 ? 5 : 4)) opts.push('');
      while(optImgs.length < (needs5 ? 5 : 4)) optImgs.push('');
      
      setFormData({
        subjectId: question.subjectId,
        grade: question.grade,
        text: question.text,
        options: opts,
        correctIndex: question.correctIndex,
        imageUrl: question.imageUrl || '',
        optionImages: optImgs,
        timeLimit: question.timeLimit || 90,
        medium: question.medium || 'English',
        isScenarioBased: question.isScenarioBased || false,
        scenarioText: question.scenarioText || '',
        scenarioImageUrl: question.scenarioImageUrl || '',
        bucketNumber: question.bucketNumber || 0
      });
    } else {
      setEditingId(null);
      const needs5 = selectedGrade === 12 || selectedGrade === 13;
      setFormData({
        subjectId: selectedSubjectId,
        grade: selectedGrade,
        text: '',
        options: Array(needs5 ? 5 : 4).fill(''),
        correctIndex: 0,
        imageUrl: '',
        optionImages: Array(needs5 ? 5 : 4).fill(''),
        timeLimit: 90,
        medium: selectedMedium || 'English',
        isScenarioBased: false,
        scenarioText: '',
        scenarioImageUrl: '',
        bucketNumber: 0
      });
    }
    setScenarioCount(1);
    setCurrentScenarioStep(1);
    setScenarioBatchQuestions([]);
    setIsModalOpen(true);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({ ...formData, options: newOptions });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Manage Questions</h1>
              <p className="text-sm text-slate-400">Filter and edit the quiz databanks</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-xl border border-slate-700 flex-wrap">
            <div className="flex items-center gap-2 pl-2 text-slate-400">
              <Filter size={16} />
              <span className="text-sm font-medium">Filter:</span>
            </div>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              <option value="" disabled>Select Subject</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.questionCount !== undefined ? `(${s.questionCount})` : ''}
                </option>
              ))}
            </select>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(parseInt(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              {allowedGrades.map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>

            <select
              value={selectedMedium}
              onChange={(e) => setSelectedMedium(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              <option value="">All Mediums</option>
              <option value="English">English</option>
              <option value="Sinhala">Sinhala</option>
              <option value="Tamil">Tamil</option>
            </select>

            {userProfile?.role !== 'User' && (
              <button
                onClick={() => setShowMigrationConfirm(true)}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-amber-400 rounded-lg transition-colors flex items-center justify-center ml-2"
                title="Run Bucket Migration (Admin)"
              >
                <Database size={18} />
              </button>
            )}

            <button
              onClick={() => openModal()}
              disabled={!selectedSubjectId}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Add Question
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl p-12 text-center border border-slate-700/50">
            <p className="text-slate-400">No questions found for this Grade and Subject.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((question, qIndex) => (
              <div key={question.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="flex-1 flex gap-4 items-start">
                  {question.imageUrl && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900 flex-shrink-0 mt-1">
                      <img src={question.imageUrl} alt="Question" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded font-medium">Q.{qIndex + 1}</span>
                      {question.isScenarioBased && (
                        <span className="bg-amber-600/20 text-amber-500 text-[10px] px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase tracking-wider">Scenario Based</span>
                      )}
                      {question.bucketNumber > 0 && (
                        <span className="bg-indigo-600/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded border border-indigo-500/20 font-bold uppercase tracking-wider">
                          Bucket {question.bucketNumber}
                        </span>
                      )}
                      <h3 className="text-lg font-medium text-white whitespace-pre-wrap">{question.text}</h3>
                      <span className="bg-blue-600/10 text-blue-400 text-xs px-2 py-1 rounded font-medium flex items-center gap-1">
                        {question.timeLimit || 90} sec
                      </span>
                    </div>
                    {question.isScenarioBased && question.scenarioText && (
                      <div className="mb-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
                        <div className="flex gap-4 items-start">
                          {question.scenarioImageUrl && (
                            <img src={question.scenarioImageUrl} alt="Scenario" className="w-24 h-24 object-contain rounded-lg bg-black/20" />
                          )}
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Scenario Content:</span>
                            <p className="text-sm text-slate-300 italic whitespace-pre-wrap">"{question.scenarioText}"</p>
                          </div>
                        </div>
                      </div>
                    )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    {question.options.map((opt, idx) => (
                      <div 
                        key={idx} 
                        className={`px-4 py-2 rounded-lg text-sm border whitespace-pre-wrap ${
                          idx === question.correctIndex 
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400 font-medium' 
                            : 'bg-slate-900/50 border-slate-700/50 text-slate-400'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}. {opt}
                        {idx === question.correctIndex && <span className="ml-2 text-xs">(Correct)</span>}
                      </div>
                    ))}
                  </div>
                </div>
                </div>
                
                <div className="flex md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-700/50 md:pl-6 justify-center">
                  <button
                    onClick={() => openModal(question)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 py-2 md:px-6 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(question.id)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 py-2 md:px-6 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Forms Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl my-8 flex flex-col max-h-[calc(100vh-4rem)]">
              <div className="flex-shrink-0 bg-slate-800 p-6 border-b border-slate-700 flex justify-between items-center rounded-t-2xl z-10">
                <h3 className="text-lg font-semibold">{editingId ? 'Edit Question' : 'New Question'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Gemini Extraction */}
                <div className="bg-slate-900/40 p-4 rounded-xl border border-dashed border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Auto-fill with Gemini AI</h4>
                    <p className="text-xs text-slate-400">Scan Camera, Upload PDF, or DOCX to populate</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <input
                      type="file"
                      id="geminiCamera"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleGeminiExtract(file);
                      }}
                    />
                    <input
                      type="file"
                      id="geminiUpload"
                      accept="image/*,application/pdf,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleGeminiExtract(file);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('geminiCamera')?.click()}
                      disabled={geminiLoading}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-70"
                    >
                      Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('geminiUpload')?.click()}
                      disabled={geminiLoading}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-70"
                    >
                      {geminiLoading ? '...' : 'Upload File'}
                    </button>
                  </div>
                </div>

                {/* Navigation inside modal for extracted questions */}
                {extractedQuestions.length > 0 && (
                  <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={currentExtractedIndex <= 0}
                      onClick={() => {
                         const list = [...extractedQuestions];
                         list[currentExtractedIndex] = { ...formData };
                         setExtractedQuestions(list);
                         
                         const prevIndex = currentExtractedIndex - 1;
                         setCurrentExtractedIndex(prevIndex);
                         setFormData(list[prevIndex]);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-slate-300">
                      Question {currentExtractedIndex + 1} of {extractedQuestions.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentExtractedIndex >= extractedQuestions.length - 1}
                      onClick={() => {
                         const list = [...extractedQuestions];
                         list[currentExtractedIndex] = { ...formData };
                         setExtractedQuestions(list);

                         const nextIndex = currentExtractedIndex + 1;
                         setCurrentExtractedIndex(nextIndex);
                         setFormData(list[nextIndex]);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* Scenario Toggle & Info */}
                {!editingId && (
                  <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${formData.isScenarioBased ? 'bg-amber-600' : 'bg-slate-700'}`}
                             onClick={() => setFormData({...formData, isScenarioBased: !formData.isScenarioBased})}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isScenarioBased ? 'left-5' : 'left-1'}`} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">Scenario Mode</h4>
                          <p className="text-xs text-slate-400">Multiple questions based on one text/image</p>
                        </div>
                      </div>
                      
                      {formData.isScenarioBased && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-400 uppercase font-bold">Questions in Batch:</label>
                          <input 
                            type="number" 
                            min="1" 
                            max="10"
                            value={scenarioCount}
                            onChange={(e) => setScenarioCount(parseInt(e.target.value) || 1)}
                            className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-center focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {formData.isScenarioBased && (
                      <div className="space-y-4 pt-2 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-1">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1">Scenario Text</label>
                          <textarea
                            value={formData.scenarioText}
                            onChange={(e) => setFormData({...formData, scenarioText: e.target.value})}
                            required
                            placeholder="Enter the shared introduction text..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 outline-none min-h-[100px] text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center justify-between">
                            Scenario Image (Optional)
                            <span className="text-[10px] text-slate-500">Shared across all questions in batch</span>
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="file"
                              accept="image/*"
                              className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600 transition-all cursor-pointer flex-1"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setUploadLoading(true);
                                  const url = await handleImageUpload(file);
                                  setFormData({ ...formData, scenarioImageUrl: url });
                                  setUploadLoading(false);
                                }
                              }}
                            />
                            {formData.scenarioImageUrl && (
                              <div className="relative group">
                                <img src={formData.scenarioImageUrl} alt="Scenario preview" className="w-12 h-12 rounded border border-slate-700 object-cover" />
                                <button type="button" onClick={() => setFormData({...formData, scenarioImageUrl: ''})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {scenarioCount > 1 && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 font-bold text-sm">
                              {currentScenarioStep}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-amber-200 font-medium lowercase italic">Saving sequence: Input current question details, then click "Add Next" until all {scenarioCount} are complete.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

            {/* Form Fields */}
            <div className="space-y-4">
              {formData.bucketNumber > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl text-xs font-bold border border-indigo-500/20">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  ASSIGNED TO BUCKET {formData.bucketNumber}
                </div>
              )}
              
              <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
                    <select
                      value={formData.subjectId}
                      onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.questionCount !== undefined ? `(${s.questionCount})` : ''}
                </option>
              ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Grade</label>
                    <select
                      value={formData.grade}
                      onChange={e => {
                        const newGrade = parseInt(e.target.value);
                        const needs5 = newGrade === 12 || newGrade === 13;
                        setFormData(prev => {
                          let opts = [...prev.options];
                          let optImgs = [...prev.optionImages];
                          if (needs5 && opts.length < 5) {
                            opts.push('');
                            optImgs.push('');
                          } else if (!needs5 && opts.length > 4) {
                            opts = opts.slice(0, 4);
                            optImgs = optImgs.slice(0, 4);
                          }
                          return {
                            ...prev,
                            grade: newGrade,
                            options: opts,
                            optionImages: optImgs,
                            correctIndex: prev.correctIndex >= opts.length ? 0 : prev.correctIndex
                          };
                        });
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Time Limit (sec)</label>
                    <input
                      type="number"
                      required
                      value={formData.timeLimit}
                      onChange={e => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      min={5}
                      max={300}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Medium</label>
                    <select
                      value={formData.medium}
                      onChange={e => setFormData({ ...formData, medium: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="English">English</option>
                      <option value="Sinhala">Sinhala</option>
                      <option value="Tamil">Tamil</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Question Text</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.text}
                    onChange={e => setFormData({...formData, text: e.target.value})}
                    onPaste={(e) => {
                      const file = e.clipboardData.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        e.preventDefault();
                        handleImageUpload(file);
                      }
                    }}
                    className={`w-full bg-slate-900 border ${isDuplicate ? 'border-red-500 ring-2 ring-red-500/20 text-red-400' : 'border-slate-700'} rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-y transition-all`}
                    placeholder="Type the question here..."
                  />
                  {isDuplicate && (
                    <p className="mt-2 text-xs font-medium text-red-500 flex items-center gap-1">
                      <X size={14} />
                      This question already exists in this Subject/Grade/Medium!
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Image (Optional)</label>
                  <div className="mt-1 flex items-center gap-4">
                    {formData.imageUrl && (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                        <button 
                          type="button" 
                          onClick={() => setFormData({...formData, imageUrl: ''})}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 p-1 rounded-full text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        className="hidden"
                        id="imageUpload"
                      />
                      <label 
                        htmlFor="imageUpload"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') document.getElementById('imageUpload')?.click();
                        }}
                        onPaste={(e) => {
                          const file = e.clipboardData.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            handleImageUpload(file);
                          }
                        }}
                        className="flex items-center justify-center border-2 border-dashed border-slate-700 hover:border-emerald-500/50 focus:border-emerald-500 outline-none rounded-xl p-4 cursor-pointer transition-colors"
                      >
                        <span className="text-sm text-slate-400">
                          {uploadLoading ? 'Uploading...' : formData.imageUrl ? 'Change Image (or Paste)' : 'Click to Upload Image (or Paste)'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Options & Answer</label>
                  <div className="space-y-3">
                    {formData.options.map((opt, idx) => (
                      <div key={idx} className="flex flex-col gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center justify-center p-1 cursor-pointer">
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={formData.correctIndex === idx}
                              onChange={() => setFormData({...formData, correctIndex: idx})}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-900"
                            />
                          </label>
                          <span className="text-slate-400 font-medium w-6 text-center">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={e => handleOptionChange(idx, e.target.value)}
                            onPaste={(e) => {
                              const file = e.clipboardData.files?.[0];
                              if (file && file.type.startsWith('image/')) {
                                e.preventDefault();
                                handleImageUpload(file, idx);
                              }
                            }}
                            className={`flex-1 bg-slate-900 border ${formData.correctIndex === idx ? 'border-emerald-500/50' : 'border-slate-700'} rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none`}
                            placeholder={`Option ${idx + 1}`}
                          />
                        </div>
                        {/* Option Image Upload */}
                        <div className="ml-12 flex items-center gap-3">
                          {formData.optionImages?.[idx] && (
                            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0">
                              <img src={formData.optionImages[idx]} alt="Option Preview" className="w-full h-full object-contain" />
                              <button 
                                type="button" 
                                onClick={() => {
                                  const newImages = [...formData.optionImages];
                                  newImages[idx] = '';
                                  setFormData({...formData, optionImages: newImages});
                                }}
                                className="absolute top-0.5 right-0.5 bg-red-600 hover:bg-red-700 p-0.5 rounded-full text-white"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          )}
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file, idx);
                              }}
                              className="hidden"
                              id={`optionImage-${idx}`}
                            />
                            <label 
                              htmlFor={`optionImage-${idx}`}
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') document.getElementById(`optionImage-${idx}`)?.click();
                              }}
                              onPaste={(e) => {
                                const file = e.clipboardData.files?.[0];
                                if (file && file.type.startsWith('image/')) {
                                  handleImageUpload(file, idx);
                                }
                              }}
                              className="flex items-center justify-center border border-dashed border-slate-700 hover:border-emerald-500/50 focus:border-emerald-500 outline-none rounded-lg p-2 cursor-pointer transition-colors text-xs text-slate-400"
                            >
                              {uploadLoading ? 'Uploading...' : formData.optionImages?.[idx] ? 'Change Image (or Paste)' : '+ Add Image (or Paste)'}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3 ml-12">Select the radio button next to the correct answer.</p>
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingId)}
                      className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-medium transition-colors"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isDuplicate || uploadLoading || geminiLoading || saveLoading}
                    title={isDuplicate ? "Cannot save duplicate question" : ""}
                    className={`flex-1 py-2.5 rounded-xl font-medium transition-colors text-white ${
                      isDuplicate || uploadLoading || geminiLoading || saveLoading
                        ? 'bg-slate-700 cursor-not-allowed opacity-50' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20'
                    }`}
                  >
                    {uploadLoading ? 'Uploading...' : geminiLoading ? 'Extracting...' : saveLoading ? 'Saving...' : isDuplicate ? 'Duplicate Question' : editingId ? 'Update Question' : 'Save Question'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Migration Confirmation Modal */}
        {showMigrationConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
            <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-6 text-center">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                <AlertTriangle className="text-amber-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Run Bucket Migration?</h3>
              <p className="text-slate-400 mb-8 text-sm">
                This will assign randomized bucket numbers to **ALL** existing questions in the database. 
                This process may take a few minutes depending on the database size.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMigrationConfirm(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={runBucketMigration}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 rounded-xl font-medium transition-colors text-white shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2"
                >
                  Confirm & Run
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Migration Progress Overlay */}
        {isMigrating && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
            <div className="bg-slate-900 rounded-3xl w-full max-w-sm border border-slate-800 shadow-3xl p-8 text-center ring-1 ring-slate-700">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
                <div 
                  className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
                  style={{ animationDuration: '1.5s' }}
                />
                <Database className="absolute inset-0 m-auto text-emerald-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 italic">Synchronizing Data...</h3>
              <p className="text-slate-400 text-sm mb-6 uppercase tracking-widest font-semibold">Updating Question Buckets</p>
              
              <div className="w-full bg-slate-800 rounded-full h-3 mb-3 border border-slate-700 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full transition-all duration-300 ease-out"
                  style={{ width: `${(migrationProgress.current / migrationProgress.total) * 100}%` }}
                />
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Progress</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {migrationProgress.current} / {migrationProgress.total} Items
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Are you sure?</h3>
              <p className="text-slate-400 mb-8">
                Do you really want to delete this question? This action cannot be undone and will permanently remove it from the database.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors text-white shadow-lg shadow-red-900/20"
                >
                  Delete Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
