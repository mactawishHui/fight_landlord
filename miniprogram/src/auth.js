/**
 * WeChat authentication module.
 *
 * Flow:
 *  1. wx.login() → get temporary `code`
 *  2. Call Cloud Function `login` with code + user profile
 *  3. Cloud Function exchanges code for openid via WeChat server API
 *  4. Cloud Function upserts user in DB, returns { openid, nickname, avatarUrl, ... }
 *  5. Cache session locally with wx.setStorageSync
 */

const SESSION_KEY = 'wl_session';

let _currentUser = null;

/**
 * Get cached user if available (no network call).
 */
export function getCachedUser() {
  if (_currentUser) return _currentUser;
  try {
    const s = wx.getStorageSync(SESSION_KEY);
    if (s && s.openid) { _currentUser = s; return s; }
  } catch (_) {}
  return null;
}

/**
 * Full login flow: wx.login → getUserProfile → Cloud Function login.
 * Returns user object { openid, nickname, avatarUrl, totalWins, totalLosses, totalScore }.
 */
export async function login() {
  // Step 1: WeChat login code
  const loginResult = await new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });
  const { code } = loginResult;

  // Step 2: Get user profile (requires user gesture — call this after button tap)
  let nickname = '玩家';
  let avatarUrl = '';
  try {
    const profileResult = await new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于展示游戏头像和昵称',
        success: resolve,
        fail: reject,
      });
    });
    nickname = profileResult.userInfo.nickName;
    avatarUrl = profileResult.userInfo.avatarUrl;
  } catch (_) {
    // User declined profile — use default
  }

  // Step 3: Call Cloud Function to exchange code for openid + upsert user
  const result = await wx.cloud.callFunction({
    name: 'login',
    data: { code, nickname, avatarUrl },
  });

  if (!result.result || !result.result.openid) {
    throw new Error('Login failed: no openid returned');
  }

  const user = result.result;
  _currentUser = user;

  // Cache locally
  wx.setStorageSync(SESSION_KEY, user);

  return user;
}

/**
 * Clear local session (logout).
 */
export function logout() {
  _currentUser = null;
  wx.removeStorageSync(SESSION_KEY);
}

/**
 * Update cached user data (e.g. after a match result).
 */
export function updateCachedUser(updates) {
  if (_currentUser) {
    _currentUser = { ..._currentUser, ...updates };
    wx.setStorageSync(SESSION_KEY, _currentUser);
  }
}
