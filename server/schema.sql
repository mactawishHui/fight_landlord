-- ── 斗地主 MySQL Schema ────────────────────────────────────────────────────────
-- Used as a supplement to WeChat Cloud DB for complex queries / reporting.
-- Run: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS fight_landlord CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fight_landlord;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  openid      VARCHAR(64)  NOT NULL UNIQUE COMMENT 'WeChat openid',
  nickname    VARCHAR(64)  NOT NULL DEFAULT '玩家',
  avatar_url  VARCHAR(512) NOT NULL DEFAULT '',
  total_score INT          NOT NULL DEFAULT 0,
  total_wins  INT UNSIGNED NOT NULL DEFAULT 0,
  total_losses INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_total_score (total_score DESC),
  INDEX idx_openid (openid)
) ENGINE=InnoDB;

-- ── Rooms ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_code   VARCHAR(16)  NOT NULL UNIQUE COMMENT 'Human-readable short code, e.g. AB12CD',
  status      ENUM('waiting','playing','finished') NOT NULL DEFAULT 'waiting',
  max_players TINYINT      NOT NULL DEFAULT 3,
  game_state  JSON         COMMENT 'Serialised GameState (updated on each action)',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_room_code (room_code),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ── Room players (who is in which room) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_players (
  room_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  slot        TINYINT  NOT NULL DEFAULT 0 COMMENT '0=first, 1=second, 2=third',
  joined_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── Match records ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  room_id       BIGINT UNSIGNED NULL COMMENT 'NULL for solo games',
  winner_openid VARCHAR(64) NOT NULL,
  winner_team   ENUM('landlord','farmers') NOT NULL,
  base_score    SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  multiplier    TINYINT  UNSIGNED NOT NULL DEFAULT 1,
  final_score   SMALLINT UNSIGNED NOT NULL,
  is_multiplayer TINYINT(1) NOT NULL DEFAULT 0,
  played_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_played_at (played_at DESC),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Match participants ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_players (
  match_id    BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  openid      VARCHAR(64) NOT NULL,
  is_landlord TINYINT(1) NOT NULL DEFAULT 0,
  score_delta INT         NOT NULL DEFAULT 0,
  is_winner   TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id),
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ── Leaderboard view ─────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.openid,
  u.nickname,
  u.avatar_url,
  u.total_score,
  u.total_wins,
  u.total_losses,
  ROUND(u.total_wins * 100.0 / NULLIF(u.total_wins + u.total_losses, 0), 1) AS win_rate,
  RANK() OVER (ORDER BY u.total_score DESC) AS `rank`
FROM users u
WHERE u.total_wins + u.total_losses > 0
ORDER BY u.total_score DESC;
