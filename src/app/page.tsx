"use client";

import React, { useState } from 'react';
import { Trophy, ChevronRight, Users, Activity, Flame, ArrowRight, ShieldAlert, Zap } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const features = [
    { icon: <Users size={24} />, title: "Elite Roster Management", desc: "Advanced tools to dominate the waiver wire and optimize your weekly lineup." },
    { icon: <Activity size={24} />, title: "Real-time Projections", desc: "Live scoring updates and predictive algorithms to give you the edge." },
    { icon: <Flame size={24} />, title: "Trash Talk Hub", desc: "Integrated banter platform because winning isn't enough; they must hurt." },
    { icon: <Zap size={24} />, title: "Instant Trade Analysis", desc: "AI-powered trade evaluator to ensure you never get fleeced again." },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <Trophy className="text-indigo-400" size={28} />
          <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            Asshat<span className="text-indigo-400">Fantasy</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#league" className="hover:text-white transition-colors">League Info</a>
          <a href="#hall-of-shame" className="hover:text-white transition-colors">Hall of Shame</a>
        </div>
        <button className="px-5 py-2.5 bg-white text-zinc-950 font-semibold rounded-full text-sm hover:bg-indigo-50 transition-all flex items-center gap-2">
          Join League <ChevronRight size={16} />
        </button>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-32 pb-20 px-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-indigo-300 mb-8 backdrop-blur-md">
          <ShieldAlert size={14} /> Only for the truly degenerate.
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white via-slate-200 to-indigo-400">
          Dominate the <br /> 2026 Season.
        </h1>
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          The ultimate platform for the Asshat Fantasy league. Prepare for relentless competition, ruined friendships, and eternal glory.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/select-league" className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-full transition-all flex items-center gap-2 shadow-[0_0_30px_-5px_rgba(79,70,229,0.5)] hover:shadow-[0_0_40px_-5px_rgba(79,70,229,0.7)] hover:-translate-y-1">
            Select Your League <ArrowRight size={20} />
          </Link>
          <Link href="/draft-room" className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold rounded-full transition-all flex items-center gap-2">
            Go to Draft Room
          </Link>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-4 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`p-6 rounded-3xl border transition-all duration-300 ${hoveredCard === idx
                  ? 'bg-zinc-900 border-indigo-500/50 shadow-xl shadow-indigo-500/10 -translate-y-2'
                  : 'bg-zinc-900/50 border-white/5'
                }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-colors ${hoveredCard === idx ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-indigo-400'
                }`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12 py-8 text-center text-slate-500 text-sm">
        <p>© 2026 Asshat Fantasy League. All rights reversed. Don't sue us.</p>
      </footer>
    </div>
  );
}
