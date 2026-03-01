const axios = require('axios');

(async () => {
    const { data } = await axios.get("https://www.tapatalk.com/groups/asshatrotoleagues/2026-draft-player-list-t1235.html", {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    let cleanContent = data.replace(/&nbsp;/g, " ")
        .replace(/&#160;/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/&middot;/g, "·");
    cleanContent = cleanContent.replace(/<\/?[^>]+(>|$)/g, "\n");

    const lines = cleanContent.split('\n');
    lines.forEach(line => {
        if (line.toLowerCase().includes('115')) {
            console.log("Raw line for 115:", line.trim());
        }
        if (line.toLowerCase().includes('pepiot')) {
            console.log("Raw line for pepiot:", line.trim());
        }
    });
})();
