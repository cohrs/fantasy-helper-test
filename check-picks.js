import { getDb } from './src/lib/db.ts';

const sql = getDb();

sql`SELECT league_id, COUNT(*) as count FROM draft_picks GROUP BY league_id`
  .then(r => {
    console.log('Draft picks by league_id:');
    r.forEach(row => console.log(`  League ${row.league_id}: ${row.count} picks`));
  })
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
