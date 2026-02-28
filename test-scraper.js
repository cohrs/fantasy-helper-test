const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://www.tapatalk.com/groups/asshatrotoleagues/2026-draft-player-list-t1235.html').then(res => {
  const $ = cheerio.load(res.data);
  const text = $('.content').first().text();
  console.log(text.substring(0, 3000));
  
  // also, let's just split by newlines and print first 50 lines to see structure
  console.log("-------------------");
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  console.log(lines.slice(0, 50).join('\n'));
});
