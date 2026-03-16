import { useAuth } from '../context/AuthContext';
import { LogOut, Book, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12 bg-slate-800 p-6 rounded-2xl border border-slate-700/50">
          <div>
            <h1 className="text-2xl font-bold text-white">Quiz Content Manager</h1>
            <p className="text-slate-400">Logged in as {user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      </div>
    </div>
  );
};
