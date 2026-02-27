/**
 * Room management module for multiplayer games.
 *
 * Architecture:
 *  - Each room is a document in the Cloud DB `rooms` collection.
 *  - Players use db.watch() to subscribe to real-time state changes.
 *  - Game actions (BID/PLAY/PASS) call the `playAction` Cloud Function,
 *    which validates the move server-side and updates the room document.
 *  - All subscribed clients get notified via watch() within ~200ms.
 */

import { callFunction, DB } from './cloud.js';
import { getCachedUser } from './auth.js';

let _currentRoom = null;
let _watcher = null;
let _onRoomUpdate = null; // callback(room) invoked on every state change
let _onGameStart = null;  // callback(gameState, mySlot) when game begins
let _onGameAction = null; // callback(gameState) when game state updates

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new room and wait for 2 more players to join.
 * Returns { roomId, shareToken }.
 */
export async function createRoom(onUpdate) {
  const user = getCachedUser();
  if (!user) throw new Error('Not logged in');

  const result = await callFunction('createRoom', {
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  });

  _currentRoom = result.room;
  _subscribeToRoom(result.room.roomId, onUpdate);
  return result;
}

/**
 * Join an existing room by roomId.
 */
export async function joinRoom(roomId, onUpdate) {
  const user = getCachedUser();
  if (!user) throw new Error('Not logged in');

  const result = await callFunction('joinRoom', {
    roomId,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  });

  _currentRoom = result.room;
  _subscribeToRoom(roomId, onUpdate);
  return result;
}

/**
 * Leave the current room (cleanup watcher).
 */
export async function leaveRoom() {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
  if (_currentRoom) {
    await callFunction('leaveRoom', { roomId: _currentRoom.roomId }).catch(() => {});
    _currentRoom = null;
  }
}

/**
 * Send a game action for the current player.
 * action: { type: 'BID'|'PLAY'|'PASS', ... }
 * The cloud function validates and updates the room document.
 */
export async function sendAction(action) {
  if (!_currentRoom) throw new Error('Not in a room');
  const result = await callFunction('playAction', {
    roomId: _currentRoom.roomId,
    action,
  });
  return result;
}

export function getCurrentRoom() {
  return _currentRoom;
}

// ── Internal ─────────────────────────────────────────────────────────────────

function _subscribeToRoom(roomId, onUpdate) {
  if (_watcher) { _watcher.close(); }

  _watcher = DB.watch('rooms', roomId,
    (snapshot) => {
      if (!snapshot.docs || snapshot.docs.length === 0) return;
      const room = snapshot.docs[0];
      _currentRoom = room;
      if (onUpdate) onUpdate(room);
    },
    (err) => {
      console.error('[Room] watch error:', err);
    }
  );
}

/**
 * Fetch the current room document once (non-reactive).
 */
export async function fetchRoom(roomId) {
  return DB.get('rooms', roomId);
}

/**
 * Generate the share URL/params for inviting a friend.
 * WeChat Mini Game sharing uses query params in the launch path.
 */
export function getRoomShareParams(roomId) {
  return {
    title: '来斗地主！加入我的牌局',
    query: `roomId=${roomId}`,
    imageUrl: '', // optional custom share image
  };
}
