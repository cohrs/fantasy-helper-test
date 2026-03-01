const lines = [
    "·   115. Ryan Pepiot TB - SP 2nd Round - Amazins",
    "·   72. Riley Greene DET - LF,CF,RF - Keeper - Mountain Diehards",
    "·   1. Fernando Tatis Jr. SD - RF"
];

lines.forEach(line => {
    const pkMatch = line.trim().match(/(?:·*\s*)(\d+)\.\s+/);
    if (pkMatch) {
        const pk = parseInt(pkMatch[1]);
        const startIdx = line.trim().indexOf(pkMatch[0]) + pkMatch[0].length;
        let namePart = line.trim().substring(startIdx);
        let tm = null;
        let isKeeper = false;
        let forcedRound = null;

        const keeperMatch = namePart.match(/-\s*Keeper\s*-?\s*(.*)/i);
        if (keeperMatch) {
            tm = keeperMatch[1].trim();
            isKeeper = true;
            namePart = namePart.replace(keeperMatch[0], '').trim();
        } else {
            // Note: the original regex was /-\s*(\d+)(?:st|nd|rd|th)\s+Round\s*-\s*(.*)/i
            // Pepiot has "- SP 2nd Round - Amazins" which doesn't match because of "SP ". 
            // So we need to match (\d+)(?:st|nd|rd|th)\s+Round\s*-\s*(.*) without strictly requiring the '-' right before the digit.
            const roundMatch = namePart.match(/(\d+)(?:st|nd|rd|th)\s+Round\s*-\s*(.*)/i);
            if (roundMatch) {
                forcedRound = parseInt(roundMatch[1]);
                tm = roundMatch[2].trim();
                namePart = namePart.replace(roundMatch[0], '').trim();
            }
        }

        let nameSplit = namePart.split('-');
        let nameRaw = nameSplit[0].trim();
        let pos = nameSplit.length > 1 ? nameSplit[1].trim() : "UTIL";

        let nameWords = nameRaw.split(' ');
        let playerTeam = nameWords.pop() || "FA";
        let name = nameWords.join(' ');

        console.log(`Pick: ${pk}, Name: '${name}', Pos: '${pos}', Team: '${playerTeam}', Tm: '${tm}', isKeeper: ${isKeeper}, forcedRound: ${forcedRound}`);
    }
});
