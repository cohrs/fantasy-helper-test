'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, ArrowRight, RefreshCw } from 'lucide-react';

interface League {
  id: number;
  league_key: string;
  league_name: string;
  sport: string;
  season: number;
  is_active: boolean;
}

export default function SelectLeague() {
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    fetchLeagues();
  }, []);

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
        // Leagues are now saved to DB, re-fetch from DB
        await fetchLeagues();
      } else {
        setSyncError(data.error || 'Failed to sync from Yahoo. Make sure you are logged in.');
      }
    } catch (error) {
      setSyncError('Error connecting to Yahoo. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectLeague = async (league: League) => {
    // Store in localStorage
    localStorage.setItem('selectedLeague', JSON.stringify(league));
    
    // Navigate to draft room
    router.push('/league');
  };

  const sportEmoji: Record<string, string> = {
    baseball: '⚾',
    basketball: '🏀',
    hockey: '🏒',
    football: '🏈'
  };

  const sportColor: Record<string, string> = {
    baseball: 'indigo',
    basketball: 'orange',
    hockey: 'blue',
    football: 'green'
  };

  const groupedLeagues = leagues.reduce((acc, league) => {
    if (!acc[league.sport]) acc[league.sport] = [];
    acc[league.sport].push(league);
    return acc;
  }, {} as Record<string, League[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading leagues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <Trophy className="text-indigo-400" size={28} />
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Fantasy<span className="text-indigo-400">Assistant</span>
          </span>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-semibold rounded-full text-sm transition-all"
        >
          Back to Home
        </button>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-br from-white via-slate-200 to-indigo-400">
            Select Your League
          </h1>
          <p className="text-lg text-slate-400 mb-6">
            Choose a league to manage your team
          </p>
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
            <p className="text-slate-400 mb-4">No leagues found in database.</p>
            <p className="text-sm text-slate-500">
              Connect to Yahoo and sync your leagues to get started.
            </p>
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
                  {sportLeagues.map((league) => {
                    const color = sportColor[sport] || 'indigo';
                    return (
                      <button
                        key={league.id}
                        onClick={() => handleSelectLeague(league)}
                        className={`w-full text-left p-6 rounded-2xl border transition-all bg-zinc-900/50 border-zinc-800 hover:border-${color}-500/50 hover:bg-zinc-900 group`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-white group-hover:text-${color}-400 transition-colors">
                                {league.league_name}
                              </h3>
                              {league.is_active && (
                                <span className="text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full uppercase">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-400">
                              {league.season} Season
                            </div>
                          </div>
                          <ArrowRight className={`w-6 h-6 text-slate-600 group-hover:text-${color}-400 group-hover:translate-x-1 transition-all`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
