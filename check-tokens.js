import { getDb } from './src/lib/db.ts';

const sql = getDb();

sql`SELECT yahoo_guid, email, (access_token IS NOT NULL) as has_token, (refresh_token IS NOT NULL) as has_refresh, token_expires_at FROM users`
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
