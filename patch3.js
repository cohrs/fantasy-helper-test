const fs = require('fs');
let code = fs.readFileSync('src/app/draft-room/page.tsx', 'utf8');

// 1. Add drag/drop props to WatchlistItem
const wItemOld = `const WatchlistItem = ({
  player, activeSport, isTaken, isFirst, isLast, onMoveUp, onMoveDown, onDelete
}: {
  player: any; activeSport: string; isTaken: boolean; isFirst: boolean; isLast: boolean;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
}) => {
  const [showNotes, setShowNotes] = useState(false);
  return (
    <div className={\`bg-slate-950 rounded-xl border \${isTaken ? 'border-slate-800/30 opacity-50' : 'border-slate-800/50 hover:border-slate-700/50'} group transition-all relative overflow-hidden\`}>`;

const wItemNew = `const WatchlistItem = ({
  player, activeSport, isTaken, isFirst, isLast, onMoveUp, onMoveDown, onDelete,
  index, draggedIndex, dragOverIndex, onDragStart, onDragOver, onDragEnd, onDrop
}: {
  player: any; activeSport: string; isTaken: boolean; isFirst: boolean; isLast: boolean;
  onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
  index: number; draggedIndex: number | null; dragOverIndex: number | null;
  onDragStart: (idx: number) => void; onDragOver: (idx: number) => void; onDragEnd: () => void; onDrop: (idx: number) => void;
}) => {
  const [showNotes, setShowNotes] = useState(false);
  
  // Visual feedback logic
  let borderOverride = '';
  if (dragOverIndex === index && draggedIndex !== index) {
    if (draggedIndex! > index) borderOverride = 'border-t-2 border-t-indigo-500';
    else borderOverride = 'border-b-2 border-b-indigo-500';
  }

  return (
    <div 
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(index); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(index); }}
      onDragEnd={onDragEnd}
      className={\`bg-slate-950 rounded-xl border \${isTaken ? 'border-slate-800/30 opacity-50' : 'border-slate-800/50 hover:border-slate-700/50'} \${draggedIndex === index ? 'opacity-30' : ''} \${borderOverride} group transition-all relative overflow-hidden\`}
    >`;

code = code.replace(wItemOld, wItemNew);

// 2. Add drag state to Home
const homeStateOld = `  const [watchlistSort, setWatchlistSort] = useState<'original' | 'rank-asc' | 'rank-desc'>('original');`;
const homeStateNew = `  const [watchlistSort, setWatchlistSort] = useState<'original' | 'rank-asc' | 'rank-desc'>('original');

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
  };`;

code = code.replace(homeStateOld, homeStateNew);

// 3. Update WatchlistItem invocation
const invocationOld = `                    <WatchlistItem
                      key={p.p.id}
                      player={p.p}
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
                    />`;

const invocationNew = `                    <WatchlistItem
                      key={p.p.id}
                      player={p.p}
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
                    />`;

code = code.replace(invocationOld, invocationNew);

fs.writeFileSync('src/app/draft-room/page.tsx', code);
console.log('Patch 3 complete.');
