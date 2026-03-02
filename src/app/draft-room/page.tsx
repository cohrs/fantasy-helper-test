"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search, Trophy, Circle, UserPlus, Users, Trash2,
  ChevronRight, Activity, LayoutGrid, Link as LinkIcon,
  RefreshCw, ClipboardList, Clock, ShieldCheck, Zap, BarChart3,
  Plug, Sparkles, ChevronUp, ChevronDown, Eye, EyeOff, ListOrdered,
  Play, Maximize2, Minimize2, CheckCircle2, MessageSquare, Send, X
} from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';

// Utility function to normalize player names for consistent lookups
function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+(jr|sr|ii|iii)$/, '')
    .trim()
    .replace(/\s+/g, '');
}

// Isolated component to prevent typing lag — exposes value via ref, no parent state on each keystroke
const AssistantInput = React.forwardRef<{ getValue: () => string }, {
  onSubmit?: (val: string) => void;
  isAskingAssistant: boolean;
  placeholder?: string;
}>(({ onSubmit, isAskingAssistant, placeholder = "e.g., Find me a young SP with upside..." }, ref) => {
  const [localVal, setLocalVal] = useState("");

  React.useImperativeHandle(ref, () => ({
    getValue: () => localVal,
  }));

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={localVal}
      onChange={(e) => setLocalVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isAskingAssistant) {
          onSubmit?.(localVal);
        }
      }}
      className="w-full bg-slate-950 border border-slate-700/50 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/50 placeholder:text-slate-600 transition-all text-slate-200"
    />
  );
});
AssistantInput.displayName = 'AssistantInput';


const WatchlistItem = ({
  player, activeSport, isTaken, isFirst, isLast, onMoveUp, onMoveDown, onDelete,
  index, draggedIndex, dragOverIndex, onDragStart, onDragOver, onDragEnd, onDrop, onAskAssistant
}: {
  player: any; activeSport: string; isTaken: boolean; isFirst: boolean; isLast: boolean;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
  index: number; draggedIndex: number | null; dragOverIndex: number | null;
  onDragStart: (idx: number) => void; onDragOver: (idx: number) => void; onDragEnd: () => void; onDrop: (idx: number) => void;
  onAskAssistant?: (prompt: string) => void;
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [yahooNews, setYahooNews] = useState<any>(null);
  const [loadingNews, setLoadingNews] = useState(false);

  // Visual feedback logic
  let borderOverride = '';
  if (dragOverIndex === index && draggedIndex !== index) {
    if (draggedIndex! > index) borderOverride = 'border-t-2 border-t-indigo-500';
    else borderOverride = 'border-b-2 border-b-indigo-500';
  }

  const handleAskAI = () => {
    setShowConfirm(false);
    onAskAssistant?.(`Analyze ${player.name} for my fantasy team. Give me a short rationale on why they fit or don't fit based on my current roster needs.`);
    setShowNotes(true);
  };

  const handleFetchYahooNews = async () => {
    setLoadingNews(true);
    try {
      const response = await fetch(`/api/yahoo/player-news?name=${encodeURIComponent(player.name)}`);
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

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      onDragEnd={onDragEnd}
      className={`bg-slate-950 rounded-xl border ${isTaken ? 'border-slate-800/30 opacity-50' : 'border-slate-800/50 hover:border-slate-700/50'} ${draggedIndex === index ? 'opacity-30' : ''} ${borderOverride} group transition-all relative overflow-hidden`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${activeSport === 'MLB' ? 'bg-indigo-600' : 'bg-orange-600'} ${isTaken ? 'bg-slate-700' : ''}`} />

      <div className="flex justify-between items-center p-2 pl-3">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">

          {/* Rank/ADP Stacked Tiny */}
          <div className="w-6 flex-col items-center justify-center font-black text-[8px] leading-none text-indigo-400 tabular-nums hidden sm:flex shrink-0">
            <div className="text-[6px] text-slate-600 mb-0.5">{player.yahooRank ? 'AR' : 'ADP'}</div>
            <div>{player.yahooRank || player.adp || player.rank || '-'}</div>
          </div>

          {/* Main Player Info Row - Clicking toggles notes view only */}
          <div
            className="flex-1 min-w-0 flex items-center flex-wrap gap-x-2 gap-y-1 cursor-pointer select-none group"
            onClick={() => setShowNotes(v => !v)}
          >

            {/* Name & Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs font-black truncate max-w-[120px] ${isTaken ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                {player.name}
              </span>
              {player.yahooStatus && <span className="text-[7px] font-black bg-red-500/20 text-red-400 px-1 py-0.5 rounded uppercase leading-none">{player.yahooStatus}</span>}
              {player.isKeeper && <span className="text-[7px] font-black bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded uppercase leading-none">K</span>}
            </div>

            {/* Pos & Team */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[8px] font-bold text-slate-500 uppercase">{player.pos}</span>
              <span className="text-[7px] text-slate-700">•</span>
              <span className="text-[8px] font-bold text-slate-600 uppercase">{player.team}</span>
            </div>

            {/* Compact Stats Row */}
            {player.yahooStatsPairs && player.yahooStatsPairs.length > 0 && !isTaken && (
              <div className="flex gap-1 ml-1 items-center flex-wrap">
                <div className="w-px h-3 bg-slate-800/50 hidden md:block mx-1" />
                {player.yahooStatsPairs.slice(0, 4).map((s: any) => (
                  <span key={s.id} className="text-[8px] font-bold text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 px-1 py-[1px] rounded whitespace-nowrap">
                    <span className="opacity-60 font-normal mr-0.5">{s.label}</span>{s.val}
                  </span>
                ))}
                {player.yahooStatsPairs.length > 4 && <span className="text-[8px] text-slate-500">+{player.yahooStatsPairs.length - 4}</span>}
              </div>
            )}

            {/* Notes Toggle Indicator */}
            <div
              className={`ml-1 text-[8px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors ${showNotes ? 'bg-sky-500/20 text-sky-400' : 'text-sky-500/50 group-hover:text-sky-400 group-hover:bg-sky-500/10'}`}
            >
              <Sparkles className="w-2.5 h-2.5" />
              {showNotes ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </div>

          </div>
        </div>

        {/* Controls - Always visible but muted until hover to save space */}
        <div className="flex items-center gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0">
          <button disabled={isFirst} onClick={onMoveUp} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white disabled:opacity-20 transition-all">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button disabled={isLast} onClick={onMoveDown} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white disabled:opacity-20 transition-all">
            <ChevronDown className="w-3 h-3" />
          </button>
          <div className="w-px h-3 bg-slate-800 mx-0.5" />
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all">
            <Trash2 className="w-3 h-3" />
          </button>
          <div className="w-px h-3 bg-slate-800 mx-0.5" />
          <button
            title="Ask AI to analyze this player"
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirm(true);
            }}
            className="p-1 rounded hover:bg-sky-500/20 text-slate-500 hover:text-sky-400 transition-all"
          >
            <Sparkles className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for AI Request */}
      {showConfirm && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="bg-slate-900 border border-sky-500/30 rounded-xl p-4 max-w-xs mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 text-sky-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              Request AI Analysis?
            </div>
            <p className="text-xs text-slate-400 mb-4">
              This will use your Gemini API quota to analyze <span className="text-white font-bold">{player.name}</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAskAI}
                className="flex-1 px-3 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-lg text-xs font-bold transition-all"
              >
                Confirm
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline AI rationale / Yahoo Notes — expands below, no clipping */}
      {showNotes && (
        <div className="px-4 pb-4 border-t border-slate-800/50">
          <div className="mt-3 flex flex-col gap-3">
            {player.rationale ? (
              <>
                <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-sky-400 font-black text-[9px] uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" /> AI Rationale
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirm(true);
                      }}
                      className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all"
                    >
                      Refresh
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {!player.rationale.startsWith('[') ? `[Legacy Insight] ${player.rationale}` : player.rationale}
                  </p>
                </div>
              </>
            ) : (
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
            )}
            
            {/* Yahoo News Section */}
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
                  
                  {yahooNews.playerOutlook && (
                    <div className="mt-2 p-2 bg-slate-800/30 rounded border border-emerald-500/10">
                      <div className="text-[9px] font-bold text-emerald-400 mb-1 uppercase tracking-wider">
                        2026 Player Outlook
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        {yahooNews.playerOutlook}
                      </p>
                    </div>
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
            
            {player.yahooRecentNote && (
              <div className="bg-slate-800/20 border-l-2 border-sky-500/30 pl-3 py-2 italic rounded-r-xl">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Latest News</div>
                <p className="text-[11px] text-slate-300 leading-snug">{player.yahooRecentNote}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


/**
 * SCOUTMASTER 2026
 * Functional Prototype for 18-Team Fantasy Leagues
 * Includes: MLB Draft Tracker & NBA Standings Scaffold
 */

const DraftBoardPlayerRow = React.memo(({ p, yahooStats, yahooPlayers, updateWatchlist, activeSport, myRoster, BATTING_STAT_IDS, PITCHING_STAT_IDS, YAHOO_STAT_LABELS, onAskAssistant }: any) => {
  const isPitcher = /SP|RP|P/i.test(p.pos);
  const ids = isPitcher ? PITCHING_STAT_IDS : BATTING_STAT_IDS;
  const [showNotes, setShowNotes] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [yahooNews, setYahooNews] = useState<any>(null);
  const [loadingNews, setLoadingNews] = useState(false);
  const isInWatchlist = myRoster.some((r: any) => r.name === p.name);

  const handleAskAI = () => {
    setShowConfirm(false);
    onAskAssistant?.(`Analyze ${p.name} for my fantasy team. Give me a short rationale on why they fit or don't fit based on my current roster needs.`);
    setShowNotes(true);
  };

  const handleFetchYahooNews = async () => {
    setLoadingNews(true);
    try {
      const response = await fetch(`/api/yahoo/player-news?name=${encodeURIComponent(p.name)}`);
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

  return (
    <div className={`px-4 py-3 rounded-2xl flex justify-between items-start transition-all relative ${p.takenBy ? 'bg-slate-900/30 border border-slate-800/20 opacity-50' : 'bg-slate-950 border border-slate-800/50 hover:border-indigo-500/40'}`}>
      <div
        className="flex items-start gap-4 flex-1 min-w-0 cursor-pointer select-none group"
        onClick={() => setShowNotes(v => !v)}
      >
        <div className="w-10 text-center font-black text-[9px] leading-tight text-indigo-400 tabular-nums shrink-0 mt-1">
          {yahooPlayers.length > 0 ? (
            <>
              <div className="text-[7px] text-slate-600">{p.yahooRank ? 'AR' : 'ADP'}</div>
              <div>{p.yahooRank || p.adp}</div>
            </>
          ) : (
            <>
              <div className="text-[7px] text-slate-600">ADP</div>
              <div>{p.adp}</div>
            </>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-sm ${p.takenBy ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{p.name}</span>
            {p.yahooStatus && <span className="text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full uppercase">{p.yahooStatus}</span>}
            {p.isKeeper && <span className="text-[9px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full uppercase">K</span>}
            {p.yahooHasNotes && !p.takenBy && <span title="Has player news" className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />}
            {isInWatchlist && <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded-full uppercase flex items-center gap-1"><Eye className="w-3 h-3" /> Watched</span>}

            {/* Notes Toggle Indicator */}
            <div className={`ml-auto text-[8px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors ${showNotes ? 'bg-sky-500/20 text-sky-400' : 'text-sky-500/50 group-hover:text-sky-400 group-hover:bg-sky-500/10'}`}>
              <Sparkles className="w-2.5 h-2.5" />
              {showNotes ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </div>
          </div>
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">
            {p.team}
            <span className="text-indigo-500 ml-2">{p.pos}</span>
            {p.yahooStatusFull && !p.takenBy && <span className="text-red-400/70 ml-2">{p.yahooStatusFull}</span>}
            {p.takenBy && <span className="text-slate-600 ml-2">• {p.takenBy}</span>}
          </div>
          {Object.keys(yahooStats).length > 0 && !p.takenBy && (() => {
            const pStats = yahooStats[normalizeName(p.name)];
            if (!pStats) return null;
            const pairs = ids
              .map((id: string) => ({ id, label: YAHOO_STAT_LABELS[id] || id, val: pStats[id] }))
              .filter((s: any) => s.val && s.val !== '-' && s.val !== '0' && s.val !== '');
            if (pairs.length === 0) return null;
            return (
              <div className="flex gap-2 mt-1.5 flex-wrap">
                {pairs.map((s: any) => (
                  <span key={s.id} className="text-[9px] font-bold text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/15 px-1.5 py-0.5 rounded">
                    {s.label} {s.val}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Collapsible Notes Section */}
          {showNotes && (
            <div className="mt-3 flex flex-col gap-3 pt-2 border-t border-slate-800/50">
              {p.rationale ? (
                <>
                  <div className="bg-slate-900/40 p-3 rounded-xl border border-sky-500/20 shadow-inner">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest text-sky-400">
                        <Sparkles className="w-3 h-3" /> AI Insights
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowConfirm(true);
                        }}
                        className="text-[8px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all"
                      >
                        Refresh
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {!p.rationale.startsWith('[') ? `[Legacy Insight] ${p.rationale}` : p.rationale}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-slate-900/40 p-4 rounded-xl border border-dashed border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      <Sparkles className="w-3 h-3 text-sky-500/50" /> No AI Insights Yet
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 mb-3">
                    Request an AI analysis to get personalized insights for {p.name}.
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
              )}
              
              {/* Yahoo News Section */}
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
                    
                    {yahooNews.playerOutlook && (
                      <div className="mt-2 p-2 bg-slate-800/30 rounded border border-emerald-500/10">
                        <div className="text-[9px] font-bold text-emerald-400 mb-1 uppercase tracking-wider">
                          2026 Player Outlook
                        </div>
                        <p className="text-[10px] text-slate-300 leading-relaxed">
                          {yahooNews.playerOutlook}
                        </p>
                      </div>
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
              
              {p.yahooRecentNote && !p.takenBy && (
                <div className="text-xs text-slate-400/90 leading-snug border-l-2 border-sky-500/30 pl-3 py-1 italic">
                  {p.yahooRecentNote}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 ml-3 shrink-0">
        {!p.takenBy && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isInWatchlist) {
                updateWatchlist(myRoster.filter((r: any) => r.name !== p.name));
              } else {
                updateWatchlist([...myRoster, { id: p.id, name: p.name, pos: p.pos, team: p.team || 'FA', adp: p.adp, rationale: p.rationale }]);
              }
            }}
            className={`p-3 rounded-xl transition-all active:scale-90 ${isInWatchlist ? 'bg-indigo-600 border border-indigo-500/50 hover:bg-indigo-700' : 'bg-slate-800 hover:bg-indigo-600/50'}`}
          >
            {isInWatchlist ? <CheckCircle2 className="w-4 h-4 text-white" /> : <UserPlus className="w-4 h-4 text-white" />}
          </button>
        )}
        <button
          title="Ask AI to analyze this player"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          className="p-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
        </button>
      </div>

      {/* Confirmation Dialog for AI Request */}
      {showConfirm && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
          <div className="bg-slate-900 border border-sky-500/30 rounded-xl p-4 max-w-xs mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 text-sky-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              Request AI Analysis?
            </div>
            <p className="text-xs text-slate-400 mb-4">
              This will use your Gemini API quota to analyze <span className="text-white font-bold">{p.name}</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAskAI}
                className="flex-1 px-3 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-lg text-xs font-bold transition-all"
              >
                Confirm
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(false);
                }}
                className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
DraftBoardPlayerRow.displayName = 'DraftBoardPlayerRow';

export default function Home() {
  const [activeSport, setActiveSport] = useState('MLB');
  const [searchTerm, setSearchTerm] = useState('');
  const [myRoster, setMyRoster] = useState<{ id: number; name: string; pos: string; team: string; adp: number; rationale?: string; }[]>([]);
  const [watchlistTab, setWatchlistTab] = useState<'AVAILABLE' | 'DRAFTED' | 'ALL'>('AVAILABLE');
  const [isSyncing, setIsSyncing] = useState(false);
  const [yahooConnected, setYahooConnected] = useState(false);
  const [watchlistPosFilter, setWatchlistPosFilter] = useState('ALL');
  const [watchlistSort, setWatchlistSort] = useState<'original' | 'rank-asc' | 'rank-desc'>('original');

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  const handleDragStart = (idx: number) => setDraggedItemIndex(idx);
  const handleDragOver = (idx: number) => {
    if (draggedItemIndex === null || draggedItemIndex === idx) return;
    setDragOverItemIndex(idx);
  };
  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };
  const handleDrop = (idx: number) => {
    if (draggedItemIndex === null || draggedItemIndex === idx) return;
    const newRoster = [...myRoster];
    const item = newRoster.splice(draggedItemIndex, 1)[0];
    newRoster.splice(idx, 0, item);
    updateWatchlist(newRoster);
    handleDragEnd();
  };




  const updateWatchlist = async (newRoster: any[]) => {
    setMyRoster(newRoster);
    try {
      await fetch('/api/draft-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_ROSTER', rosterData: newRoster })
      });
    } catch (err) {
      console.error('Failed to sync watchlist to JSON', err);
    }
  };

  const leagueName = "Asshat Roto League";
  const myTeamName = "New Jersey Nine";
  const totalTeams = 18;
  const myDraftPosition = 11; // Confirmed from Tapatalk Round 1 thread

  const [currentPick, setCurrentPick] = useState(1);
  const [draftResults, setDraftResults] = useState<{ rd: number; pk: number; tm: string | null; name: string; pos: string; playerTeam: string; isKeeper: boolean }[]>([]);
  const [showDrafted, setShowDrafted] = useState(false);
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [statSort, setStatSort] = useState<string | null>(null); // null = rank/ADP default
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // New Layout States 
  const [viewMode, setViewMode] = useState<'PLAYERS' | 'GRID' | 'TEAM' | 'NEEDS' | 'WATCHLIST'>('PLAYERS');
  const [selectedTeam, setSelectedTeam] = useState(myTeamName);

  // Yahoo enriched player data (ranked + projected stats)
  const [yahooPlayers, setYahooPlayers] = useState<any[]>([]);
  const [isLoadingYahoo, setIsLoadingYahoo] = useState(false);
  // Yahoo last-season stats, keyed by lowercased player name
  const [yahooStats, setYahooStats] = useState<Record<string, Record<string, string>>>({});
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Gemini Assistant
  const [isAskingAssistant, setIsAskingAssistant] = useState(false);
  const [assistantRecs, setAssistantRecs] = useState<any[]>([]);
  const [aiNotes, setAiNotes] = useState<Record<string, string>>({});
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; parts: { text: string }[]; recommendations?: any[]; timestamp?: string }[]>([]);
  const [showAssistantModal, setShowAssistantModal] = useState(false);
  const assistantInputRef = useRef<{ getValue: () => string }>(null);
  const modalInputRef = useRef<{ getValue: () => string }>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [modalPos, setModalPos] = useState({ x: 24, y: 24 }); // bottom-right offset in px

  // Clamp modal back into viewport whenever its content changes height
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    // Wait one frame for layout to settle
    requestAnimationFrame(() => {
      const maxX = Math.max(0, window.innerWidth - el.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - el.offsetHeight);
      setModalPos(prev => ({
        x: Math.min(prev.x, maxX),
        y: Math.min(prev.y, maxY),
      }));
    });
  }, [assistantRecs, isAskingAssistant, showAssistantModal]);

  const { data: session } = useSession();

  // Mock NBA Data
  const nbaStats = {
    categories: [
      { label: "FG%", val: ".482", rk: 4 },
      { label: "FT%", val: ".810", rk: 2 },
      { label: "3PM", val: "842", rk: 1 },
      { label: "REB", val: "3120", rk: 14 },
    ],
    matchup: { opp: "Gotham Knights", score: "5-4-0" }
  };

  // Backend JSON Load
  useEffect(() => {
    Promise.all([
      fetch('/api/draft-data', { cache: 'no-store' }).then(res => res.json()).catch(() => ({})),
      fetch('/api/assistant/notes', { cache: 'no-store' }).then(res => res.json()).catch(() => ({})),
      fetch('/api/player-stats?season=2025', { cache: 'no-store' }).then(res => res.json()).catch(() => ({}))
    ]).then(([draftData, notesData, statsData]) => {
      if (draftData.roster) setMyRoster(draftData.roster);
      if (draftData.draft && draftData.draft.length > 0) {
        setDraftResults(draftData.draft);
        // Current pick = number of non-keeper picks made + 1
        // (Keepers don't count as draft picks)
        const nonKeeperPicks = draftData.draft.filter((p: any) => p.tm && !p.isKeeper).length;
        setCurrentPick(nonKeeperPicks + 1);
      }
      if (notesData) {
        // Normalize keys so they match the normalizeName function used for lookups
        const normalizedNotes: Record<string, string> = {};
        for (const [k, v] of Object.entries(notesData)) {
          normalizedNotes[normalizeName(k)] = v as string;
        }
        setAiNotes(normalizedNotes);
      }
      if (statsData) {
        setYahooStats(statsData);
      }
      setIsDataLoaded(true);
    }).catch(err => {
      console.error("Error loading initial data:", err);
      setIsDataLoaded(true);
    });
  }, []);

  const handleImport = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/scrape-draft');
      const data = await response.json();

      if (data.success) {
        if (data.picks && data.picks.length > 0) {
          setDraftResults(data.picks);
          // Current pick = number of non-keeper picks made + 1
          // (Keepers don't count as draft picks)
          const nonKeeperPicks = data.picks.filter((p: any) => p.tm && !p.isKeeper).length;
          setCurrentPick(nonKeeperPicks + 1);
        }
        // Success even if no new picks - don't show error
      } else {
        alert("Failed to sync Draft! " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error reaching the Scraper API.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-polling Cron: Sync every 5 minutes natively
  useEffect(() => {
    const intervalId = setInterval(() => {
      handleImport();
    }, 5 * 60 * 1000); // 300,000ms = 5 minutes

    return () => clearInterval(intervalId);
  }, []); // Run steadily on mount

  // Load live Yahoo player rankings + projected stats
  const loadYahooPlayers = async () => {
    setIsLoadingYahoo(true);
    try {
      // Initial fetch: first 500 players in 10 parallel requests
      const results = await Promise.all([
        fetch('/api/yahoo/players?start=0&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=50&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=100&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=150&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=200&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=250&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=300&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=350&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=400&count=50').then(r => r.json()),
        fetch('/api/yahoo/players?start=450&count=50').then(r => r.json()),
      ]);
      const combined = results.flatMap(d => d.players || []).map((p, i) => ({ ...p, rank: i + 1 }));
      setYahooPlayers(combined);
    } catch (err) {
      console.error('Yahoo player load error:', err);
    } finally {
      setIsLoadingYahoo(false);
    }
  };

  // Append the next 100 players to the existing list
  const loadMoreYahooPlayers = async () => {
    setIsLoadingYahoo(true);
    const currentCount = yahooPlayers.length;
    try {
      const results = await Promise.all([
        fetch(`/api/yahoo/players?start=${currentCount}&count=50`).then(r => r.json()),
        fetch(`/api/yahoo/players?start=${currentCount + 50}&count=50`).then(r => r.json()),
      ]);
      const newPlayers = results.flatMap(d => d.players || []).map((p, i) => ({ ...p, rank: currentCount + i + 1 }));
      if (newPlayers.length === 0) {
        alert('No more players available from Yahoo.');
        return;
      }
      setYahooPlayers(prev => [...prev, ...newPlayers]);
    } catch (err) {
      console.error('Yahoo load more error:', err);
    } finally {
      setIsLoadingYahoo(false);
    }
  };

  // Confirmed Yahoo MLB stat IDs (from cached data 2026-02-28)
  const YAHOO_STAT_LABELS: Record<string, string> = {
    // Batting
    '3': 'AVG', '7': 'R', '8': 'H', '12': 'HR', '13': 'RBI', '16': 'SB', '55': 'OPS',
    // Pitching
    '26': 'ERA', '27': 'WHIP', '28': 'W', '42': 'K', '50': 'IP', '83': 'QS',
  };
  // Lower = better (for sorting ascending)
  const ASCENDING_STATS = new Set(['26', '27']); // ERA, WHIP
  const BATTING_STAT_IDS = ['7', '12', '13', '16', '3', '55'];
  const PITCHING_STAT_IDS = ['28', '42', '50', '26', '27'];

  const loadYahooStats = async (forceRefresh = false) => {
    setIsLoadingStats(true);
    try {
      const stats = await fetch('/api/player-stats?season=2025', { cache: forceRefresh ? 'no-store' : 'default' })
        .then(res => res.json());
      setYahooStats(stats);
    } catch (err) {
      console.error('[Yahoo Stats] load error:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const askAssistant = async (promptOverride?: string, newSession = false) => {
    setIsAskingAssistant(true);
    setShowAssistantModal(true); // Always open the modal when a query fires

    // If starting a new session (button click), clear history & recs
    const activeHistory = newSession ? [] : chatHistory;
    if (newSession) {
      setChatHistory([]);
      setAssistantRecs([]);
    }

    const userPromptText = promptOverride !== undefined ? promptOverride.trim() : assistantPrompt.trim();

    try {
      // 1. Get my current team & open slots
      const myPicks = draftResults.filter(p => p.tm === myTeamName);
      const myRosterFull = getTeamRoster(myPicks);
      const openSlots = getMissingSlots(myRosterFull);

      // 2. Build the available pool using the same logic as the UI
      let processedPool = displayPool.map(p => {
        const pNorm = normalizeName(p.name);
        const yMatch = yahooPlayers.find(y => normalizeName(y.name) === pNorm);
        return { ...p, yahooRank: yMatch?.rank, yahooStatusFull: yMatch?.statusFull };
      });

      // Filter drafted
      processedPool = processedPool.filter(p => !p.takenBy);

      if (yahooPlayers.length > 0) {
        processedPool.sort((a, b) => {
          if (a.yahooRank && b.yahooRank) return a.yahooRank - b.yahooRank;
          if (a.yahooRank) return -1;
          if (b.yahooRank) return 1;
          return a.adp - b.adp;
        });
      }

      // Append the new user message to history
      const newHistory = userPromptText
        ? [...activeHistory, { role: 'user' as const, parts: [{ text: userPromptText }] }]
        : activeHistory;

      const payload = {
        myTeam: myRosterFull.filter(r => r.player).map(r => ({ slot: r.slot, player: r.player.name, pos: r.player.pos })),
        openSlots,
        availablePool: processedPool, // Full pool — no cap
        allDrafted: draftResults.filter(r => r.tm), // The actual drafted pool for live AI feedback loop
        picksUntilTurn: waitPicks,
        customPrompt: userPromptText,
        chatHistory: newHistory
      };

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        // Always set recs (even if empty array — keeps modal visible on parse failure)
        setAssistantRecs(data.recommendations || []);
        // Append model reply to history for next follow-up
        if (data.assistantMessage) {
          setChatHistory([...newHistory, {
            role: 'model' as const,
            parts: [{ text: data.assistantMessage }],
            recommendations: data.recommendations || [],
            timestamp: new Date().toISOString()
          }]);
        }
        // If we got 0 recs despite a successful call, show raw response for debugging
        if ((data.recommendations || []).length === 0 && data.assistantMessage) {
          console.warn('Gemini returned 0 recs. Raw:', data.assistantMessage);
        }

        // Refetch AI notes so any new rationales are immediately rendered across the board
        try {
          const notesRes = await fetch('/api/assistant/notes');
          const notesData = await notesRes.json();
          if (notesData) {
            const normalizedNotes: Record<string, string> = {};
            for (const [k, v] of Object.entries(notesData)) {
              normalizedNotes[normalizeName(k)] = v as string;
            }
            setAiNotes(normalizedNotes);
          }
        } catch (e) { console.error("Could not refresh AI Notes post-generation."); }

      }
    } catch (err) {
      console.error(err);
      alert('Failed to ask assistant.');
    } finally {
      setIsAskingAssistant(false);
    }
  };

  const waitPicks = useMemo(() => {
    // Standard linear draft (not snake) - each round goes 1-18 in order
    // Your position is always pick #11 in each round
    const currentRound = Math.floor((currentPick - 1) / totalTeams) + 1;
    const pickInRound = ((currentPick - 1) % totalTeams) + 1;
    
    // If current pick is yours, return 0
    if (pickInRound === myDraftPosition) {
      return 0;
    }
    
    // Find next pick where you're at position 11
    let nextRound = currentRound;
    if (pickInRound > myDraftPosition) {
      nextRound = currentRound + 1; // Already passed your pick this round
    }
    
    const nextPick = ((nextRound - 1) * totalTeams) + myDraftPosition;
    return nextPick - currentPick;
  }, [currentPick, totalTeams, myDraftPosition]);

  const displayPool = useMemo(() => {
    return draftResults.filter(p => {
      // Search term filter
      if (!p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      // Show/Hide Drafted
      if (!showDrafted && p.tm) return false;
      // Position filter (handle multi-eligibility like '1B/OF' or 'C,1B')
      if (positionFilter !== 'ALL') {
        const eligiblePos = p.pos.split(/[\/,]/).map(pos => pos.trim().toUpperCase());
        // Map OF filter to LF/CF/RF explicitly, or exact match
        if (positionFilter === 'OF') {
          if (!eligiblePos.some(pos => pos === 'OF' || pos === 'LF' || pos === 'CF' || pos === 'RF')) return false;
        } else {
          if (!eligiblePos.includes(positionFilter)) return false;
        }
      }
      return true;
    }).map(p => ({
      id: p.pk,
      pk: p.pk,
      name: p.name,
      pos: p.pos,
      team: p.playerTeam || 'FA',
      adp: p.pk,
      takenBy: p.tm,
      rationale: aiNotes[normalizeName(p.name)]
    }));
  }, [searchTerm, myRoster, draftResults, showDrafted, positionFilter, aiNotes]);

  const processedPool = useMemo(() => {
    let copy = [...displayPool] as any[];

    // 1. Enrich base Tapatalk pool
    copy = copy.map(p => {
      const pNorm = normalizeName(p.name);
      const yMatch = yahooPlayers.find(y => normalizeName(y.name) === pNorm);
      const tMatch = draftResults.find(d => d.name?.toLowerCase() === p.name.toLowerCase());

      return {
        ...p,
        isKeeper: tMatch?.isKeeper || false,
        yahooRank: yMatch ? yMatch.rank : null,
        yahooStatus: yMatch ? yMatch.status : null,
        yahooStatusFull: yMatch ? yMatch.statusFull : null,
        yahooHasNotes: yMatch ? yMatch.hasNotes : false,
        yahooRecentNote: yMatch ? yMatch.recentNote : null
      };
    });

    // 2. Filter drafted
    if (!showDrafted) {
      copy = copy.filter(p => !p.takenBy);
    }

    // 3. Search & Pos Filter
    copy = copy.filter(p => {
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (positionFilter !== 'ALL') {
        const positions = p.pos.toUpperCase().split(/[\/,]+/);
        if (!positions.includes(positionFilter)) return false;
      }
      return true;
    });

    // 4. Sort
    if (statSort && Object.keys(yahooStats).length > 0) {
      copy.sort((a, b) => {
        const aStats = yahooStats[normalizeName(a.name)];
        const bStats = yahooStats[normalizeName(b.name)];
        const aVal = aStats ? parseFloat(aStats[statSort]) || 0 : -Infinity;
        const bVal = bStats ? parseFloat(bStats[statSort]) || 0 : -Infinity;
        if (aVal !== bVal) return ASCENDING_STATS.has(statSort) ? aVal - bVal : bVal - aVal;
        if (a.yahooRank && b.yahooRank) return a.yahooRank - b.yahooRank;
        if (a.yahooRank) return -1;
        if (b.yahooRank) return 1;
        return a.adp - b.adp;
      });
    } else if (yahooPlayers.length > 0) {
      copy.sort((a, b) => {
        if (a.yahooRank && b.yahooRank) return a.yahooRank - b.yahooRank;
        if (a.yahooRank) return -1;
        if (b.yahooRank) return 1;
        return a.adp - b.adp;
      });
    }

    return copy;
  }, [displayPool, searchTerm, showDrafted, draftResults, positionFilter, statSort, yahooStats, yahooPlayers, activeSport]);


  // Standard Yahoo Roster Slots (23-man with explicit Outfielders)
  const ROSTER_SLOTS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'UTIL', 'SP', 'SP', 'SP', 'SP', 'SP', 'RP', 'RP', 'P', 'P', 'BN', 'BN', 'BN', 'BN'];

  // Returns unique empty slot names (excluding BN) for a team's roster
  const getMissingSlots = (roster: { slot: string; player: any }[]) => {
    return roster
      .filter(r => !r.player && r.slot !== 'BN' && r.slot !== 'P')
      .map(r => r.slot);
  };

  const getTeamRoster = (picks: typeof draftResults) => {
    const roster = ROSTER_SLOTS.map(slot => ({ slot, player: null as any }));

    // Helper to check if a player is an offensive player (hitter)
    const isHitter = (eligiblePos: string[]) => {
      // If they only have P, SP, or RP, they are not a hitter
      if (eligiblePos.every(p => ['P', 'SP', 'RP'].includes(p))) return false;
      return true;
    };

    // Assign to exact position match first
    picks.forEach(pick => {
      const posString = pick.pos?.toUpperCase() || '';
      const eligiblePos = posString.split(/[\/,]/).map(p => p.trim());
      let assigned = false;

      // Try exact match or subset match (e.g. if player is OF, try to fit in LF/CF/RF if empty)
      for (let i = 0; i < roster.length; i++) {
        if (!roster[i].player) {
          const slot = roster[i].slot;

          // Direct Match (e.g. Player is '1B', slot is '1B')
          if (eligiblePos.includes(slot)) {
            roster[i].player = pick;
            assigned = true;
            break;
          }

          // If the player is explicitly ONLY listed as "OF" (and not specific LF/CF/RF), 
          // allow them to slot into the first available LF/CF/RF
          const hasSpecificOF = eligiblePos.some(p => ['LF', 'CF', 'RF'].includes(p));
          if (eligiblePos.includes('OF') && !hasSpecificOF && (slot === 'LF' || slot === 'CF' || slot === 'RF')) {
            roster[i].player = pick;
            assigned = true;
            break;
          }

          // Pitcher Fallbacks
          if ((slot === 'SP' && eligiblePos.includes('SP')) || (slot === 'RP' && eligiblePos.includes('RP'))) {
            roster[i].player = pick;
            assigned = true;
            break;
          }
        }
      }

      // Try UTIL or P or BN if exact/outfield match fails
      if (!assigned) {
        for (let i = 0; i < roster.length; i++) {
          if (!roster[i].player) {
            const slot = roster[i].slot;

            // UTIL: Any hitting position (but not Pitchers)
            if (slot === 'UTIL' && isHitter(eligiblePos)) {
              roster[i].player = pick;
              assigned = true;
              break;
            }

            // P: Any pitching position
            if (slot === 'P' && (eligiblePos.includes('SP') || eligiblePos.includes('RP') || eligiblePos.includes('P'))) {
              roster[i].player = pick;
              assigned = true;
              break;
            }

            // BN: Anyone
            if (slot.startsWith('BN')) {
              roster[i].player = pick;
              assigned = true;
              break;
            }
          }
        }
      }
    });

    return roster;
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <header className="max-w-7xl w-full mx-auto shrink-0 flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4 border-b border-slate-900 pb-8">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg"><Trophy className="w-7 h-7" /></div>
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">{leagueName}</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">{myTeamName} • 18-Team Tracker</p>
          </div>
        </div>
        <div className="flex gap-3 bg-slate-900 p-2 rounded-2xl border border-slate-800">
          <button onClick={handleImport} disabled={isSyncing} className="px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-500/20 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} /> {isSyncing ? 'SYNCING...' : 'SYNC LOCAL'}
          </button>

          {session ? (
            <button onClick={() => signOut()} className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-green-500/20 hover:text-red-400 transition-colors" title={session.user?.name || "Connected"}>
              <ShieldCheck className="w-3.5 h-3.5" /> YAHOO LINKED
            </button>
          ) : (
            <button onClick={() => signIn('yahoo')} className="px-4 py-2 bg-purple-600 border border-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-purple-500 transition-transform active:scale-95 shadow-lg shadow-purple-600/20">
              <Plug className="w-3.5 h-3.5" /> CONNECT YAHOO
            </button>
          )}

          <div className="flex bg-black rounded-lg p-1 border border-slate-800 shadow-inner">
            <button onClick={() => setActiveSport('MLB')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeSport === 'MLB' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>MLB</button>
            <button onClick={() => setActiveSport('NBA')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeSport === 'NBA' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>NBA</button>
          </div>
        </div>
      </header>

      {/* Compact Status Strip */}
      {activeSport === 'MLB' && (
        <div className={`max-w-7xl w-full mx-auto shrink-0 mb-4 rounded-2xl px-5 py-3 flex items-center gap-6 border ${waitPicks === 0 ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'}`}>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Pick</span>
            <span className="font-black text-lg tracking-tight">
              R{Math.floor((currentPick - 1) / totalTeams) + 1} P{((currentPick - 1) % totalTeams) + 1}
            </span>
            <span className="text-[10px] font-bold opacity-50">(#{currentPick})</span>
          </div>
          <div className="w-px h-5 bg-current opacity-20" />
          {waitPicks === 0 ? (
            <span className="text-sm font-black animate-pulse">🟢 YOUR PICK NOW!</span>
          ) : (
            <span className="text-sm font-bold">
              <span className="font-black text-lg">{waitPicks}</span>
              <span className="text-[10px] uppercase opacity-60 ml-1">picks until {myTeamName}</span>
            </span>
          )}
        </div>
      )}

      <main className="max-w-7xl w-full mx-auto flex-1 flex flex-col min-h-0">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 flex-1 flex flex-col shadow-2xl min-h-0">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-10 shrink-0">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4">
              <LayoutGrid className={`w-8 h-8 ${activeSport === 'MLB' ? 'text-indigo-500' : 'text-orange-500'}`} />
              {activeSport === 'MLB' ? 'Draft Board' : 'NBA Stats'}
            </h2>
            <div className="flex bg-slate-950 w-fit rounded-xl p-1 border border-slate-800 shadow-inner">
              <button onClick={() => setViewMode('PLAYERS')} className={`px-4 py-2 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 rounded-lg transition-all ${viewMode === 'PLAYERS' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                <Search className="w-3.5 h-3.5" /> Pool
              </button>
              <button onClick={() => setViewMode('GRID')} className={`px-4 py-2 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button onClick={() => setViewMode('TEAM')} className={`px-4 py-2 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 rounded-lg transition-all ${viewMode === 'TEAM' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                <Users className="w-3.5 h-3.5" /> Team
              </button>
              <button onClick={() => setViewMode('NEEDS')} className={`px-4 py-2 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 rounded-lg transition-all ${viewMode === 'NEEDS' ? 'bg-orange-600 text-white shadow shadow-orange-500/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                <BarChart3 className="w-3.5 h-3.5" /> Needs
              </button>
              <button onClick={() => setViewMode('WATCHLIST')} className={`px-4 py-2 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 rounded-lg transition-all ${viewMode === 'WATCHLIST' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                <ListOrdered className="w-3.5 h-3.5" /> Watchlist
              </button>
            </div>
          </div>

          {/* === GLOBAL ROW: Assistant controls === */}
          {session && (
            <div className="flex items-center gap-2 mb-4 shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5 bg-sky-500/5 border border-sky-500/20 rounded-2xl px-3 py-2 flex-1 min-w-0">
                {/* Toggle panel open/close without firing a query */}
                <button
                  onClick={() => setShowAssistantModal(v => !v)}
                  title={showAssistantModal ? 'Close panel' : 'Open panel'}
                  className="shrink-0 text-sky-400/60 hover:text-sky-400 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <AssistantInput
                    ref={assistantInputRef}
                    isAskingAssistant={isAskingAssistant}
                    onSubmit={(val) => askAssistant(val, true)}
                    placeholder="Ask assistant: focus on closers, need a SS..."
                  />
                </div>
              </div>
              <button
                onClick={() => askAssistant(assistantInputRef.current?.getValue() || '', true)}
                disabled={isAskingAssistant}
                className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 disabled:opacity-50 flex items-center gap-2 transition-all whitespace-nowrap"
              >
                <Sparkles className={`w-4 h-4 ${isAskingAssistant ? 'animate-spin' : ''}`} />
                {isAskingAssistant ? 'Analyzing...' : 'Ask Assistant'}
              </button>
            </div>
          )}

          {viewMode === 'PLAYERS' && (
            <>
              {/* === SECONDARY ROW: Search + position filters + misc === */}
              <div className="relative mb-3 group shrink-0">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
                <input type="text" placeholder="Search players..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-indigo-500/40 focus:outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>

              <div className="flex items-center gap-3 mb-5 shrink-0 flex-wrap">
                {/* Position filters */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1 min-w-0">
                  {['ALL', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'UTIL', 'SP', 'RP'].map(pos => (
                    <button
                      key={pos}
                      onClick={() => setPositionFilter(pos)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest whitespace-nowrap transition-all shrink-0 ${positionFilter === pos ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-300 hover:border-slate-700'}`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 cursor-pointer whitespace-nowrap shrink-0">
                  <input type="checkbox" checked={showDrafted} onChange={(e) => setShowDrafted(e.target.checked)} className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-offset-slate-900" />
                  DRAFTED
                </label>
                {session && (
                  <>
                    <button
                      onClick={loadYahooPlayers}
                      disabled={isLoadingYahoo}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
                    >
                      <Zap className={`w-3 h-3 ${isLoadingYahoo ? 'animate-pulse' : ''}`} />
                      {isLoadingYahoo ? '...' : yahooPlayers.length > 0 ? `AR:${yahooPlayers.length}` : 'YAHOO'}
                    </button>
                    <button
                      onClick={() => loadYahooStats()}
                      disabled={isLoadingStats}
                      title={Object.keys(yahooStats).length > 0 ? `${Object.keys(yahooStats).length} players' stats loaded — click to refresh` : 'Load 2025 season stats from Yahoo'}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
                    >
                      <BarChart3 className={`w-3 h-3 ${isLoadingStats ? 'animate-pulse' : ''}`} />
                      {isLoadingStats ? 'Loading...' : Object.keys(yahooStats).length > 0 ? `Stats:${Object.keys(yahooStats).length}` : 'Stats'}
                    </button>
                    {Object.keys(yahooStats).length > 0 && (
                      <select
                        value={statSort || ''}
                        onChange={(e) => setStatSort(e.target.value || null)}
                        className="bg-slate-950 border border-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-xl px-2 py-1.5 focus:ring-1 focus:ring-emerald-500/50 outline-none"
                      >
                        <option value="">Sort by Rank</option>
                        <optgroup label="Batting">
                          {BATTING_STAT_IDS.map(id => <option key={`b-${id}`} value={id}>{YAHOO_STAT_LABELS[id] || id}</option>)}
                        </optgroup>
                        <optgroup label="Pitching">
                          {PITCHING_STAT_IDS.map(id => <option key={`p-${id}`} value={id}>{YAHOO_STAT_LABELS[id] || id}</option>)}
                        </optgroup>
                      </select>
                    )}
                  </>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                {processedPool.map((p: any) => (
                  <DraftBoardPlayerRow
                    key={p.pk}
                    p={{ ...p, rationale: aiNotes[normalizeName(p.name)] }}
                    yahooStats={yahooStats}
                    yahooPlayers={yahooPlayers}
                    updateWatchlist={updateWatchlist}
                    activeSport={activeSport}
                    myRoster={myRoster}
                    BATTING_STAT_IDS={BATTING_STAT_IDS}
                    PITCHING_STAT_IDS={PITCHING_STAT_IDS}
                    YAHOO_STAT_LABELS={YAHOO_STAT_LABELS}
                    onAskAssistant={askAssistant}
                  />
                ))}
              </div>
            </>
          )}

          {viewMode === 'GRID' && (() => {
            const drafted = draftResults
              .filter(pick => pick.tm && !pick.isKeeper)
              .sort((a, b) => a.pk - b.pk);

            if (drafted.length === 0) {
              return (
                <div className="flex-1 overflow-y-auto pr-2">
                  <div className="text-center mt-20 opacity-50 font-black tracking-widest text-slate-500">NO DRAFT DATA SYNCED YET</div>
                </div>
              );
            }

            // Group picks by round
            const roundsMap = drafted.reduce((acc, pick) => {
              const rd = pick.rd || 1;
              if (!acc[rd]) acc[rd] = [];
              acc[rd].push(pick);
              return acc;
            }, {} as Record<number, typeof drafted>);

            const sortedRounds = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

            return (
              <div className="flex-1 overflow-y-auto pr-2 pb-10 space-y-8">
                {sortedRounds.map(rd => (
                  <div key={`round-${rd}`} className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                    <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-800/80 flex items-center justify-between sticky top-0 backdrop-blur-md z-10">
                      <h3 className="font-black itertools tracking-widest text-indigo-400 uppercase text-xs">Round {rd}</h3>
                      <span className="text-[10px] font-bold text-slate-500">{roundsMap[rd].length} / {totalTeams} Picks</span>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead className="hidden">
                        <tr>
                          <th>Pick</th>
                          <th>Player</th>
                          <th>Positions</th>
                          <th>MLB Team</th>
                          <th>Fantasy Team</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundsMap[rd].map((p, i) => (
                          <tr key={p.pk} className={`border-b border-slate-800/30 transition-colors hover:bg-slate-800/30 ${i % 2 === 0 ? 'bg-slate-950/30' : 'bg-transparent'} last:border-0`}>
                            <td className="py-2 px-5 w-24">
                              <div className="flex items-center gap-2">
                                <span title={`Pick number within Round ${rd}`} className="text-[10px] font-black text-indigo-300 border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                  P{(p.pk - 1) % totalTeams + 1}
                                </span>
                                <span title={`Overall Pick #${p.pk}`} className="text-[9px] font-bold text-slate-600">
                                  (#{p.pk})
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <span className="font-bold text-slate-200 text-sm tracking-tight">{p.name}</span>
                            </td>
                            <td className="py-2 px-2 w-24">
                              <span className="text-[9px] font-black text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded uppercase tracking-wider">{p.pos}</span>
                            </td>
                            <td className="py-2 px-2 w-20">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{p.playerTeam}</span>
                            </td>
                            <td className="py-2 px-5 text-right">
                              <span className="text-[11px] font-black text-slate-300 italic tracking-wide">{p.tm}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          })()}

          {viewMode === 'TEAM' && (
            <div className="flex-1 flex gap-6 overflow-hidden">
              {/* Team sidebar */}
              <div className="w-44 shrink-0 flex flex-col gap-1 overflow-y-auto pr-2 border-r border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 sticky top-0 bg-slate-900 py-2">Franchise</div>
                {Array.from(new Set(draftResults.filter(p => p.tm).map(p => p.tm as string))).sort((a, b) => {
                  if (a === myTeamName) return -1;
                  if (b === myTeamName) return 1;
                  return a.localeCompare(b);
                }).map(team => (
                  <button
                    key={team}
                    onClick={() => setSelectedTeam(team)}
                    className={`text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all ${selectedTeam === team ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                  >
                    {team === myTeamName ? `★ ${team}` : team}
                  </button>
                ))}
              </div>

              {/* Roster table */}
              <div className="flex-1 overflow-y-auto">
                <div className="flex items-baseline gap-3 mb-4">
                  <h3 className="text-lg font-black italic tracking-tighter text-indigo-400">{selectedTeam}</h3>
                  {(() => {
                    const teamPicks = draftResults.filter(p => p.tm === selectedTeam);
                    const roster = getTeamRoster(teamPicks);
                    const missing = getMissingSlots(roster);
                    return missing.length > 0
                      ? <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">{missing.length} open slots</span>
                      : <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">Roster Full</span>;
                  })()}
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-900 z-10">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <th className="text-left py-2 px-3 w-14">Slot</th>
                      <th className="text-left py-2 px-3">Player</th>
                      <th className="text-left py-2 px-3 w-12">Team</th>
                      <th className="text-left py-2 px-3 w-24">Pos</th>
                      <th className="text-left py-2 px-3 w-24">Pick</th>
                    </tr>
                    <tr><td colSpan={5}><div className="h-px bg-slate-800 w-full" /></td></tr>
                  </thead>
                  <tbody>
                    {getTeamRoster(draftResults.filter(p => p.tm === selectedTeam)).map((r, i) => (
                      <tr key={i} className={`border-b border-slate-800/30 ${r.player ? (i % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/20') : 'opacity-40'}`}>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-black uppercase ${r.player ? 'text-indigo-400' : 'text-slate-600 italic'}`}>{r.slot}</span>
                        </td>
                        <td className="py-2 px-3">
                          {r.player
                            ? <span className="font-bold text-sm text-slate-100">{r.player.name}</span>
                            : <span className="text-xs text-slate-600 italic">Empty</span>
                          }
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] text-slate-500 font-bold">{r.player?.playerTeam || ''}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] text-indigo-400 font-bold uppercase">{r.player?.pos || ''}</span>
                        </td>
                        <td className="py-2 px-3">
                          {r.player && (
                            <span className="text-[10px] text-slate-500 font-bold">
                              {r.player.isKeeper ? 'KEEPER' : `#${r.player.pk} Rd ${r.player.rd}`}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'NEEDS' && (() => {
            // Build a sorted list of all teams with their missing positions
            const teamMap = draftResults
              .filter(p => p.tm)
              .reduce((acc, p) => {
                const t = p.tm as string;
                if (!acc[t]) acc[t] = [];
                acc[t].push(p);
                return acc;
              }, {} as Record<string, typeof draftResults>);

            const teamNeeds = Object.entries(teamMap).map(([team, picks]) => {
              const roster = getTeamRoster(picks);
              const missing = getMissingSlots(roster);
              return { team, missing, openCount: missing.length };
            }).sort((a, b) => {
              // Put my team first, then sort by most needs
              if (a.team === myTeamName) return -1;
              if (b.team === myTeamName) return 1;
              return b.openCount - a.openCount;
            });

            // Count how many teams need each position
            const positionDemand: Record<string, number> = {};
            const totalTeams = teamNeeds.length;
            teamNeeds.forEach(t => {
              t.missing.forEach(slot => {
                positionDemand[slot] = (positionDemand[slot] || 0) + 1;
              });
            });
            const demandSorted = Object.entries(positionDemand).sort((a, b) => b[1] - a[1]);
            const maxDemand = demandSorted[0]?.[1] || 1;

            return (
              <div className="flex-1 flex flex-col overflow-hidden gap-4">

                {/* Position Demand Summary */}
                {demandSorted.length > 0 && (
                  <div className="shrink-0">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Position Demand — Teams Still Needing</div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                      {demandSorted.map(([pos, count]) => {
                        const pct = (count / maxDemand) * 100;
                        const isHot = count >= maxDemand * 0.75;
                        const isWarm = count >= maxDemand * 0.45;
                        const barColor = isHot ? 'bg-red-500' : isWarm ? 'bg-orange-500' : 'bg-slate-600';
                        const textColor = isHot ? 'text-red-400' : isWarm ? 'text-orange-400' : 'text-slate-500';
                        return (
                          <div key={pos} className="flex items-center gap-2">
                            <span className={`text-[9px] font-black w-7 shrink-0 text-right ${textColor}`}>{pos}</span>
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-[9px] font-black tabular-nums w-8 shrink-0 ${textColor}`}>{count}/{totalTeams}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="h-px bg-slate-800 mt-4 mb-2" />
                  </div>
                )}

                {/* Team needs table */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <th className="text-left py-3 px-4">Team</th>
                        <th className="text-left py-3 px-4 w-16">Open</th>
                        <th className="text-left py-3 px-4">Needs</th>
                      </tr>
                      <tr><td colSpan={3} className="pb-1"><div className="h-px bg-slate-800 w-full" /></td></tr>
                    </thead>
                    <tbody>
                      {teamNeeds.map((t, i) => (
                        <tr
                          key={t.team}
                          onClick={() => { setSelectedTeam(t.team); setViewMode('TEAM'); }}
                          className={`border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-800/30 ${t.team === myTeamName ? 'bg-indigo-500/5' : i % 2 === 0 ? 'bg-slate-950' : 'bg-slate-900/20'}`}
                        >
                          <td className="py-3 px-4">
                            <span className={`font-bold text-sm ${t.team === myTeamName ? 'text-indigo-300' : 'text-slate-200'}`}>{t.team}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs font-black ${t.openCount === 0 ? 'text-green-400' : 'text-orange-400'}`}>
                              {t.openCount === 0 ? 'FULL' : t.openCount}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {t.missing.map((slot, j) => (
                                <span key={j} className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase border
                                  ${slot.includes('SP') || slot.includes('RP') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                    slot.includes('LF') || slot.includes('CF') || slot.includes('RF') ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                      slot === 'UTIL' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                        'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                  }`}
                                >{slot}</span>
                              ))}
                              {t.openCount === 0 && <span className="text-[9px] text-green-500 italic">Roster Complete</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {teamNeeds.length === 0 && (
                    <div className="text-center mt-20 opacity-50 font-black tracking-widest text-slate-500">NO DRAFT DATA YET</div>
                  )}
                </div>
              </div>
            );
          })()}

          {viewMode === 'WATCHLIST' && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Watchlist Header */}
              <div className="mb-6 shrink-0 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 bg-slate-800/50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-indigo-400" />
                  Watchlist ({myRoster.length})
                </h3>

                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 shrink-0 shadow-inner">
                  {(['AVAILABLE', 'DRAFTED', 'ALL'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setWatchlistTab(tab)}
                      className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${watchlistTab === tab ? 'bg-indigo-600 text-white shadow shadow-indigo-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters & Sorting */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shrink-0 bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                <div className="flex gap-1.5 flex-wrap">
                  {['ALL', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SP', 'RP'].map(pos => (
                    <button
                      key={pos}
                      onClick={() => setWatchlistPosFilter(pos)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${watchlistPosFilter === pos
                        ? 'bg-indigo-600 text-white shadow shadow-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>

                <div className="flex gap-1.5">
                  {([['original', 'My Order'], ['rank-asc', 'Rank ↑'], ['rank-desc', 'Rank ↓']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setWatchlistSort(val)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${watchlistSort === val
                        ? 'bg-slate-700 text-slate-200 shadow'
                        : 'bg-slate-800/40 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid view of Watchlist items */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  let view = myRoster.map((p, originalIndex) => ({ p, originalIndex }));

                  if (watchlistPosFilter !== 'ALL') {
                    view = view.filter(({ p }) =>
                      p.pos?.toUpperCase().split(/[\/,]+/).includes(watchlistPosFilter)
                    );
                  }

                  if (watchlistSort === 'rank-asc') {
                    view = [...view].sort((a, b) => {
                      // Enrich with Yahoo rank for sorting
                      const aYahoo = yahooPlayers.find(yh => normalizeName(yh.name) === normalizeName(a.p.name));
                      const bYahoo = yahooPlayers.find(yh => normalizeName(yh.name) === normalizeName(b.p.name));
                      const aRank = aYahoo?.rank || a.p.adp || 9999;
                      const bRank = bYahoo?.rank || b.p.adp || 9999;
                      return aRank - bRank;
                    });
                  } else if (watchlistSort === 'rank-desc') {
                    view = [...view].sort((a, b) => {
                      // Enrich with Yahoo rank for sorting
                      const aYahoo = yahooPlayers.find(yh => normalizeName(yh.name) === normalizeName(a.p.name));
                      const bYahoo = yahooPlayers.find(yh => normalizeName(yh.name) === normalizeName(b.p.name));
                      const aRank = aYahoo?.rank || a.p.adp || 0;
                      const bRank = bYahoo?.rank || b.p.adp || 0;
                      return bRank - aRank;
                    });
                  }

                  const visibleView = view.filter(({ p }) => {
                    const isTaken = draftResults.some(d => (d.tm || d.pos.toLowerCase().includes('round')) && normalizeName(d.name) === normalizeName(p.name));
                    if (watchlistTab === 'AVAILABLE') return !isTaken;
                    if (watchlistTab === 'DRAFTED') return isTaken;
                    return true;
                  });

                  if (visibleView.length === 0) {
                    return <div className="flex items-center justify-center p-20 text-slate-600 text-sm font-bold uppercase tracking-widest bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">No players match current filter</div>;
                  }

                  return (
                    <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
                      {visibleView.map(({ p, originalIndex }) => {
                        const isTaken = draftResults.some(d => (d.tm || d.pos.toLowerCase().includes('round')) && normalizeName(d.name) === normalizeName(p.name));
                        const yhPlayer = yahooPlayers.find(yh => normalizeName(yh.name) === normalizeName(p.name)) || {};
                        const yhStats = yahooStats[normalizeName(p.name)];

                        let yahooStatsPairs = null;
                        if (yhStats) {
                          const isPitcher = /SP|RP|P/i.test(p.pos);
                          const ids = isPitcher ? PITCHING_STAT_IDS : BATTING_STAT_IDS;
                          yahooStatsPairs = ids
                            .map(id => ({ id, label: YAHOO_STAT_LABELS[id] || id, val: yhStats[id] }))
                            .filter(s => s.val && s.val !== '-' && s.val !== '0' && s.val !== '');
                        }

                        const enrichedPlayer = {
                          ...p,
                          ...yhPlayer,
                          rationale: aiNotes[normalizeName(p.name)] || p.rationale,
                          yahooStatsPairs: yahooStatsPairs
                        };

                        return (
                          <WatchlistItem
                            key={originalIndex}
                            player={enrichedPlayer}
                            activeSport={activeSport}
                            isTaken={isTaken}
                            isFirst={originalIndex === 0}
                            isLast={originalIndex === myRoster.length - 1}
                            onMoveUp={() => {
                              const newRoster = [...myRoster];
                              [newRoster[originalIndex - 1], newRoster[originalIndex]] = [newRoster[originalIndex], newRoster[originalIndex - 1]];
                              updateWatchlist(newRoster);
                            }}
                            onMoveDown={() => {
                              const newRoster = [...myRoster];
                              [newRoster[originalIndex + 1], newRoster[originalIndex]] = [newRoster[originalIndex], newRoster[originalIndex + 1]];
                              updateWatchlist(newRoster);
                            }}
                            onDelete={() => updateWatchlist(myRoster.filter((_, idx) => idx !== originalIndex))}
                            index={originalIndex}
                            draggedIndex={draggedItemIndex}
                            dragOverIndex={dragOverItemIndex}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                            onDrop={handleDrop}
                            onAskAssistant={askAssistant}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Assistant Modal / Popover */}
      {
        showAssistantModal && (
          <div
            ref={modalRef}
            style={{ bottom: modalPos.y, right: modalPos.x }}
            className="fixed w-[420px] bg-slate-900 border border-slate-700 p-6 z-50 flex flex-col max-h-[80vh] overflow-hidden rounded-[2.5rem] shadow-[0_20px_50px_rgba(8,_112,_184,_0.3)]"
          >
            {/* Drag handle — title bar; updates DOM directly, commits state on release */}
            <div
              className="flex items-center justify-between mb-6 shrink-0 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={(e) => {
                e.preventDefault();
                const el = modalRef.current;
                if (!el) return;
                const startX = e.clientX;
                const startY = e.clientY;
                const startPosX = modalPos.x;
                const startPosY = modalPos.y;
                let cx = startPosX, cy = startPosY;
                const clamp = (rawX: number, rawY: number) => {
                  const w = window.innerWidth;
                  const h = window.innerHeight;
                  const mw = el.offsetWidth;
                  const mh = el.offsetHeight;
                  return {
                    x: Math.min(Math.max(0, rawX), w - mw),
                    y: Math.min(Math.max(0, rawY), h - mh),
                  };
                };
                const onMove = (mv: PointerEvent) => {
                  const clamped = clamp(
                    startPosX - (mv.clientX - startX),
                    startPosY - (mv.clientY - startY)
                  );
                  cx = clamped.x;
                  cy = clamped.y;
                  el.style.right = cx + 'px';
                  el.style.bottom = cy + 'px';
                };
                const onUp = () => {
                  setModalPos({ x: cx, y: cy });
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                };
                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
            >
              <h3 className="text-xl font-black italic tracking-tighter flex items-center gap-3 text-sky-400">
                <Sparkles className="w-6 h-6" /> Pick Assistant
              </h3>
              <div className="flex items-center gap-2">
                {/* DEV: Load fixture without burning API quota */}
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={async () => {
                      const res = await fetch('/test-assistant-response.json');
                      const recs = await res.json();
                      setAssistantRecs(recs);
                    }}
                    className="text-[9px] font-black uppercase tracking-widest text-amber-400/60 hover:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10 px-2 py-1 rounded-lg transition-all"
                  >
                    Load Test
                  </button>
                )}
                {assistantRecs.length > 0 && !isAskingAssistant && (
                  <button onClick={() => { setAssistantRecs([]); setChatHistory([]); }} className="text-slate-500 hover:text-red-400 bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setShowAssistantModal(false)} className="text-slate-500 hover:text-slate-300 bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full transition-all">
                  ✕
                </button>
              </div>
            </div>
            {/* Follow-up input bar */}
            {!isAskingAssistant && (
              <div className="mb-4 shrink-0 flex gap-2">
                <AssistantInput
                  ref={modalInputRef}
                  isAskingAssistant={isAskingAssistant}
                  onSubmit={(val) => askAssistant(val, false)}
                  placeholder="Follow up: actually find me a closer..."
                />
                <button
                  onClick={() => askAssistant(modalInputRef.current?.getValue() || '', false)}
                  className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30 flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3 h-3" /> Send
                </button>
              </div>
            )}
            {/* AI Recommendations or Loading State */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 relative">

              {/* Chat History View (conversational text) */}
              {chatHistory.length > 0 && (
                <div className="space-y-4 mb-4">
                  {chatHistory.map((msg, idx) => {
                    // Skip displaying the hidden JSON schema system preamble
                    // Skip displaying the hidden JSON schema system preamble
                    let text = msg.parts[0].text;
                    if (!text || (text.includes('You are an expert, cutthroat') && text.includes('JSON'))) return null;

                    if (msg.role === 'model') {
                      // Remove markdown code blocks containing JSON
                      text = text.replace(/```(?:json)?\s*[\s\S]*?\s*```/ig, '').trim();
                      // Remove raw json arrays if the model forgot the markdown block
                      text = text.replace(/\[\s*\{[\s\S]*\}\s*\]/g, '').trim();
                      if (!text) return null; // If message was entirely just the JSON array, render nothing
                    }

                    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    const isUser = msg.role === 'user';

                    return (
                      <div key={idx} className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                        {/* Bubble */}
                        <div className={`max-w-[90%] rounded-2xl p-4 text-xs whitespace-pre-wrap leading-relaxed shadow-lg ${isUser ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/30' : 'bg-slate-800/40 text-slate-300 border border-slate-700/50'}`}>
                          <div className="flex justify-between items-center gap-4 mb-2">
                            {isUser && <div className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">You</div>}
                            {!isUser && <div className="text-[9px] font-black uppercase text-sky-400 tracking-widest flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Assistant</div>}
                            {timeStr && <div className="text-[8px] font-bold text-slate-500">{timeStr}</div>}
                          </div>
                          {text}
                        </div>

                        {/* Inline Recommendations */}
                        {!isUser && msg.recommendations && msg.recommendations.length > 0 && (
                          <div className="flex flex-col gap-3 w-[95%]">
                            {msg.recommendations.map((rec: any, i: number) => {
                              const targetPlayer = displayPool.find(p => p.name.toLowerCase() === rec.name.toLowerCase() || p.name.includes(rec.name.split(' ')[1]));
                              const rankToDisplay = targetPlayer ? (yahooPlayers.length > 0 && yahooPlayers.find(y => normalizeName(y.name) === normalizeName(targetPlayer.name))?.rank) : rec.rank;
                              const posToDisplay = targetPlayer ? targetPlayer.pos : rec.pos;
                              const teamToDisplay = targetPlayer ? targetPlayer.team : rec.team;

                              return (
                                <div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50 hover:border-sky-500/40 transition-colors shadow-lg shadow-black/50 group relative">
                                  <div className="font-bold text-slate-100 mb-2 flex items-center justify-between gap-3 text-sm">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded flex items-center justify-center font-black text-[10px] border border-sky-500/20">#{i + 1}</span>
                                        {rec.name}
                                      </div>
                                      <div className="flex items-center gap-2 pl-7 mt-1">
                                        {rankToDisplay && <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded border border-indigo-500/20">{yahooPlayers.length > 0 ? 'AR' : 'ADP'} {rankToDisplay}</span>}
                                        {posToDisplay && <span className="text-[9px] font-bold text-slate-400 uppercase">{posToDisplay}</span>}
                                        {teamToDisplay && <span className="text-[9px] font-bold text-slate-500 uppercase px-1">• {teamToDisplay}</span>}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        const targetPlayer = displayPool.find(p =>
                                          p.name.toLowerCase() === rec.name.toLowerCase() ||
                                          p.name.toLowerCase().includes(rec.name.split(' ').pop()?.toLowerCase() || '')
                                        );
                                        const alreadyIn = myRoster.find(r => r.name.toLowerCase() === rec.name.toLowerCase());
                                        if (!alreadyIn) {
                                          const entry = targetPlayer
                                            ? { ...targetPlayer, rationale: rec.rationale }
                                            : { id: Date.now(), name: rec.name, pos: rec.pos, team: rec.team, adp: parseInt(rec.rank) || 999, rationale: rec.rationale };
                                          updateWatchlist([...myRoster, entry]);
                                        }
                                      }}
                                      className="w-6 h-6 rounded-full bg-slate-800/80 border border-slate-700 hover:bg-sky-600/30 hover:text-sky-400 hover:border-sky-500/50 transition-all flex items-center justify-center text-slate-500 md:opacity-0 group-hover:opacity-100"
                                      title="Add to Watchlist"
                                    >
                                      <UserPlus className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-[11px] text-slate-400 leading-relaxed italic border-l-[2px] border-sky-500/30 pl-2 py-1 mt-2">
                                    {rec.rationale}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isAskingAssistant && (
                <div className="space-y-4 animate-pulse mt-4 border-t border-slate-800/50 pt-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                      <div className="h-4 bg-slate-800 rounded w-1/3 mb-3"></div>
                      <div className="h-3 bg-slate-800 rounded w-full mb-2"></div>
                      <div className="h-3 bg-slate-800 rounded w-5/6"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
}
