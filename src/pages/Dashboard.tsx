import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Book, MessageSquare, Users, Key, X, Eye, EyeOff, AlertTriangle, Activity, Shield } from 'lucide-react';
import { updatePassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';
import { createLog } from '../utils/logger';

export const Dashboard: React.FC = () => {
  const { logout, user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
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
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Shield size={32} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-white">Quiz CMS</h1>
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded border border-blue-500/20 uppercase tracking-widest">v1.2</span>
                {userProfile?.role && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                    userProfile.role === 'Root' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    userProfile.role === 'Admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}>
                    {userProfile.role} Account
                  </span>
                )}
              </div>
              <p className="text-slate-400">Welcome back, <span className="text-white font-medium">{userProfile?.username || user?.email}</span></p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 hover:bg-slate-700 rounded-xl transition-all text-sm font-medium text-slate-300 hover:text-white"
            >
              <Key size={18} />
              <span>Change Password</span>
            </button>
            <div className="w-px h-6 bg-slate-700"></div>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/10 rounded-xl transition-all text-sm font-medium text-red-400 hover:text-red-300"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Change Password Modal */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-8 relative">
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-4">
                  <Key size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white">Update Password</h2>
                <p className="text-slate-400 text-sm">Secure your account with a new password</p>
              </div>

              {passwordError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                  <AlertTriangle size={18} />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400 text-sm">
                  <Shield size={18} />
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500 pr-12"
                      placeholder="Minimum 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
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
        
        {/* Main Grid */}
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

          <div 
            onClick={() => navigate('/logs')}
            className="bg-slate-800 p-8 rounded-2xl border border-slate-700/50 hover:bg-slate-700 hover:border-orange-500/50 transition-all group cursor-pointer"
          >
            <div className="w-12 h-12 bg-orange-500/10 text-orange-400 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Activity size={24} />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">
              {userProfile?.role === 'Root' ? 'System Logs' : 'Activity Logs'}
            </h2>
            <p className="text-slate-400">
              {userProfile?.role === 'Root' ? 'Track user activity and system audit trails' : 'View your recent activity and session history'}
            </p>
          </div>

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
