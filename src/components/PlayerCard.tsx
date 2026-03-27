'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Activity, ChevronUp, ChevronDown } from 'lucide-react';

interface PlayerCardProps {
  player: {
    name: string;
    pos: string;
    team?: string;
    rank?: number;
    adp?: number;
    yahooRank?: number;
    yahooStatus?: string;
    isKeeper?: boolean;
    isTaken?: boolean;
    yahooStatsPairs?: Array<{ id: string; label: string; val: string }>;
    rationale?: string;
  };
  slot?: string;
  yahooStats?: Record<string, string>;
  activeSport: string;
  leagueKey?: string;
  onAskAssistant?: (prompt: string) => void;
  showControls?: boolean;
  controls?: React.ReactNode;
  context?: 'watchlist' | 'team' | 'pool';
  // Roster editing props
  editable?: boolean;
  playerKey?: string;
  teamKey?: string;
  eligiblePositions?: string;
  onPositionChange?: (playerKey: string, newPosition: string) => void;
}

export function PlayerCard({ 
  player, 
  slot,
  yahooStats,
  activeSport, 
  leagueKey,
  onAskAssistant,
  showControls = false,
  controls,
  context = 'pool',
  editable = false,
  playerKey,
  teamKey,
  eligiblePositions,
  onPositionChange,
}: PlayerCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [yahooNews, setYahooNews] = useState<any>(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const [playerNotes, setPlayerNotes] = useState<string | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [showPosMenu, setShowPosMenu] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  // Fetch player notes from database when card is opened
  useEffect(() => {
    if (showNotes && leagueKey && !playerNotes && !player.rationale) {
      fetchPlayerNotes();
    }
  }, [showNotes, leagueKey]);

  const fetchPlayerNotes = async () => {
    setLoadingNotes(true);
    try {
      const response = await fetch(`/api/assistant/notes?leagueKey=${leagueKey}&playerName=${encodeURIComponent(player.name)}`);
      const data = await response.json();
      if (data.notes) {
        setPlayerNotes(data.notes);
      }
    } catch (error) {
      console.error('Failed to fetch player notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Generate default prompt based on context
  const getDefaultPrompt = () => {
    if (context === 'team') {
      return `${player.name} is on my team. Analyze their recent performance and outlook. Should I keep them or consider trading?`;
    } else if (context === 'watchlist') {
      return `I'm watching ${player.name}. Should I draft them? How do they fit my roster needs?`;
    } else {
      return `Analyze ${player.name} for my fantasy team. Give me a short rationale on why they fit or don't fit based on my current roster needs.`;
    }
  };

  const handleAskAI = () => {
    const basePrompt = getDefaultPrompt();
    const finalPrompt = customPrompt.trim() 
      ? `${basePrompt}\n\nAdditional context: ${customPrompt.trim()}`
      : basePrompt;
    setShowConfirm(false);
    onAskAssistant?.(finalPrompt);
    setShowNotes(true);
    setCustomPrompt(''); // Reset after sending
  };

  const handleFetchYahooNews = async () => {
    setLoadingNews(true);
    try {
      const url = leagueKey 
        ? `/api/yahoo/player-news?name=${encodeURIComponent(player.name)}&leagueKey=${leagueKey}`
        : `/api/yahoo/player-news?name=${encodeURIComponent(player.name)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setYahooNews(data.player);
      } else {
        setYahooNews({ error: data.error || 'Failed to fetch news' });
      }
    } catch (error) {
      setYahooNews({ error: 'Network error' });
    } finally {
      setLoadingNews(false);
    }
  };

  // Build list of positions this player can be moved to
  const getAvailablePositions = () => {
    if (!eligiblePositions) return [];
    const eligible = eligiblePositions.split(',').map(p => p.trim()).filter(Boolean);
    // Always include BN and IL slots
    const extras = ['BN', 'IL', 'IL+', 'IL60', 'NA'];
    const all = [...new Set([...eligible, ...extras])];
    // Filter out current slot
    return all.filter(p => p !== slot);
  };

  const handlePositionChange = async (newPos: string) => {
    if (!playerKey || !onPositionChange) return;
    setIsMoving(true);
    setShowPosMenu(false);
    try {
      await onPositionChange(playerKey, newPos);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className={`bg-slate-950 rounded-xl border ${player.isTaken ? 'border-slate-800/30 opacity-50' : 'border-slate-800/50 hover:border-slate-700/50'} group transition-all relative overflow-hidden`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${activeSport === 'baseball' ? 'bg-indigo-600' : 'bg-orange-600'} ${player.isTaken ? 'bg-slate-700' : ''}`} />

      <div className="flex justify-between items-center p-2 pl-3">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
          
          {/* Roster Slot Badge (Team View) — clickable when editable */}
          {slot && (
            <div className="relative">
              <button
                onClick={(e) => {
                  if (!editable || isMoving) return;
                  e.stopPropagation();
                  setShowPosMenu(v => !v);
                }}
                disabled={!editable || isMoving}
                className={`w-8 flex-col items-center justify-center font-black text-[10px] leading-none text-center rounded py-1 shrink-0 flex transition-all ${
                  isMoving ? 'animate-pulse bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  slot === 'BN' ? 'bg-slate-800/50 text-slate-500' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                } ${editable && !isMoving ? 'cursor-pointer hover:bg-indigo-500/20 hover:border-indigo-400/40' : isMoving ? 'cursor-wait' : 'cursor-default'}`}
              >
                {isMoving ? '...' : slot}
              </button>
              {showPosMenu && editable && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[60px]">
                  {getAvailablePositions().map(pos => (
                    <button
                      key={pos}
                      onClick={(e) => { e.stopPropagation(); handlePositionChange(pos); }}
                      className="block w-full text-left px-3 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rank/ADP */}
          {!slot && (
            <div className="w-6 flex-col items-center justify-center font-black text-[8px] leading-none text-indigo-400 tabular-nums hidden sm:flex shrink-0">
              <div className="text-[6px] text-slate-600 mb-0.5">{player.yahooRank ? 'AR' : 'ADP'}</div>
              <div>{player.yahooRank || player.adp || player.rank || '-'}</div>
            </div>
          )}

          {/* Main Player Info */}
          <div
            className="flex-1 min-w-0 flex items-center flex-wrap gap-x-2 gap-y-1 cursor-pointer select-none group"
            onClick={() => setShowNotes(v => !v)}
          >
            {/* Name & Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs font-black truncate max-w-[160px] sm:max-w-[120px] md:max-w-[200px] ${player.isTaken ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                {player.name}
              </span>
              {player.yahooStatus && <span className="text-[7px] font-black bg-red-500/20 text-red-400 px-1 py-0.5 rounded uppercase leading-none">{player.yahooStatus}</span>}
              {player.isKeeper && <span className="text-[7px] font-black bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded uppercase leading-none">K</span>}
            </div>

            {/* Pos & Team */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[8px] font-bold text-slate-500 uppercase">{player.pos}</span>
              <span className="text-[7px] text-slate-700">•</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase">{player.team || 'FA'}</span>
            </div>

            {/* Stats */}
            {(player.yahooStatsPairs && player.yahooStatsPairs.length > 0 && !player.isTaken) ? (
              <div className="flex gap-1 ml-1 items-center flex-wrap">
                <div className="w-px h-3 bg-slate-800/50 hidden md:block mx-1" />
                {player.yahooStatsPairs.slice(0, 4).map((s: any) => (
                  <span key={s.id} className="text-[8px] font-bold text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-1 py-[1px] rounded whitespace-nowrap">
                    <span className="opacity-60 font-normal mr-0.5">{s.label}</span>{s.val}
                  </span>
                ))}
                {player.yahooStatsPairs.length > 4 && <span className="text-[8px] text-slate-500">+{player.yahooStatsPairs.length - 4}</span>}
              </div>
            ) : (yahooStats && Object.keys(yahooStats).length > 0) ? (
              <div className="flex gap-1 ml-1 items-center flex-wrap">
                <div className="w-px h-3 bg-slate-800/50 hidden md:block mx-1" />
                {Object.entries(yahooStats).slice(0, 5).map(([id, val]) => (
                  <span key={id} className="text-[8px] font-bold text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-1 py-[1px] rounded whitespace-nowrap">
                    <span className="opacity-60 font-normal mr-0.5">{id}</span>{val}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Notes Toggle */}
            <div className={`ml-1 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors ${showNotes ? 'bg-sky-500/20 text-sky-400' : 'text-sky-500/50 group-hover:text-sky-400 group-hover:bg-sky-500/10'}`}>
              <Sparkles className="w-2.5 h-2.5" />
              {showNotes ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </div>
          </div>
        </div>

        {/* Controls */}
        {showControls && controls && (
          <div className="flex items-center gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0">
            {controls}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && onAskAssistant && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="bg-slate-900 border border-sky-500/30 rounded-xl p-4 max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 text-sky-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              Request AI Analysis
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Default prompt: <span className="text-slate-300 italic">"{getDefaultPrompt()}"</span>
              <br />
              Add any additional context or questions below.
            </p>
            
            {/* Custom Prompt Input */}
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add additional context or questions (optional)..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 mb-3 resize-none"
              rows={3}
            />
            
            <div className="flex gap-2">
              <button
                onClick={handleAskAI}
                className="flex-1 px-3 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-lg text-xs font-bold transition-all"
              >
                Send to AI
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                  setCustomPrompt('');
                }}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Notes Section */}
      {showNotes && (
        <div className="px-4 pb-4 border-t border-slate-800/50">
          <div className="mt-3 flex flex-col gap-3">
            {/* AI Rationale */}
            {(player.rationale || playerNotes) ? (
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sky-400 font-black text-[9px] uppercase tracking-widest">
                    <Sparkles className="w-3 h-3" /> AI Rationale
                  </div>
                  {onAskAssistant && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirm(true);
                      }}
                      className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all"
                    >
                      Refresh
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {player.rationale || playerNotes}
                </p>
              </div>
            ) : loadingNotes ? (
              <div className="bg-slate-800/20 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Loading notes...
                </div>
              </div>
            ) : onAskAssistant ? (
              <div className="bg-slate-800/20 border border-dashed border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <Sparkles className="w-3 h-3 text-sky-500/50" /> No AI Insights Yet
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mb-3">
                  Request an AI analysis to get personalized insights for {player.name}.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConfirm(true);
                  }}
                  className="w-full px-3 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3 h-3" /> Request AI Analysis
                </button>
              </div>
            ) : null}
            
            {/* Yahoo News */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-black text-[9px] uppercase tracking-widest">
                  <Activity className="w-3 h-3" /> Yahoo News
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFetchYahooNews();
                  }}
                  disabled={loadingNews}
                  className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {loadingNews ? 'Loading...' : yahooNews ? 'Refresh' : 'Fetch News'}
                </button>
              </div>
              
              {!yahooNews && !loadingNews && (
                <p className="text-[10px] text-slate-500">
                  Click "Fetch News" to get the latest injury updates and news from Yahoo.
                </p>
              )}
              
              {yahooNews?.error && (
                <p className="text-[10px] text-red-400">
                  {yahooNews.error}
                </p>
              )}
              
              {yahooNews && !yahooNews.error && (
                <div className="space-y-2">
                  {yahooNews.status && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Status:</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        yahooNews.status === 'Healthy' ? 'bg-green-500/20 text-green-400' :
                        yahooNews.status.includes('IL') ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {yahooNews.status}
                      </span>
                    </div>
                  )}
                  
                  {yahooNews.statusFull && (
                    <p className="text-[10px] text-slate-400 italic">
                      {yahooNews.statusFull}
                    </p>
                  )}
                  
                  {yahooNews.notes && yahooNews.notes.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {yahooNews.notes.map((note: any, idx: number) => (
                        <div key={idx} className="border-l-2 border-emerald-500/30 pl-2">
                          {note.title && (
                            <div className="text-[9px] font-bold text-emerald-400 mb-1">
                              {note.title}
                            </div>
                          )}
                          {note.summary && (
                            <p className="text-[10px] text-slate-300 leading-relaxed">
                              {note.summary}
                            </p>
                          )}
                          {note.timestamp && (
                            <div className="text-[8px] text-slate-600 mt-1">
                              {new Date(note.timestamp * 1000).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 italic">
                      No recent news available
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
