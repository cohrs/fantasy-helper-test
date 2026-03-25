-- Fantasy Draft Database Schema (league_key based)

-- User sessions and league selections
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  yahoo_guid VARCHAR(255) NOT NULL UNIQUE,
  nickname VARCHAR(255),
  email VARCHAR(255),
  image_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User's Yahoo leagues
CREATE TABLE IF NOT EXISTS user_leagues (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  league_key VARCHAR(255) NOT NULL,
  league_name VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  season INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  team_key VARCHAR(255),
  team_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, league_key)
);

-- User's selected league (one per user)
CREATE TABLE IF NOT EXISTS user_selected_league (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  league_key VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player notes from AI analysis (league-specific)
CREATE TABLE IF NOT EXISTS player_notes (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  player_name_normalized VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(league_key, player_name_normalized)
);

-- Yahoo player news cache (league-specific)
CREATE TABLE IF NOT EXISTS yahoo_player_news (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  player_name_normalized VARCHAR(255) NOT NULL,
  status VARCHAR(100),
  status_full TEXT,
  image_url TEXT,
  notes JSONB,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(league_key, player_name_normalized)
);

-- Chat history with AI assistant (league-specific)
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  prompt TEXT,
  raw_response TEXT NOT NULL,
  recommendations JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Draft picks (league-specific)
CREATE TABLE IF NOT EXISTS draft_picks (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  round INT NOT NULL,
  pick INT,
  rank INT,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50) NOT NULL,
  team_abbr VARCHAR(50),
  drafted_by VARCHAR(255),
  is_keeper BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User watchlist (league-specific)
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50) NOT NULL,
  team_abbr VARCHAR(50),
  adp INT,
  rationale TEXT,
  sort_order INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player stats (current season) - sport-specific, NOT league-specific
CREATE TABLE IF NOT EXISTS player_stats (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  player_name_normalized VARCHAR(255) NOT NULL,
  team_abbr VARCHAR(50),
  position VARCHAR(50),
  stats JSONB NOT NULL,
  season INT NOT NULL,
  sport VARCHAR(50) NOT NULL DEFAULT 'baseball',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_name_normalized, sport, season)
);

-- League standings (current season)
CREATE TABLE IF NOT EXISTS standings (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  team_key VARCHAR(255) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  rank INT,
  wins INT,
  losses INT,
  ties INT,
  points_for DECIMAL,
  points_against DECIMAL,
  stats_json JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Current team rosters (in-season)
CREATE TABLE IF NOT EXISTS team_rosters (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  team_key VARCHAR(255) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  player_key VARCHAR(255),
  position VARCHAR(50),
  nba_team VARCHAR(50),
  status VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly matchups/scoreboard
CREATE TABLE IF NOT EXISTS matchups (
  id SERIAL PRIMARY KEY,
  league_key VARCHAR(255) NOT NULL,
  week INT NOT NULL,
  team1_key VARCHAR(255),
  team1_name VARCHAR(255),
  team1_points DECIMAL,
  team1_wins INT DEFAULT 0,
  team1_losses INT DEFAULT 0,
  team1_ties INT DEFAULT 0,
  team2_key VARCHAR(255),
  team2_name VARCHAR(255),
  team2_points DECIMAL,
  team2_wins INT DEFAULT 0,
  team2_losses INT DEFAULT 0,
  team2_ties INT DEFAULT 0,
  is_playoffs BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_yahoo_guid ON users(yahoo_guid);
CREATE INDEX IF NOT EXISTS idx_user_leagues_user_id ON user_leagues(user_id);
CREATE INDEX IF NOT EXISTS idx_user_leagues_sport ON user_leagues(sport);
CREATE INDEX IF NOT EXISTS idx_draft_picks_league_key ON draft_picks(league_key);
CREATE INDEX IF NOT EXISTS idx_watchlist_league_key ON watchlist(league_key);
CREATE INDEX IF NOT EXISTS idx_watchlist_order ON watchlist(sort_order);
CREATE INDEX IF NOT EXISTS idx_standings_league_key ON standings(league_key);
CREATE INDEX IF NOT EXISTS idx_team_rosters_league_key ON team_rosters(league_key);
CREATE INDEX IF NOT EXISTS idx_chat_history_league_key ON chat_history(league_key);
CREATE INDEX IF NOT EXISTS idx_player_notes_league_key ON player_notes(league_key);
CREATE INDEX IF NOT EXISTS idx_yahoo_player_news_league_key ON yahoo_player_news(league_key);
CREATE INDEX IF NOT EXISTS idx_player_stats_normalized ON player_stats(player_name_normalized);
CREATE INDEX IF NOT EXISTS idx_player_stats_season ON player_stats(season);
CREATE INDEX IF NOT EXISTS idx_player_stats_sport ON player_stats(sport);
