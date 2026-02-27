/**
 * Cloud Function: getLeaderboard
 * Returns top players sorted by totalScore (descending).
 * Input: { limit?: number }
 * Returns: { entries: User[] }
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const limit = Math.min(event.limit ?? 20, 50);

  const snap = await db.collection('users')
    .orderBy('totalScore', 'desc')
    .limit(limit)
    .get();

  const entries = (snap.data ?? []).map(u => ({
    openid:       u.openid,
    nickname:     u.nickname,
    avatarUrl:    u.avatarUrl,
    totalScore:   u.totalScore ?? 0,
    totalWins:    u.totalWins ?? 0,
    totalLosses:  u.totalLosses ?? 0,
  }));

  return { entries };
};
