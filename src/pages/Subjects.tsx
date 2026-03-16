import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit2, Trash2, X, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Subject {
  id: string;
  name: string;
  iconName: string;
  colorHex: string;
  grade: number;
}

export const Subjects: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Grade Filter State
  const [selectedGrade, setSelectedGrade] = useState<number>(10);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', iconName: '', colorHex: '#2563EB', grade: 10 });
  const [error, setError] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'subjects'),
        where('grade', '==', selectedGrade)
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) as Subject[];
      setSubjects(data);
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
    if (window.confirm('Are you sure you want to delete this subject?')) {
      try {
        await deleteDoc(doc(db, 'subjects', id));
        fetchSubjects();
      } catch (error) {
        console.error('Error deleting subject:', error);
      }
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
        grade: subject.grade || selectedGrade 
      });
    } else {
      setEditingId(null);
      setFormData({ 
        name: '', 
        iconName: 'menu_book', 
        colorHex: '#2563EB',
        grade: selectedGrade 
      });
    }
    setIsModalOpen(true);
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
              <h1 className="text-2xl font-bold text-white">Manage Subjects</h1>
              <p className="text-sm text-slate-400">Add, edit, or remove grade-specific quiz categories</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 pl-2 text-slate-400">
              <span className="text-sm font-medium">Grade:</span>
            </div>
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
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
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
                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">Grade {subject.grade}</span>
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
                      onChange={e => setFormData({...formData, grade: parseInt(e.target.value)})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
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
                    onChange={e => setFormData({...formData, iconName: e.target.value})}
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
                      onChange={e => setFormData({...formData, colorHex: e.target.value})}
                      className="w-12 h-11 rounded bg-slate-900 border border-slate-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      required
                      value={formData.colorHex}
                      onChange={e => setFormData({...formData, colorHex: e.target.value})}
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
      </div>
    </div>
  );
};
