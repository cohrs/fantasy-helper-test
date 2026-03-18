'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface League {
  id: number;
  league_key: string;
  league_name: string;
  sport: string;
  season: number;
  is_active: boolean;
}

interface LeagueSelectorProps {
  onLeagueChange?: (sport: string) => void;
}

export default function LeagueSelector({ onLeagueChange }: LeagueSelectorProps) {
  const { data: session } = useSession();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (session) {
      fetchLeagues();
      fetchSelectedLeague();
    }
  }, [session]);

  const fetchLeagues = async () => {
    try {
      const res = await fetch('/api/yahoo/user-leagues');
      const data = await res.json();
      if (data.success) {
        setLeagues(data.leagues);
      }
    } catch (error) {
      console.error('Error fetching leagues:', error);
    }
  };

  const fetchSelectedLeague = async () => {
    try {
      const res = await fetch('/api/yahoo/select-league');
      const data = await res.json();
      if (data.success && data.selectedLeague) {
        setSelectedLeague(data.selectedLeague);
        // Notify parent of sport change
        if (onLeagueChange) {
          onLeagueChange(data.selectedLeague.sport);
        }
      }
    } catch (error) {
      console.error('Error fetching selected league:', error);
    }
  };

  const handleSelectLeague = async (leagueKey: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/yahoo/select-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueKey })
      });
      
      if (res.ok) {
        await fetchSelectedLeague();
        setShowModal(false);
        window.location.reload(); // Reload to update all data
      }
    } catch (error) {
      console.error('Error selecting league:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  const groupedLeagues = leagues.reduce((acc, league) => {
    if (!acc[league.sport]) acc[league.sport] = [];
    acc[league.sport].push(league);
    return acc;
  }, {} as Record<string, League[]>);

  const sportEmoji: Record<string, string> = {
    baseball: '⚾',
    basketball: '🏀',
    hockey: '🏒',
    football: '🏈'
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors flex items-center gap-2"
      >
        {selectedLeague ? (
          <>
            <span>{sportEmoji[selectedLeague.sport] || '🏆'}</span>
            <span className="font-medium">{selectedLeague.league_name}</span>
            <span className="text-zinc-400 text-sm">({selectedLeague.season})</span>
          </>
        ) : (
          <span>Select League</span>
        )}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Select a League</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {leagues.length === 0 ? (
              <p className="text-zinc-400 text-center py-8">
                No leagues found. Make sure you&apos;re connected to Yahoo.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedLeagues).map(([sport, sportLeagues]) => (
                  <div key={sport}>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 capitalize">
                      <span>{sportEmoji[sport] || '🏆'}</span>
                      {sport}
                    </h3>
                    <div className="space-y-2">
                      {sportLeagues.map((league) => (
                        <button
                          key={league.league_key}
                          onClick={() => handleSelectLeague(league.league_key)}
                          disabled={loading}
                          className={`w-full text-left p-4 rounded-lg border transition-colors ${
                            selectedLeague?.league_key === league.league_key
                              ? 'bg-indigo-500/20 border-indigo-500'
                              : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
                          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{league.league_name}</div>
                              <div className="text-sm text-zinc-400 mt-1">
                                {league.season} Season
                                {!league.is_active && ' • Finished'}
                              </div>
                            </div>
                            {selectedLeague?.league_key === league.league_key && (
                              <span className="text-indigo-400">✓</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
