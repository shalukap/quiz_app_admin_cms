import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Book, MessageSquare, Users, Key, X, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { updatePassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { logout, user, userProfile } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setIsPasswordModalOpen(false);
          setPasswordSuccess(false);
        }, 2000);
      }
    } catch (err: any) {
      console.error('Password change error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setPasswordError('For security, you must log out and log back in before changing your password.');
      } else {
        setPasswordError(err.message || 'Failed to update password');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12 bg-slate-800 p-6 rounded-2xl border border-slate-700/50">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              Quiz Content Manager
              <span className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">v1.2</span>
              {userProfile?.role && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter border-2 ${
                  userProfile.role === 'Root' ? 'bg-purple-600 text-white border-purple-400' :
                  userProfile.role === 'Admin' ? 'bg-blue-600 text-white border-blue-400' :
                  'bg-slate-600 text-white border-slate-500'
                }`}>
                  {userProfile.role} ACCOUNT
                </span>
              )}
            </h1>
            <div className="flex items-center gap-3">
              <p className="text-slate-400">Logged in as {user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium"
            >
              <Key size={16} />
              Change Password
            </button>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>

        {/* Change Password Modal */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Key className="text-blue-400" />
                  Change Password
                </h2>
                <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              {passwordError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                  <AlertTriangle className="shrink-0" size={18} />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                  Password updated successfully!
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Confirm New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                    placeholder="Confirm new password"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        <div className={`grid grid-cols-1 md:grid-cols-2 ${userProfile?.role === 'Root' ? 'lg:grid-cols-3' : ''} gap-6`}>
          <Link to="/subjects" className="bg-slate-800 p-8 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:border-blue-500/50 transition-all group">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Book size={24} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Subjects</h2>
            <p className="text-slate-400">Manage quiz categories, icons, and themes</p>
          </Link>
          <Link to="/questions" className="bg-slate-800 p-8 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:border-emerald-500/50 transition-all group">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <MessageSquare size={24} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">Questions</h2>
            <p className="text-slate-400">Manage question banks and answers by grade</p>
          </Link>
          {userProfile?.role === 'Root' && (
            <Link to="/users" className="bg-slate-800 p-8 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users size={24} />
              </div>
              <h2 className="text-xl font-semibold mb-2 text-white">Users</h2>
              <p className="text-slate-400">Manage CMS users, roles, and access controls</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
