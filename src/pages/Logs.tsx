import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Clock, User, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createLog } from '../utils/logger';

interface LogEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  timestamp: Timestamp;
}

export const Logs: React.FC = () => {
  const { userProfile } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<{id: string, username: string}[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username || doc.data().email
        }));
        setUsers(usersList);
      } catch (err) {
        console.error('Error fetching users for filter:', err);
      }
    };

    if (userProfile?.role?.toLowerCase() === 'root') {
      fetchUsers();
    }
  }, [userProfile]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        let q;
        const isRoot = userProfile?.role?.toLowerCase() === 'root';
        if (isRoot) {
          if (selectedUserId === 'all') {
            q = query(
              collection(db, 'logs'),
              orderBy('timestamp', 'desc'),
              limit(100)
            );
          } else {
            q = query(
              collection(db, 'logs'),
              where('userId', '==', selectedUserId),
              orderBy('timestamp', 'desc'),
              limit(100)
            );
          }
        } else {
          q = query(
            collection(db, 'logs'),
            where('userId', '==', userProfile?.id),
            orderBy('timestamp', 'desc'),
            limit(100)
          );
        }
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LogEntry[];
        setLogs(data);
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };

    const initializeLogs = async () => {
      if (userProfile) {
        await createLog(userProfile.id, userProfile.username || userProfile.email, 'VIEW_LOGS', `Accessed the logs audit trail`);
        await fetchLogs();
      }
    };

    initializeLogs();
  }, [userProfile, selectedUserId]);

  if (!userProfile) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white italic">Loading Profile Permissions...</div>;
  }

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'text-emerald-400 bg-emerald-400/10';
    if (action.includes('DELETE')) return 'text-red-400 bg-red-400/10';
    if (action.includes('UPDATE')) return 'text-blue-400 bg-blue-400/10';
    if (action === 'LOGIN') return 'text-indigo-400 bg-indigo-400/10';
    if (action === 'LOGOUT') return 'text-slate-400 bg-slate-400/10';
    return 'text-slate-400 bg-slate-400/10';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {userProfile.role?.toLowerCase() === 'root' ? 'System Logs' : 'My Activity Logs'}
              </h1>
              <p className="text-sm text-slate-400">
                {userProfile.role?.toLowerCase() === 'root' 
                  ? 'Recent user activity and administrative changes' 
                  : 'Your recent actions and session history'}
              </p>
            </div>
          </div>

          {userProfile.role?.toLowerCase() === 'root' && (
            <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-xl border border-slate-700">
              <span className="text-sm text-slate-400 pl-2">Filter User:</span>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none min-w-[200px]"
              >
                <option value="all">All Users Activity</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Timestamp</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">User</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Action</th>
                  <th className="px-6 py-4 text-sm font-medium text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic">
                      No activity records found {selectedUserId !== 'all' ? 'for this user' : ''}.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
                          <Clock size={14} className="text-slate-500" />
                          {log.timestamp?.toDate().toLocaleString() || 'Recent'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                            <User size={14} />
                          </div>
                          <span className="text-sm font-medium text-white">{log.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          {log.details}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-900/30 border-t border-slate-700 text-center">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
              <FileText size={12} />
              {userProfile.role === 'Root' 
                ? (selectedUserId === 'all' ? 'Showing last 100 system-wide entries.' : `Showing last 100 entries for selected user.`)
                : 'Showing your last 100 entries.'} Logs are permanently recorded in Firestore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
