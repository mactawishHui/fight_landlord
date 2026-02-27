/**
 * Cloud Function: login
 *
 * Exchanges a WeChat login code for openid (via WeChat server),
 * then upserts the user record in the `users` collection.
 *
 * Input: { code, nickname, avatarUrl }
 * Returns: { openid, nickname, avatarUrl, totalWins, totalLosses, totalScore }
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const OPENID = wxContext.OPENID;

  if (!OPENID) {
    throw new Error('Cannot get OPENID from WeChat context');
  }

  const nickname  = event.nickname  || '玩家';
  const avatarUrl = event.avatarUrl || '';

  const userRef = db.collection('users').doc(OPENID);

  let userData;
  try {
    const snap = await userRef.get();
    userData = snap.data;
    // Update existing user
    await userRef.update({
      data: {
        nickname,
        avatarUrl,
        lastLogin: db.serverDate(),
      },
    });
    userData = { ...userData, nickname, avatarUrl };
  } catch (e) {
    // User doesn't exist — create
    userData = {
      openid: OPENID,
      nickname,
      avatarUrl,
      totalWins: 0,
      totalLosses: 0,
      totalScore: 0,
      createdAt: db.serverDate(),
      lastLogin: db.serverDate(),
    };
    await userRef.set({ data: userData });
  }

  return {
    openid: OPENID,
    nickname: userData.nickname,
    avatarUrl: userData.avatarUrl,
    totalWins: userData.totalWins ?? 0,
    totalLosses: userData.totalLosses ?? 0,
    totalScore: userData.totalScore ?? 0,
  };
};
