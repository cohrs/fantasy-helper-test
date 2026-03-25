'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [leagueName, setLeagueName] = useState('');
  const [sport, setSport] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('selectedLeague');
    if (stored) {
      try {
        const league = JSON.parse(stored);
        setLeagueId(league.id);
        setLeagueName(league.league_name || league.name || '');
        setSport(league.sport || '');
      } catch {}
    }
  }, []);

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
        body: JSON.stringify({
          message: userMsg,
          chatHistory: messages,
          leagueId,
        }),
      });

      const data = await resp.json();
      if (data.error) {
        setMessages([...newMessages, {
          role: 'model',
          parts: [{ text: `Error: ${data.error}` }],
          timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages([...newMessages, {
          role: 'model',
          parts: [{ text: data.message }],
          timestamp: new Date().toISOString(),
        }]);
      }
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

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Fantasy Assistant</h1>
            {leagueName && (
              <p className="text-xs text-slate-400">{leagueName} {sport ? `• ${sport}` : ''}</p>
            )}
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-1 rounded-lg hover:bg-slate-800"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
            <div className="text-6xl">{sport === 'basketball' ? '🏀' : '⚾'}</div>
            <p className="text-lg font-medium">Ask me anything about your team</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                'Who should I pick up to replace Burnes?',
                'How are my DTD players looking?',
                'Analyze my pitching staff',
                'Who should I start this week?',
                'Any good buy-low trade targets?',
              ].map((suggestion) => (
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
