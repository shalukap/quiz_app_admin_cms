import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, X, ChevronLeft, AlertTriangle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Subject {
  id: string;
  name: string;
  iconName: string;
  colorHex: string;
  grade: number;
  medium?: string;
  questionCount?: number;
  bucketCounts?: Record<number, number>;
}

export const Subjects: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  // Grade & Medium Filter State
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [selectedMedium, setSelectedMedium] = useState<string>(''); // Added

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', iconName: '', colorHex: '#2563EB', grade: 10, medium: 'English' }); // Updated
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const [checkingQuestions, setCheckingQuestions] = useState(false);
  const [relatedQuestionsCount, setRelatedQuestionsCount] = useState(0);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'subjects'),
        where('grade', '==', selectedGrade)
      );

      if (selectedMedium) {
        q = query(q, where('medium', '==', selectedMedium));
      }
      const querySnapshot = await getDocs(q);
      const subjectsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as Subject[];

      // Fetch counts for each subject
      const subjectsWithCounts = await Promise.all(
        subjectsData.map(async (subject) => {
          try {
            const qQuery = query(
              collection(db, 'questions'),
              where('subjectId', '==', subject.id)
            );
            const snapshot = await getDocs(qQuery);
            const bucketCounts: Record<number, number> = {};
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              const b = data.bucketNumber || 0;
              bucketCounts[b] = (bucketCounts[b] || 0) + 1;
            });
            return { 
              ...subject, 
              questionCount: snapshot.size,
              bucketCounts 
            };
          } catch (err) {
            console.error(`Error fetching count for ${subject.name}:`, err);
            return { ...subject, questionCount: 0, bucketCounts: {} };
          }
        })
      );

      setSubjects(subjectsWithCounts);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, [selectedGrade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'subjects', editingId), formData);
      } else {
        await addDoc(collection(db, 'subjects'), formData);
      }
      setIsModalOpen(false);
      fetchSubjects();
    } catch (error: any) {
      console.error('Error saving subject:', error);
      if (error.code === 'resource-exhausted') {
        setError('Daily Firebase quota exceeded. Please try again tomorrow.');
      } else {
        setError('Failed to save subject. Please check your connection.');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSubjectToDelete(id);
    setIsDeleteModalOpen(true);
    setCheckingQuestions(true);
    setRelatedQuestionsCount(0);
    
    try {
      const q = query(collection(db, 'questions'), where('subjectId', '==', id));
      const snapshot = await getDocs(q);
      setRelatedQuestionsCount(snapshot.docs.length);
    } catch (error) {
      console.error('Error checking related questions:', error);
    } finally {
      setCheckingQuestions(false);
    }
  };

  const confirmDelete = async () => {
    if (!subjectToDelete) return;
    try {
      await deleteDoc(doc(db, 'subjects', subjectToDelete));
      setIsDeleteModalOpen(false);
      setSubjectToDelete(null);
      fetchSubjects();
    } catch (error) {
      console.error('Error deleting subject:', error);
      alert('Error deleting subject. Please check permissions or network.');
    }
  };

  const openModal = (subject?: Subject) => {
    setError(null);
    if (subject) {
      setEditingId(subject.id);
      setFormData({
        name: subject.name,
        iconName: subject.iconName,
        colorHex: subject.colorHex,
        grade: subject.grade || selectedGrade,
        medium: subject.medium || 'English'
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        iconName: 'menu_book',
        colorHex: '#2563EB',
        grade: selectedGrade,
        medium: selectedMedium || 'English'
      });
    }
    setIsModalOpen(true);
  };

  if (userProfile?.role === 'User') {
    return <Navigate to="/" replace />;
  }

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
              <h1 className="text-2xl font-bold text-white">Manage Subjects</h1>
              <p className="text-sm text-slate-400">Add, edit, or remove grade-specific quiz categories</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-xl border border-slate-700 flex-wrap">
            <div className="flex items-center gap-2 pl-2 text-slate-400">
              <span className="text-sm font-medium">Grade:</span>
            </div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(parseInt(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 pl-2 text-slate-400 border-l border-slate-700/50">
              <span className="text-sm font-medium">Medium:</span>
            </div>
            <select
              value={selectedMedium}
              onChange={(e) => setSelectedMedium(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none"
            >
              <option value="">All</option>
              <option value="English">English</option>
              <option value="Sinhala">Sinhala</option>
              <option value="Tamil">Tamil</option>
            </select>

            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Plus size={16} />
              Add Subject
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : subjects.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl p-12 text-center border border-slate-700/50">
            <p className="text-slate-400">No subjects found for Grade {selectedGrade}. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <div key={subject.id} className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 flex flex-col">
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${subject.colorHex}20` }}
                  >
                    <span
                      className="material-icons"
                      style={{ color: subject.colorHex }}
                    >
                      {subject.iconName}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{subject.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">Grade {subject.grade}</span>
                      <span className="text-xs font-semibold text-blue-400">
                        {subject.questionCount ?? 0} questions
                      </span>
                    </div>
                    {subject.bucketCounts && Object.keys(subject.bucketCounts).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(subject.bucketCounts).sort(([a], [b]) => Number(a) - Number(b)).map(([bucket, count]) => (
                          <span key={bucket} className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded" title={`Bucket ${bucket}`}>
                            B{bucket}: {count as React.ReactNode}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex gap-2 pt-4 border-t border-slate-700/50">
                  <button
                    onClick={() => openModal(subject)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-sm"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm"
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
            <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-semibold">{editingId ? 'Edit Subject' : 'New Subject'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Grade</label>
                    <select
                      value={formData.grade}
                      onChange={e => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Medium</label>
                    <select
                      value={formData.medium}
                      onChange={e => setFormData({ ...formData, medium: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="English">English</option>
                      <option value="Sinhala">Sinhala</option>
                      <option value="Tamil">Tamil</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Mathematics"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Material Icon Name</label>
                  <input
                    type="text"
                    required
                    value={formData.iconName}
                    onChange={e => setFormData({ ...formData, iconName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. functions, science, book"
                  />
                  <p className="text-xs text-slate-500 mt-1">Must be a valid Google Material Icon name.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Theme Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      required
                      value={formData.colorHex}
                      onChange={e => setFormData({ ...formData, colorHex: e.target.value })}
                      className="w-12 h-11 rounded bg-slate-900 border border-slate-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      required
                      value={formData.colorHex}
                      onChange={e => setFormData({ ...formData, colorHex: e.target.value })}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none uppercase font-mono text-sm"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveLoading ? 'Saving...' : 'Save Subject'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-6 text-center text-slate-100">
              {checkingQuestions ? (
                <div className="py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-slate-400">Checking for related questions...</p>
                </div>
              ) : relatedQuestionsCount > 0 ? (
                <>
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                    <AlertTriangle className="text-amber-500" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Subject Occupied</h3>
                  <p className="text-slate-400 mb-8">
                    This subject contains <span className="text-amber-400 font-bold">{relatedQuestionsCount}</span> questions. 
                    Please delete all questions in this subject from the Questions Dashboard before removing the subject itself.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                  >
                    Got it, thanks
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                    <Trash2 className="text-red-500" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Are you sure?</h3>
                  <p className="text-slate-400 mb-8">
                    Do you really want to delete this subject? It is currently empty. This action cannot be undone.
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
