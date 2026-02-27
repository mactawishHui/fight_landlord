"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
exports.query = query;
exports.upsertUser = upsertUser;
exports.getUserByOpenid = getUserByOpenid;
exports.updateUserStats = updateUserStats;
exports.getLeaderboard = getLeaderboard;
exports.saveMatch = saveMatch;
/**
 * MySQL connection pool + query helpers.
 * Uses mysql2 with promise API.
 */
const promise_1 = __importDefault(require("mysql2/promise"));
let _pool = null;
function getPool() {
    if (!_pool) {
        _pool = promise_1.default.createPool({
            host: process.env.DB_HOST ?? '127.0.0.1',
            port: Number(process.env.DB_PORT ?? 3306),
            user: process.env.DB_USER ?? 'root',
            password: process.env.DB_PASSWORD ?? '',
            database: process.env.DB_NAME ?? 'fight_landlord',
            waitForConnections: true,
            connectionLimit: 10,
            timezone: '+00:00',
        });
    }
    return _pool;
}
async function query(sql, params) {
    const [rows] = await getPool().execute(sql, params);
    return rows;
}
// ── User helpers ──────────────────────────────────────────────────────────────
async function upsertUser(openid, nickname, avatarUrl) {
    await query(`INSERT INTO users (openid, nickname, avatar_url, last_login)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       nickname   = VALUES(nickname),
       avatar_url = VALUES(avatar_url),
       last_login = NOW()`, [openid, nickname, avatarUrl]);
    const rows = await query(`SELECT * FROM users WHERE openid = ?`, [openid]);
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
async function getUserByOpenid(openid) {
    const rows = await query(`SELECT * FROM users WHERE openid = ?`, [openid]);
    if (!rows[0])
        return null;
    const u = rows[0];
    return { id: u.id, openid: u.openid, nickname: u.nickname, avatarUrl: u.avatar_url, totalScore: u.total_score, totalWins: u.total_wins, totalLosses: u.total_losses };
}
async function updateUserStats(openid, scoreDelta, isWin) {
    await query(`UPDATE users SET
       total_score   = total_score + ?,
       total_wins    = total_wins + ?,
       total_losses  = total_losses + ?
     WHERE openid = ?`, [scoreDelta, isWin ? 1 : 0, isWin ? 0 : 1, openid]);
}
async function getLeaderboard(limit = 20) {
    const rows = await query(`SELECT * FROM leaderboard LIMIT ?`, [limit]);
    return rows.map((u) => ({
        id: u.id, openid: u.openid, nickname: u.nickname,
        avatarUrl: u.avatar_url, totalScore: u.total_score,
        totalWins: u.total_wins, totalLosses: u.total_losses,
    }));
}
// ── Match helpers ─────────────────────────────────────────────────────────────
async function saveMatch(opts) {
    const [result] = await getPool().execute(`INSERT INTO matches (room_id, winner_openid, winner_team, base_score, multiplier, final_score, is_multiplayer)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [opts.roomId, opts.winnerOpenid, opts.winnerTeam, opts.baseScore, opts.multiplier, opts.finalScore, opts.isMultiplayer ? 1 : 0]);
    const matchId = result.insertId;
    for (const p of opts.players) {
        const userRows = await query(`SELECT id FROM users WHERE openid = ?`, [p.openid]);
        if (!userRows[0])
            continue;
        await query(`INSERT INTO match_players (match_id, user_id, openid, is_landlord, score_delta, is_winner)
       VALUES (?, ?, ?, ?, ?, ?)`, [matchId, userRows[0].id, p.openid, p.isLandlord ? 1 : 0, p.scoreDelta, p.isWinner ? 1 : 0]);
        await updateUserStats(p.openid, p.scoreDelta, p.isWinner);
    }
}
