eimport { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
try { const env = readFileSync('.env.local','utf8'); env.split('\n').forEach(l => { const [k,...v] = l.split('='); if(k&&v.length) process.env[k.trim()]=v.join('=').trim(); }); } catch(e){}
const sql = neon(process.env.POSTGRES_URL, { fetchOptions: { cache: 'no-store' } });
const allTeams = ['Amazins','Brohams','Timberwolves','Cubs Win Cubs Win','Dillweed','Hulkamania','1st to 3rd','Pirates Baseball','K-Bandits','The Papelboners','New Jersey Nine','Jack McKeon','Jungle Town Piranhas','JP','No Talent Ass Clowns','The Joshua Trees','Mountain Diehards','Mdub321'];
for (const rd of [4, 6]) {
  const picks = await sql`SELECT drafted_by FROM draft_picks WHERE league_id = 2 AND round = ${rd} AND is_keeper = false`;
  const teams = picks.map(p => p.drafted_by);
  const missing = allTeams.filter(t => !teams.includes(t));
  const dupes = allTeams.filter(t => teams.filter(x => x === t).length > 1);
  console.log(`R${rd}: missing=${JSON.stringify(missing)} dupes=${JSON.stringify(dupes)}`);
}
process.exit(0);
d 