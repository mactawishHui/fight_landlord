/**
 * MySQL connection pool + query helpers.
 * Uses mysql2 with promise API.
 */
import mysql from 'mysql2/promise';
import { User } from './types';

let _pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool({
      host:     process.env.DB_HOST     ?? '127.0.0.1',
      port:     Number(process.env.DB_PORT ?? 3306),
      user:     process.env.DB_USER     ?? 'root',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME     ?? 'fight_landlord',
      waitForConnections: true,
      connectionLimit: 10,
      timezone: '+00:00',
    });
  }
  return _pool;
}

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params as any);
  return rows as T[];
}

// ── User helpers ──────────────────────────────────────────────────────────────

export async function upsertUser(openid: string, nickname: string, avatarUrl: string): Promise<User> {
  await query(
    `INSERT INTO users (openid, nickname, avatar_url, last_login)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       nickname   = VALUES(nickname),
       avatar_url = VALUES(avatar_url),
       last_login = NOW()`,
    [openid, nickname, avatarUrl]
  );
  const rows = await query<any>(`SELECT * FROM users WHERE openid = ?`, [openid]);
  const u = rows[0];
  return {
    id: u.id,
    openid: u.openid,
    nickname: u.nickname,
    avatarUrl: u.avatar_url,
    totalScore: u.total_score,
    totalWins: u.total_wins,
    totalLosses: u.total_losses,
  };
}

export async function getUserByOpenid(openid: string): Promise<User | null> {
  const rows = await query<any>(`SELECT * FROM users WHERE openid = ?`, [openid]);
  if (!rows[0]) return null;
  const u = rows[0];
  return { id: u.id, openid: u.openid, nickname: u.nickname, avatarUrl: u.avatar_url, totalScore: u.total_score, totalWins: u.total_wins, totalLosses: u.total_losses };
}

export async function updateUserStats(openid: string, scoreDelta: number, isWin: boolean): Promise<void> {
  await query(
    `UPDATE users SET
       total_score   = total_score + ?,
       total_wins    = total_wins + ?,
       total_losses  = total_losses + ?
     WHERE openid = ?`,
    [scoreDelta, isWin ? 1 : 0, isWin ? 0 : 1, openid]
  );
}

export async function getLeaderboard(limit = 20): Promise<User[]> {
  const rows = await query<any>(
    `SELECT * FROM leaderboard LIMIT ?`,
    [limit]
  );
  return rows.map((u: any) => ({
    id: u.id, openid: u.openid, nickname: u.nickname,
    avatarUrl: u.avatar_url, totalScore: u.total_score,
    totalWins: u.total_wins, totalLosses: u.total_losses,
  }));
}

// ── Match helpers ─────────────────────────────────────────────────────────────

export async function saveMatch(opts: {
  roomId: number | null;
  winnerOpenid: string;
  winnerTeam: 'landlord' | 'farmers';
  baseScore: number;
  multiplier: number;
  finalScore: number;
  isMultiplayer: boolean;
  players: Array<{ openid: string; isLandlord: boolean; scoreDelta: number; isWinner: boolean }>;
}): Promise<void> {
  const [result] = await getPool().execute<mysql.ResultSetHeader>(
    `INSERT INTO matches (room_id, winner_openid, winner_team, base_score, multiplier, final_score, is_multiplayer)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [opts.roomId, opts.winnerOpenid, opts.winnerTeam, opts.baseScore, opts.multiplier, opts.finalScore, opts.isMultiplayer ? 1 : 0]
  );
  const matchId = result.insertId;
  for (const p of opts.players) {
    const userRows = await query<any>(`SELECT id FROM users WHERE openid = ?`, [p.openid]);
    if (!userRows[0]) continue;
    await query(
      `INSERT INTO match_players (match_id, user_id, openid, is_landlord, score_delta, is_winner)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [matchId, userRows[0].id, p.openid, p.isLandlord ? 1 : 0, p.scoreDelta, p.isWinner ? 1 : 0]
    );
    await updateUserStats(p.openid, p.scoreDelta, p.isWinner);
  }
}
