import { getDb } from '../src/lib/db';

const sql = getDb();

async function addYahooNewsTable() {
  console.log('🔧 Adding yahoo_player_news table...\n');
  
  await sql`
    CREATE TABLE IF NOT EXISTS yahoo_player_news (
      id SERIAL PRIMARY KEY,
      league_id INT REFERENCES user_leagues(id) ON DELETE CASCADE,
      player_name VARCHAR(255) NOT NULL,
      player_name_normalized VARCHAR(255) NOT NULL,
      status VARCHAR(100),
      status_full TEXT,
      image_url TEXT,
      notes JSONB,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(league_id, player_name_normalized)
    )
  `;
  
  console.log('✅ Table created successfully');
  
  // Create index for faster lookups
  await sql`
    CREATE INDEX IF NOT EXISTS idx_yahoo_news_league_player 
    ON yahoo_player_news(league_id, player_name_normalized)
  `;
  
  console.log('✅ Index created');
}

addYahooNewsTable()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
