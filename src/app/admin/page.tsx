'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Shield, Ban, UserCheck, MessageSquare, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';

interface User {
  id: number;
  email: string;
  nickname: string;
  yahoo_guid: string;
  role: string;
  is_blocked: boolean;
  created_at: string;
  chat_count: number;
  league_count: number;
}

interface Chat {
  id: number;
  league_key: string;
  prompt: string;
  raw_response: string;
  created_at: string;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch {
      setError('Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, userId: number, value?: string) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId, value }),
    });
    const data = await res.json();
    if (data.success) {
      fetchUsers();
    } else {
      alert(data.error || 'Action failed');
    }
  };

  const loadChats = async (userId: number) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    setLoadingChats(true);
    try {
      const res = await fetch(`/api/admin/chats?userId=${userId}`);
      const data = await res.json();
      setChats(data.success ? data.chats : []);
    } catch {
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  if (loading) {
    return (
      <div className="h-dvh bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-500 font-bold">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-dvh bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 font-bold text-lg mb-2">Access Denied</div>
          <div className="text-slate-500 text-sm">{error}</div>
          <Link href="/" className="text-indigo-400 text-sm mt-4 inline-block hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div className="p-3 rounded-2xl bg-red-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">Admin Panel</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">{users.length} registered users</p>
          </div>
        </div>

        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className={`bg-slate-900 rounded-2xl border ${user.is_blocked ? 'border-red-500/30' : 'border-slate-800'} overflow-hidden`}>
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{user.nickname || user.email || 'Unknown'}</span>
                    {user.role === 'admin' && (
                      <span className="text-[8px] font-black bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase">admin</span>
                    )}
                    {user.is_blocked && (
                      <span className="text-[8px] font-black bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded uppercase">blocked</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {user.email} · ID: {user.id} · {user.league_count} leagues · {user.chat_count} chats · Joined {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => loadChats(user.id)}
                    className="p-2 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 transition-colors cursor-pointer"
                    title="View chats"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {user.is_blocked ? (
                    <button
                      onClick={() => handleAction('unblock', user.id)}
                      className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
                      title="Unblock"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('block', user.id)}
                      className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                      title="Block"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <select
                    value={user.role}
                    onChange={(e) => handleAction('setRole', user.id, e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold rounded-lg px-2 py-1.5 cursor-pointer"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>

                  <button onClick={() => loadChats(user.id)} className="text-slate-600 hover:text-slate-400 cursor-pointer">
                    {expandedUser === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedUser === user.id && (
                <div className="border-t border-slate-800 p-4 bg-slate-950/50">
                  <div className="text-[10px] font-black uppercase tracking-widest text-sky-400 mb-3">
                    Chat History ({chats.length})
                  </div>
                  {loadingChats ? (
                    <div className="text-slate-500 text-xs">Loading...</div>
                  ) : chats.length === 0 ? (
                    <div className="text-slate-600 text-xs italic">No chats yet</div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {chats.map(chat => (
                        <div key={chat.id} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[8px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{chat.league_key}</span>
                            <span className="text-[8px] text-slate-600">{new Date(chat.created_at).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-indigo-300 font-bold mb-1">{chat.prompt}</div>
                          <div className="text-[11px] text-slate-400 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                            {chat.raw_response?.substring(0, 500)}{chat.raw_response?.length > 500 ? '...' : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
