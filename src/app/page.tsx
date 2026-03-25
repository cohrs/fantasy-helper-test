'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Trophy, ArrowRight, RefreshCw, LogIn, LogOut } from 'lucide-react';

interface League {
  id: number;
  league_key: string;
  league_name: string;
  sport: string;
  season: number;
  is_active: boolean;
}

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      fetchLeagues();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const fetchLeagues = async () => {
    try {
      const res = await fetch('/api/leagues');
      const data = await res.json();
      if (data.success) {
        setLeagues(data.leagues);
      }
    } catch (error) {
      console.error('Error fetching leagues:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncFromYahoo = async () => {
    setSyncing(true);
    setSyncError('');
    try {
      const res = await fetch('/api/yahoo/user-leagues');
      const data = await res.json();
      if (data.success) {
        await fetchLeagues();
      } else {
        setSyncError(data.error || 'Failed to sync from Yahoo. Make sure you are logged in.');
      }
    } catch {
      setSyncError('Error connecting to Yahoo. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectLeague = (league: League) => {
    localStorage.setItem('selectedLeague', JSON.stringify(league));
    router.push('/draft-room');
  };

  const sportEmoji: Record<string, string> = {
    baseball: '⚾', basketball: '🏀', hockey: '🏒', football: '🏈'
  };

  const groupedLeagues = leagues
    // Deduplicate by league_key — keep the first (lowest ID) entry
    .filter((league, idx, arr) => arr.findIndex(l => l.league_key === league.league_key) === idx)
    .reduce((acc, league) => {
      if (!acc[league.sport]) acc[league.sport] = [];
      acc[league.sport].push(league);
      return acc;
    }, {} as Record<string, League[]>);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <Trophy className="text-indigo-400" size={28} />
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Asshat<span className="text-indigo-400">Fantasy</span>
          </span>
        </div>
        {session && (
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{session.user?.name || session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-400 hover:text-red-400 bg-zinc-900 border border-zinc-800 hover:border-red-500/30 rounded-full transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-br from-white via-slate-200 to-indigo-400">
            Asshat Fantasy 2026
          </h1>
          <p className="text-lg text-slate-400 mb-8">
            Connect to Yahoo and pick your league to get started.
          </p>
        </div>

        {/* Not logged in */}
        {status === 'unauthenticated' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
            <LogIn className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-3">Connect Your Yahoo Account</h2>
            <p className="text-slate-400 mb-6">Sign in with Yahoo to access your fantasy leagues.</p>
            <button
              onClick={() => signIn('yahoo')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full transition-all shadow-[0_0_30px_-5px_rgba(79,70,229,0.5)] hover:shadow-[0_0_40px_-5px_rgba(79,70,229,0.7)] hover:-translate-y-1"
            >
              Sign in with Yahoo <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* Loading */}
        {status === 'authenticated' && loading && (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
            <p className="text-slate-400">Loading leagues...</p>
          </div>
        )}

        {/* Logged in — show leagues */}
        {status === 'authenticated' && !loading && (
          <>
            <div className="text-center mb-8">
              <button
                onClick={syncFromYahoo}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-full text-sm transition-all"
              >
                <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing from Yahoo...' : 'Sync Leagues from Yahoo'}
              </button>
              {syncError && <p className="text-red-400 text-sm mt-3">{syncError}</p>}
            </div>

            {leagues.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
                <p className="text-slate-400 mb-4">No leagues found.</p>
                <p className="text-sm text-slate-500">Hit &quot;Sync Leagues from Yahoo&quot; to pull in your leagues.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedLeagues).map(([sport, sportLeagues]) => (
                  <div key={sport}>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 capitalize">
                      <span className="text-4xl">{sportEmoji[sport] || '🏆'}</span>
                      {sport}
                    </h2>
                    <div className="grid gap-4">
                      {sportLeagues.map((league) => (
                        <button
                          key={league.id}
                          onClick={() => handleSelectLeague(league)}
                          className="w-full text-left p-6 rounded-2xl border transition-all bg-zinc-900/50 border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900 group"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                                  {league.league_name}
                                </h3>
                                {league.is_active && (
                                  <span className="text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full uppercase">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-400">{league.season} Season</div>
                            </div>
                            <ArrowRight className="w-6 h-6 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-white/5 mt-12 py-8 text-center text-slate-500 text-sm">
        <p>&copy; 2026 Asshat Fantasy League. All rights reversed.</p>
      </footer>
    </div>
  );
}
