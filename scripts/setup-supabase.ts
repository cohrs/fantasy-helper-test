import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const dbUrl = process.env.SUPABASE_URL;
if (!dbUrl) { console.error('❌ SUPABASE_URL not found'); process.exit(1); }

const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  console.log('🔧 Creating schema on Supabase...\n');

  // Users table (with admin columns)
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    yahoo_guid VARCHAR(255) NOT NULL UNIQUE,
    nickname VARCHAR(255),
    email VARCHAR(255),
    image_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    role VARCHAR(20) DEFAULT 'user',
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  console.log('✅ users');

  await sql`CREATE TABLE IF NOT EXISTS user_leagues (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    league_key VARCHAR(255) NOT NULL,
    league_name VARCHAR(255),
    sport VARCHAR(50),
    season INT,
    is_active BOOLEAN DEFAULT true,
    team_name VARCHAR(255),
    team_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, league_key)
  )`;
  console.log('✅ user_leagues');

  await sql`CREATE TABLE IF NOT EXISTS user_selected_league (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    league_key VARCHAR(255) NOT NULL
  )`;
  console.log('✅ user_selected_league');

  await sql`CREATE TABLE IF NOT EXISTS draft_picks (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    round INT,
    pick INT,
    rank INT,
    player_name VARCHAR(255) NOT NULL,
    position VARCHAR(50),
    team_abbr VARCHAR(50),
    drafted_by VARCHAR(255),
    is_keeper BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  console.log('✅ draft_picks');

  await sql`CREATE TABLE IF NOT EXISTS team_rosters (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    team_key VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    player_key VARCHAR(255),
    position VARCHAR(50),
    selected_position VARCHAR(20),
    eligible_positions VARCHAR(255),
    nba_team VARCHAR(50),
    status VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_key, team_key, player_key)
  )`;
  console.log('✅ team_rosters');

  await sql`CREATE TABLE IF NOT EXISTS standings (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    team_key VARCHAR(255),
    team_name VARCHAR(255),
    rank INT,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    ties INT DEFAULT 0,
    points_for DECIMAL(10,2) DEFAULT 0,
    points_against DECIMAL(10,2) DEFAULT 0,
    stats_json JSONB
  )`;
  console.log('✅ standings');

  await sql`CREATE TABLE IF NOT EXISTS matchups (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    week INT NOT NULL,
    team1_key VARCHAR(255),
    team1_name VARCHAR(255),
    team1_points VARCHAR(50),
    team2_key VARCHAR(255),
    team2_name VARCHAR(255),
    team2_points VARCHAR(50)
  )`;
  console.log('✅ matchups');

  await sql`CREATE TABLE IF NOT EXISTS watchlist (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    user_id INT,
    player_name VARCHAR(255) NOT NULL,
    position VARCHAR(50),
    team_abbr VARCHAR(50),
    adp INT,
    rationale TEXT,
    sort_order INT DEFAULT 0
  )`;
  console.log('✅ watchlist');

  await sql`CREATE TABLE IF NOT EXISTS chat_history (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    user_id INT,
    prompt TEXT,
    raw_response TEXT,
    recommendations JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  console.log('✅ chat_history');

  await sql`CREATE TABLE IF NOT EXISTS player_notes (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    user_id INT,
    player_name VARCHAR(255),
    player_name_normalized VARCHAR(255),
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_key, user_id, player_name_normalized)
  )`;
  console.log('✅ player_notes');

  await sql`CREATE TABLE IF NOT EXISTS yahoo_player_news (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    player_key VARCHAR(255),
    player_name VARCHAR(255),
    data JSONB,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  console.log('✅ yahoo_player_news');

  await sql`CREATE TABLE IF NOT EXISTS player_stats (
    id SERIAL PRIMARY KEY,
    player_name VARCHAR(255),
    player_name_normalized VARCHAR(255),
    team_abbr VARCHAR(50),
    position VARCHAR(50),
    stats JSONB,
    season INT,
    sport VARCHAR(50) DEFAULT 'baseball',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_name_normalized, sport, season)
  )`;
  console.log('✅ player_stats');

  console.log('\n🎉 All tables created. Setting user 119 as admin (will be created on first login).');
  console.log('Note: user IDs will be different in Supabase — admin will be set on first Yahoo login.');
  await sql.end();
}

main().catch(console.error);
