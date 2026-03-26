'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Trophy, LayoutGrid, MessageSquare, Plus, Check, LogIn, LogOut } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp?: string;
}

// Regex to find player names in AI responses — looks for patterns like "Name (TEAM, POS)" or "**Name**"
function extractPlayerMentions(text: string): { name: string; team?: string; pos?: string }[] {
  const players: { name: string; team?: string; pos?: string }[] = [];
  const seen = new Set<string>();

  // Pattern: "Player Name (TEAM, POS)" — common in assistant responses
  const parenPattern = /([A-Z][a-zA-Z'.]+(?:\s+[A-Z][a-zA-Z'.]+)+)\s*\(([A-Z]{2,4}),\s*([A-Z/0-9]+)\)/g;
  let match;
  while ((match = parenPattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      players.push({ name, team: match[2], pos: match[3] });
    }
  }

  return players;
}

function WatchlistButton({ player, leagueKey, watchlistNames, onAdded }: {
  player: { name: string; team?: string; pos?: string };
  leagueKey: string | null;
  watchlistNames: Set<string>;
  onAdded: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const isOnWatchlist = watchlistNames.has(player.name.toLowerCase());

  const handleAdd = async () => {
    if (isOnWatchlist || adding || !leagueKey) return;
    setAdding(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: player.name, pos: player.pos, team: player.team, leagueKey }),
      });
      const data = await res.json();
      if (data.success) {
        onAdded(player.name);
      }
    } catch {
      // silent fail
    } finally {
      setAdding(false);
    }
  };

  if (isOnWatchlist) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
        <Check className="w-3 h-3" /> On Watchlist
      </span>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={adding}
      className="inline-flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
    >
      <Plus className="w-3 h-3" />
      {adding ? 'Adding...' : 'Watchlist'}
    </button>
  );
}

function PlayerMentions({ text, leagueKey, watchlistNames, onAdded }: {
  text: string;
  leagueKey: string | null;
  watchlistNames: Set<string>;
  onAdded: (name: string) => void;
}) {
  const players = extractPlayerMentions(text);
  if (players.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/50">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Players mentioned</p>
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <div key={p.name} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
            <span className="text-xs text-slate-300">{p.name}</span>
            {p.team && <span className="text-[10px] text-slate-500">{p.team}</span>}
            {p.pos && <span className="text-[10px] text-slate-500">{p.pos}</span>}
            <WatchlistButton player={p} leagueKey={leagueKey} watchlistNames={watchlistNames} onAdded={onAdded} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [leagueKey, setLeagueKey] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState('');
  const [sport, setSport] = useState('');
  const [watchlistNames, setWatchlistNames] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('selectedLeague');
    if (stored) {
      try {
        const league = JSON.parse(stored);
        setLeagueKey(league.league_key);
        setLeagueName(league.league_name || league.name || '');
        setSport(league.sport || '');
      } catch {}
    }
  }, []);

  // Load watchlist names for the current league
  const loadWatchlist = useCallback(async () => {
    if (!leagueKey) return;
    try {
      const res = await fetch(`/api/watchlist?leagueKey=${leagueKey}`);
      const data = await res.json();
      if (data.success) {
        setWatchlistNames(new Set(data.players.map((n: string) => n.toLowerCase())));
      }
    } catch {}
  }, [leagueKey]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const handlePlayerAdded = (name: string) => {
    setWatchlistNames(prev => new Set([...prev, name.toLowerCase()]));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', parts: [{ text: userMsg }], timestamp: new Date().toISOString() },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const resp = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, chatHistory: messages, leagueKey }),
      });

      const data = await resp.json();
      const responseText = data.error ? `Error: ${data.error}` : data.message;
      setMessages([...newMessages, {
        role: 'model',
        parts: [{ text: responseText }],
        timestamp: new Date().toISOString(),
      }]);
    } catch {
      setMessages([...newMessages, {
        role: 'model',
        parts: [{ text: 'Failed to reach the assistant. Check your connection.' }],
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sportEmoji = sport === 'basketball' ? '🏀' : '⚾';

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header with nav */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
            <Trophy className="text-indigo-400" size={20} />
            <span className="text-sm font-bold tracking-tight">
              Asshat<span className="text-indigo-400">Fantasy</span>
            </span>
          </Link>
          <span className="text-slate-700">|</span>
          <Link href="/draft-room" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <LayoutGrid size={14} /> Draft Room
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
            <MessageSquare size={14} /> Chat
          </span>
        </div>
        <div className="flex items-center gap-3">
          {leagueName && (
            <span className="text-xs text-slate-400">{sportEmoji} {leagueName}</span>
          )}
          {session ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 px-3 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogOut size={12} /> {session.user?.name || 'Sign Out'}
            </button>
          ) : (
            <button
              onClick={() => signIn('yahoo')}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LogIn size={12} /> Sign In
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1 rounded-lg hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
            <div className="text-6xl">{sportEmoji}</div>
            <p className="text-lg font-medium">Ask me anything about your team</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {(sport === 'basketball' ? [
                'Who should I pick up off waivers?',
                'Analyze my roster strengths and weaknesses',
                'Any good buy-low trade targets?',
                'Who should I sit this week?',
                'Which categories should I punt?',
              ] : [
                'Who should I pick up to replace Burnes?',
                'How are my DTD players looking?',
                'Analyze my pitching staff',
                'Who should I start this week?',
                'Any good buy-low trade targets?',
              ]).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  className="text-xs px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors border border-slate-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-200 border border-slate-700'
            }`}>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.parts[0]?.text}</div>
              {msg.timestamp && (
                <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-sky-200' : 'text-slate-500'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
              )}
              {msg.role === 'model' && (
                <PlayerMentions
                  text={msg.parts[0]?.text || ''}
                  leagueKey={leagueKey}
                  watchlistNames={watchlistNames}
                  onAdded={handlePlayerAdded}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your roster, injuries, pickups, trades..."
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium text-sm transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
