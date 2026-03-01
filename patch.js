const fs = require('fs');
let code = fs.readFileSync('src/app/draft-room/page.tsx', 'utf8');

// 1. Add DraftBoardPlayerRow before Home()
const homeIndex = code.indexOf('export default function Home() {');
const draftBoardComponent = `
const DraftBoardPlayerRow = React.memo(({ p, yahooStats, yahooPlayers, updateWatchlist, activeSport, myRoster, BATTING_STAT_IDS, PITCHING_STAT_IDS, YAHOO_STAT_LABELS }: any) => {
  const isPitcher = /SP|RP|P/i.test(p.pos);
  const ids = isPitcher ? PITCHING_STAT_IDS : BATTING_STAT_IDS;
  
  return (
    <div className={\`px-4 py-3 rounded-2xl flex justify-between items-center transition-all \${p.takenBy ? 'bg-slate-900/30 border border-slate-800/20 opacity-50' : 'bg-slate-950 border border-slate-800/50 hover:border-indigo-500/40'}\`}>
      <div className="flex items-center gap-4">
        <div className="w-10 text-center font-black text-[9px] leading-tight text-indigo-400 tabular-nums">
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
        <div>
          <div className="flex items-center gap-2">
            <span className={\`font-bold text-sm \${p.takenBy ? 'text-slate-500 line-through' : 'text-slate-100'}\`}>{p.name}</span>
            {p.yahooStatus && <span className="text-[9px] font-black bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full uppercase">{p.yahooStatus}</span>}
            {p.isKeeper && <span className="text-[9px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full uppercase">K</span>}
            {p.yahooHasNotes && !p.takenBy && <span title="Has player news" className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />}
          </div>
          <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">
            {p.team}
            <span className="text-indigo-500 ml-2">{p.pos}</span>
            {p.yahooStatusFull && !p.takenBy && <span className="text-red-400/70 ml-2">{p.yahooStatusFull}</span>}
            {p.takenBy && <span className="text-slate-600 ml-2">• {p.takenBy}</span>}
          </div>
          {p.yahooRecentNote && !p.takenBy && (
            <div className="mt-2 text-xs text-slate-400/90 leading-snug border-l-2 border-sky-500/30 pl-2 py-0.5 italic">
              {p.yahooRecentNote}
            </div>
          )}
          {Object.keys(yahooStats).length > 0 && !p.takenBy && (() => {
            const pStats = yahooStats[p.name.toLowerCase()];
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
        </div>
      </div>
      {!p.takenBy && (
        <button onClick={() => updateWatchlist([...myRoster, { id: p.id, name: p.name, pos: p.pos, team: p.team || 'FA', adp: p.adp }])} className="bg-slate-800 hover:bg-indigo-600 p-3 rounded-xl transition-all active:scale-90">
          <UserPlus className="w-4 h-4 text-white" />
        </button>
      )}
    </div>
  );
});
DraftBoardPlayerRow.displayName = 'DraftBoardPlayerRow';

`;

code = code.slice(0, homeIndex) + draftBoardComponent + code.slice(homeIndex);

// 2. Add processedPool hook
const poolHook = `

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
        const positions = p.pos.toUpperCase().split(/[\\/,]+/);
        if (!positions.includes(positionFilter)) return false;
      }
      return true;
    });

    // 4. Sort
    if (statSort && Object.keys(yahooStats).length > 0) {
      copy.sort((a, b) => {
        const aStats = yahooStats[a.name.toLowerCase()];
        const bStats = yahooStats[b.name.toLowerCase()];
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
`;

const searchStr = `const [watchlistSort, setWatchlistSort] = useState<'original' | 'rank-asc' | 'rank-desc'>('original');`;
const hookIndex = code.indexOf(searchStr);
if (hookIndex !== -1) {
    code = code.slice(0, hookIndex + searchStr.length) + poolHook + code.slice(hookIndex + searchStr.length);
}

// 3. Replace giant inline map
const startStr = '{(() => {\\n                    const search = searchTerm.toLowerCase();';
const altStartStr = '{(() => {\n                    const search = searchTerm.toLowerCase();';
const endStr = '                      </div>\\n                    ));\\n                  })()}';
const altEndStr = '                      </div>\n                    ));\n                  })()}';

let startPatchIndex = code.indexOf(altStartStr);
let endPatchIndex = code.indexOf(altEndStr);

if (startPatchIndex !== -1 && endPatchIndex !== -1) {
    const replacement = `{processedPool.map((p: any) => (
                    <DraftBoardPlayerRow
                      key={p.id}
                      p={p}
                      yahooStats={yahooStats}
                      yahooPlayers={yahooPlayers}
                      updateWatchlist={updateWatchlist}
                      activeSport={activeSport}
                      myRoster={myRoster}
                      BATTING_STAT_IDS={BATTING_STAT_IDS}
                      PITCHING_STAT_IDS={PITCHING_STAT_IDS}
                      YAHOO_STAT_LABELS={YAHOO_STAT_LABELS}
                    />
                  ))}`;
    code = code.slice(0, startPatchIndex) + replacement + code.slice(endPatchIndex + altEndStr.length);
    fs.writeFileSync('src/app/draft-room/page.tsx', code);
    console.log('patched successfully');
} else {
    console.error('could not find block to replace', { startPatchIndex, endPatchIndex });
}
