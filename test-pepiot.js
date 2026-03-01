const draftResults = require('./draft-results.json');
const myRoster = require('./my-roster.json');

const normalizeName = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+(jr|sr|ii|iii)$/, '').trim();

const p = myRoster.find(r => r.name === 'Ryan Pepiot');
if (!p) console.log('Pepiot not in roster');
else {
  const isTaken = draftResults.some(d => (d.tm || d.pos.toLowerCase().includes('round')) && normalizeName(d.name) === normalizeName(p.name));
  console.log('Is Ryan Pepiot marked taken?', isTaken);
}
