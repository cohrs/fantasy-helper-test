const fs = require('fs');
const htmlContent = fs.readFileSync('tapatalk_raw.html', 'utf8');

const draftOrder = [
    "Mdub",
    "K-Bandits",
    "Pirates Baseball",
    "No Talent Ass Clowns",
    "Mountain Diehards",
    "No Talent Ass Clowns", // 6
    "Jack McKeon",
    "1st to 3rd",
    "Jack McKeon", // 9 
    "Pirates Baseball", // 10
    "No Talent Ass Clowns", // 11
    "No Talent Ass Clowns", // 12
    "Brohams",
    "Mountain Diehards", // 14
    "The Joshua Trees",
    "1st to 3rd", // 16
    "Jack McKeon", // 17
    "No Talent Ass Clowns" // 18
]; // Will fall back to straight 1-18 repeating if not traded

// Let's establish the raw order of teams to loop through indefinitely for non-traded later rounds
const baseOrder = [
    "Mdub", "K-Bandits", "Pirates Baseball", "No Talent Ass Clowns", "Mountain Diehards", "The Papelboners", "Jack McKeon", "1st to 3rd", "New Jersey Nine", "JP", "Brohams", "Hulkamania", "Amazins", "Timber Wolves", "The Joshua Trees", "Jungle Town Piranhas", "Cubs Win Cubs Win", "Chitown"
];

let cleanContent = htmlContent.replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/&middot;/g, "·");
cleanContent = cleanContent.replace(/<\/?[^>]+(>|$)/g, "\n");

const lines = cleanContent.split('\n');
const results = [];

lines.forEach((line) => {
    const cleanLine = line.trim();
    const pkMatch = cleanLine.match(/(\d+)\.\s+/);

    if (pkMatch) {
        const pk = parseInt(pkMatch[1]);
        const rd = Math.floor((pk - 1) / 18) + 1;
        const indexInRound = (pk - 1) % 18;

        let tm = "";
        let isKeeper = false;
        let name = "";
        let pos = "";
        let playerTeam = "";

        // Determine Team Owner: Use hardcoded Round 1 trades if in rd 1, else use base straight order
        if (pk <= 18) {
            tm = draftOrder[pk - 1];
        } else {
            tm = baseOrder[indexInRound];
        }

        if (cleanLine.includes("Keeper")) {
            // Keepers have explicit team names at the end: `1. Shohei Ohtani (Batter) LAD - Util - Keeper - Mdub`
            isKeeper = true;
            let keeperSplit = cleanLine.split(/-\s*Keeper\s*-/i);
            if (keeperSplit.length === 2) {
                // Override the team if explicitly traded later
                tm = keeperSplit[1].trim();
                let baseStr = keeperSplit[0].substring(pkMatch[0].length + cleanLine.indexOf(pkMatch[0])).trim();
                let parts = baseStr.split('-');
                name = parts[0].trim();
                if (parts.length > 1) pos = parts[1].trim();
            }
        } else {
            // Non keepers look like: `42. Spencer Schwellenbach ATL - SP`
            let baseStr = cleanLine.substring(pkMatch[0].length + cleanLine.indexOf(pkMatch[0])).trim();
            let parts = baseStr.split('-');
            name = parts[0].trim();
            if (parts.length > 1) pos = parts[1].trim();
        }

        // Let's strip the trailing team from the name if present (e.g. "Pete Alonso BAL ")
        const lastSpace = name.lastIndexOf(' ');
        if (lastSpace > 0) {
            playerTeam = name.substring(lastSpace + 1).trim();
            // If it's a team abbv like BAL, LAD, etc
            if (playerTeam === playerTeam.toUpperCase() && playerTeam.length >= 2 && playerTeam.length <= 3) {
                name = name.substring(0, lastSpace).trim();
            } else {
                playerTeam = ""; // Not a valid team abbreviation suffix
            }
        }

        results.push({ rd, pk, name, pos, tm, playerTeam, isKeeper });
    }
});

console.log(`Found ${results.length} picks!`);
if (results.length > 0) {
    console.log("Saving to draft-results.json...");
    fs.writeFileSync('draft-results.json', JSON.stringify(results, null, 2));
}
