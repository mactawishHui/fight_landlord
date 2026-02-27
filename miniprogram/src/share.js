/**
 * WeChat sharing module.
 * Supports:
 *  - Direct forward (wx.shareAppMessage)
 *  - Custom share card image (captured from canvas)
 *  - Room invite link with roomId query param
 */

/**
 * Share an invite to a multiplayer room.
 * @param {string} roomId
 * @param {string} inviterName - The person sharing
 */
export function shareRoomInvite(roomId, inviterName) {
  wx.shareAppMessage({
    title: `${inviterName} 邀请你来斗地主！`,
    query: `roomId=${encodeURIComponent(roomId)}`,
    imageUrl: 'assets/images/share_card.png', // optional custom image
    success: () => console.log('[Share] invite shared'),
    fail: (err) => console.warn('[Share] share failed:', err),
  });
}

/**
 * Share a game result / score.
 * @param {object} result - { winnerTeam, score, playerName }
 */
export function shareGameResult(result) {
  const title = result.winnerTeam === 'landlord'
    ? `地主胜！获得 ${result.score} 分`
    : `农民胜！获得 ${result.score} 分`;
  wx.shareAppMessage({
    title,
    query: '',
    imageUrl: '',
  });
}

/**
 * Generate a canvas screenshot as a temp file URL for sharing.
 * @param {WX Canvas} canvas
 * @returns {Promise<string>} tempFilePath
 */
export function captureCanvasShare(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toTempFilePath({
      x: 0, y: 0,
      width: canvas.width,
      height: canvas.height,
      destWidth: canvas.width,
      destHeight: canvas.height,
      fileType: 'jpg',
      quality: 0.85,
      success: res => resolve(res.tempFilePath),
      fail: reject,
    });
  });
}

/**
 * Listen for the share button tap (fires when user taps "…" → share).
 * Register this in game.js.
 */
export function onShareAppMessage(shareData) {
  // shareData: { from: 'button' | 'menu', target }
  return {
    title: '来战！斗地主经典玩法',
    query: '',
    imageUrl: '',
  };
}

/**
 * Parse roomId from launch query.
 * wx.getLaunchOptionsSync().query is already an object (key-value pairs),
 * not a raw query string. Handle both object and string forms defensively.
 * @param {Object|string} query - e.g. { roomId: 'ROOM_123' } or "roomId=ROOM_123"
 * @returns {string|null}
 */
export function parseInviteQuery(query) {
  if (!query) return null;
  if (typeof query === 'object') {
    return query.roomId ? decodeURIComponent(query.roomId) : null;
  }
  // Fallback: manual parse for string form
  const match = String(query).match(/(?:^|&)roomId=([^&]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
