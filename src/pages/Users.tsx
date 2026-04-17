import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Shield, ShieldAlert, User, Check, X, Edit2, Trash2, Plus, ChevronLeft, Key, AlertTriangle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import type { UserProfile } from '../context/AuthContext';
// Import secondary app to create user
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

interface Subject {
  id: string;
  name: string;
  grade: number;
}

export const Users: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Security check: Only Root can access this page
  if (userProfile && userProfile.role !== 'Root') {
    return <Navigate to="/" replace />;
  }

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Root' | 'Admin' | 'User'>('User');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [allowedAccess, setAllowedAccess] = useState<{grade: number, subjectId: string}[]>([]);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<number>(1);
  
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      // Filter to only show users who have a role assigned (CMS users)
      setUsers(usersSnap.docs
        .map(d => d.data() as UserProfile)
        .filter(u => u.role !== undefined)
      );

      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      setSubjects(subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    } catch (error) {
      console.error('Error fetching users/subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile?.role === 'Root') {
      fetchData();
    }
  }, [userProfile]);

  if (userProfile?.role !== 'Root') {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveLoading(true);

    try {
      if (editingId) {
        // Update user
        await updateDoc(doc(db, 'users', editingId), {
          username,
          email,
          role,
          status,
          allowedAccess: role === 'User' ? allowedAccess : []
        });
      } else {
        // Create user in Auth
        if (!password) {
          setError('Password is required for new users.');
          setSaveLoading(false);
          return;
        }

        const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp({
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        }, 'SecondaryApp');
        const secondaryAuth = getAuth(secondaryApp);

        const loginEmail = `${username.toLowerCase().replace(/\s+/g, '')}@quizapp.com`;
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, loginEmail, password);
        const newUid = userCredential.user.uid;
        
        // Create user in DB
        await setDoc(doc(db, 'users', newUid), {
          id: newUid,
          username,
          loginEmail,
          email, // This is the real email
          role,
          status,
          allowedAccess: role === 'User' ? allowedAccess : []
        });
        
        // Sign out secondary app to keep clean state
        await secondaryAuth.signOut();
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving user:', err);
      setError(err.message || 'Failed to save user.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this user's access profile? They won't be able to log in, but their Authentication record will remain.")) {
      try {
        await deleteDoc(doc(db, 'users', id));
        fetchData();
      } catch (err) {
        console.error(err);
        alert('Failed to delete user.');
      }
    }
  };

  const handleResetPassword = async (userEmail: string) => {
    if (!confirm(`Are you sure you want to send a password reset email to ${userEmail}?`)) return;
    
    try {
      await sendPasswordResetEmail(auth, userEmail);
      alert('Password reset email sent successfully!');
    } catch (err: any) {
      console.error('Reset error:', err);
      alert('Error sending reset email: ' + err.message);
    }
  };

  const openModal = (u?: UserProfile) => {
    setError(null);
    if (u) {
      setEditingId(u.id);
      setUsername(u.username || (u.email ? u.email.split('@')[0] : ''));
      setEmail(u.email || '');
      setPassword(''); // Don't show password for existing user
      setRole(u.role);
      setStatus(u.status);
      setAllowedAccess(u.allowedAccess || []);
    } else {
      setEditingId(null);
      setUsername('');
      setEmail('');
      setPassword('');
      setRole('User');
      setStatus('Active');
      setAllowedAccess([]);
      setSelectedGradeFilter(1);
    }
    setIsModalOpen(true);
  };

  const toggleSubjectAccess = (grade: number, subjectId: string) => {
    setAllowedAccess(prev => {
      const exists = prev.find(p => p.grade === grade && p.subjectId === subjectId);
      if (exists) {
        return prev.filter(p => !(p.grade === grade && p.subjectId === subjectId));
      } else {
        return [...prev, { grade, subjectId }];
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Manage Users</h1>
              <p className="text-sm text-slate-400">Control system access, roles, and subject privileges</p>
            </div>
          </div>
          
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Name</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Login ID</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Recovery Email</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Role</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{u.username || 'Unnamed'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-400 font-mono">
                      {(u as any).loginEmail || u.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                        u.role === 'Root' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                        u.role === 'Admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {u.role === 'Root' ? <ShieldAlert size={12} /> : u.role === 'Admin' ? <Shield size={12} /> : <User size={12} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleResetPassword((u as any).loginEmail || u.email)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-blue-400" title="Reset Password">
                          <Key size={14} />
                        </button>
                        <button onClick={() => openModal(u)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-slate-300" title="Edit User">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(u.id)} disabled={u.id === userProfile?.id} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors" title="Delete Profile">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-lg font-semibold">{editingId ? 'Edit User' : 'New User'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Username / Name</label>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                        placeholder="e.g. Shaluka Perera"
                      />
                      {username && (
                        <p className="mt-1.5 text-[10px] text-blue-400 font-mono">
                          Login ID: <span className="font-bold">{username.toLowerCase().replace(/\s+/g, '')}@quizapp.com</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Real Email (for Login & Resets)</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>

                  {!editingId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Initial Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                        placeholder="At least 6 characters"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                      <select
                        value={role}
                        onChange={e => setRole(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none"
                      >
                        <option value="User">User</option>
                        <option value="Admin">Admin</option>
                        <option value="Root">Root</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">
                        Root: Full access. Admin: Full subjects access but no user management. User: Selected subjects only.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  {role === 'User' && (
                    <div className="pt-4 border-t border-slate-700">
                      <h4 className="text-sm font-semibold text-white mb-4">Subject Access Privileges</h4>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Filter Subjects by Grade</label>
                        <select
                          value={selectedGradeFilter}
                          onChange={e => setSelectedGradeFilter(Number(e.target.value))}
                          className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none"
                        >
                          {[...Array(13)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>Grade {i + 1}</option>
                          ))}
                        </select>
                      </div>

                      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 max-h-64 overflow-y-auto">
                        {subjects.filter(s => s.grade === selectedGradeFilter).length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">No subjects found for Grade {selectedGradeFilter}.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {subjects.filter(s => s.grade === selectedGradeFilter).map(s => {
                              const isAllowed = allowedAccess.some(a => a.grade === s.grade && a.subjectId === s.id);
                              return (
                                <button
                                  type="button"
                                  key={s.id}
                                  onClick={() => toggleSubjectAccess(s.grade, s.id)}
                                  className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                                    isAllowed 
                                      ? 'bg-purple-500/10 border-purple-500/50 text-purple-100' 
                                      : 'bg-slate-800 border-slate-700/50 text-slate-400 hover:border-slate-600'
                                  }`}
                                >
                                  <div>
                                    <span className="block text-sm font-medium">{s.name}</span>
                                    <span className="text-[10px] opacity-70">Grade {s.grade}</span>
                                  </div>
                                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isAllowed ? 'bg-purple-500 border-purple-500 text-white' : 'border-slate-600'}`}>
                                    {isAllowed && <Check size={12} />}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Select the subjects this user is allowed to manage.</p>
                    </div>
                  )}
                </form>
              </div>
              
              <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="user-form"
                  disabled={saveLoading}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {saveLoading ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
