const fs = require('fs');
let code = fs.readFileSync('src/app/draft-room/page.tsx', 'utf8');

// Find the processedPool hook
const poolHookStart = "  const processedPool = useMemo(() => {";
const poolHookEnd = "  }, [displayPool, searchTerm, showDrafted, draftResults, positionFilter, statSort, yahooStats, yahooPlayers, activeSport]);";

const startIndex = code.indexOf(poolHookStart);
const endIndex = code.indexOf(poolHookEnd) + poolHookEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
    const poolHook = code.slice(startIndex, endIndex) + "\\n";
    code = code.slice(0, startIndex) + code.slice(endIndex);

    // Find displayPool and insert it after
    const displayPoolEnd = "  }, [searchTerm, myRoster, draftResults, showDrafted, positionFilter, aiNotes]);\\n";
    const dpEndIndex = code.indexOf(displayPoolEnd) + displayPoolEnd.length;

    if (dpEndIndex !== -1 + displayPoolEnd.length) {
        code = code.slice(0, dpEndIndex) + "\\n" + poolHook + code.slice(dpEndIndex);
        fs.writeFileSync('src/app/draft-room/page.tsx', code);
        console.log("Moved processedPool after displayPool successfully.");
    } else {
        console.error("Could not find displayPool block end");
    }
} else {
    console.error("Could not find processedPool hook");
}
