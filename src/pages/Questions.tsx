import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, X, ChevronLeft, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

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
}

export const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false); // Added
  
  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<number>(10);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    subjectId: '',
    grade: 10,
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    imageUrl: '',
    optionImages: ['', '', '', ''] // Added
  });

  const fetchSubjects = async () => {
    try {
      const q = query(
        collection(db, 'subjects'),
        where('grade', '==', selectedGrade)
      );
      const subSnapshot = await getDocs(q);
      const subs = subSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
      setSubjects(subs);
      
      // Update selected subject if current one is not in the new list
      if (subs.length > 0) {
        if (!subs.find(s => s.id === selectedSubjectId)) {
          setSelectedSubjectId(subs[0].id);
          setFormData(prev => ({ ...prev, subjectId: subs[0].id }));
        }
      } else {
        setSelectedSubjectId('');
        setFormData(prev => ({ ...prev, subjectId: '' }));
      }
    } catch (error) {
      console.error("Error fetching subjects", error);
    }
  };

  const handleImageUpload = async (file: File, optionIndex?: number) => {
    setUploadLoading(true);
    try {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const apiKey = '865369964717118';
      const apiSecret = 'cXx1dzHrDl9LTndaaf_ztdZJjsk';
      const cloudName = 'dy3myxhnf';
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
        } else {
          setFormData(prev => ({ ...prev, imageUrl: data.secure_url }));
        }
      } else {
        console.error("Upload failed", data);
      }
    } catch (err) {
      console.error("Image upload exception", err);
    } finally {
      setUploadLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [selectedGrade]);

  const fetchQuestions = async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'questions'),
        where('subjectId', '==', selectedSubjectId),
        where('grade', '==', selectedGrade)
      );
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
  }, [selectedSubjectId, selectedGrade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'questions', editingId), formData);
      } else {
        await addDoc(collection(db, 'questions'), formData);
      }
      setIsModalOpen(false);
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteDoc(doc(db, 'questions', id));
        fetchQuestions();
      } catch (error) {
        console.error('Error deleting question:', error);
      }
    }
  };

  const openModal = (question?: Question) => {
    if (question) {
      setEditingId(question.id);
      setFormData({
        subjectId: question.subjectId,
        grade: question.grade,
        text: question.text,
        options: [...question.options],
        correctIndex: question.correctIndex,
        imageUrl: question.imageUrl || '',
        optionImages: question.optionImages || ['', '', '', '']
      });
    } else {
      setEditingId(null);
      setFormData({
        subjectId: selectedSubjectId,
        grade: selectedGrade,
        text: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        imageUrl: '',
        optionImages: ['', '', '', '']
      });
    }
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
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(parseInt(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
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
                    <div className="flex items-center gap-3 mb-2">
                    <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded font-medium">Q.{qIndex + 1}</span>
                    <h3 className="text-lg font-medium text-white">{question.text}</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    {question.options.map((opt, idx) => (
                      <div 
                        key={idx} 
                        className={`px-4 py-2 rounded-lg text-sm border ${
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl my-8">
              <div className="sticky top-0 bg-slate-800 p-6 border-b border-slate-700 flex justify-between items-center rounded-t-2xl z-10">
                <h3 className="text-lg font-semibold">{editingId ? 'Edit Question' : 'New Question'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Subject</label>
                    <select
                      value={formData.subjectId}
                      onChange={e => setFormData({...formData, subjectId: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Grade</label>
                    <select
                      value={formData.grade}
                      onChange={e => setFormData({...formData, grade: parseInt(e.target.value)})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Question Text</label>
                  <textarea
                    required
                    rows={2}
                    value={formData.text}
                    onChange={e => setFormData({...formData, text: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder="Type the question here..."
                  />
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
                        className="flex items-center justify-center border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-4 cursor-pointer transition-colors"
                      >
                        <span className="text-sm text-slate-400">
                          {uploadLoading ? 'Uploading...' : formData.imageUrl ? 'Change Image' : 'Click to Upload Image'}
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
                              className="flex items-center justify-center border border-dashed border-slate-700 hover:border-emerald-500/50 rounded-lg p-2 cursor-pointer transition-colors text-xs text-slate-400"
                            >
                              {uploadLoading ? 'Uploading...' : formData.optionImages?.[idx] ? 'Change Image' : '+ Add Image'}
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-3 ml-12">Select the radio button next to the correct answer.</p>
                </div>

                <div className="pt-4 flex gap-3 border-t border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-medium transition-colors text-white"
                  >
                    Save Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
