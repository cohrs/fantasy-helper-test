-- Fantasy Draft Database Schema

-- Player notes from AI analysis
CREATE TABLE IF NOT EXISTS player_notes (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  player_name_normalized VARCHAR(255) NOT NULL UNIQUE,
  notes TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat history with AI assistant
CREATE TABLE IF NOT EXISTS chat_history (
  id SERIAL PRIMARY KEY,
  prompt TEXT,
  raw_response TEXT NOT NULL,
  recommendations JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Draft picks
CREATE TABLE IF NOT EXISTS draft_picks (
  id SERIAL PRIMARY KEY,
  round INT NOT NULL,
  pick INT NOT NULL UNIQUE,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50) NOT NULL,
  team_abbr VARCHAR(50),
  drafted_by VARCHAR(255),
  is_keeper BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50) NOT NULL,
  team_abbr VARCHAR(50),
  adp INT,
  rationale TEXT,
  sort_order INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player stats (current season)
CREATE TABLE IF NOT EXISTS player_stats (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  player_name_normalized VARCHAR(255) NOT NULL UNIQUE,
  team_abbr VARCHAR(50),
  position VARCHAR(50),
  stats JSONB NOT NULL,
  season INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_notes_normalized ON player_notes(player_name_normalized);
CREATE INDEX IF NOT EXISTS idx_draft_picks_pick ON draft_picks(pick);
CREATE INDEX IF NOT EXISTS idx_watchlist_order ON watchlist(sort_order);
CREATE INDEX IF NOT EXISTS idx_player_stats_normalized ON player_stats(player_name_normalized);
CREATE INDEX IF NOT EXISTS idx_player_stats_season ON player_stats(season);
