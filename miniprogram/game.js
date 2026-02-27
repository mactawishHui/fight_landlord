/**
 * WeChat Mini Game — 斗地主
 * Entry point: initialises canvas, cloud, and drives the screen state machine.
 *
 * Setup checklist:
 *  1. Create a WeChat Cloud environment at https://console.cloud.weixin.qq.com/
 *  2. Update CLOUD_ENV in src/cloud.js to your env ID
 *  3. Deploy all cloud functions in cloudfunctions/ via WeChat DevTools
 *  4. Run npx install in each cloudfunctions/*/  directory
 *  5. Open miniprogram/ directory in WeChat DevTools (appId = wxcfc396f91fa46d03)
 */

import { initCloud } from './src/cloud.js';
import { login, getCachedUser, updateCachedUser } from './src/auth.js';
import { preloadAll as preloadAudio, playBgm, stopBgm, playSfx, setEnabled as setAudioEnabled, isEnabled as isAudioEnabled } from './src/audio.js';
import { createRoom, joinRoom, leaveRoom, sendAction, getCurrentRoom } from './src/room.js';
import { shareRoomInvite, parseInviteQuery } from './src/share.js';
import { callFunction } from './src/cloud.js';
import { handleTouchAt } from './src/ui.js';
import {
  preloadCardImages,
  renderLoading, renderLogin, renderLobby, renderRoom,
  renderGame, renderResult, renderLeaderboard,
} from './src/renderer.js';
import { createInitialState, gameReducer } from './src/logic/gameEngine.js';
import { aiBidDecision, aiChoosePlay } from './src/logic/ai.js';
import { detectCombination, beats, getHint } from './src/logic/combinations.js';

// ── Canvas setup ──────────────────────────────────────────────────────────────

const canvas = wx.createCanvas();
const ctx    = canvas.getContext('2d');
const { windowWidth: W, windowHeight: H } = wx.getSystemInfoSync();
canvas.width  = W;
canvas.height = H;

// ── State machine ──────────────────────────────────────────────────────────────

const SCREEN = { LOADING: 'loading', LOGIN: 'login', LOBBY: 'lobby', ROOM: 'room', GAME: 'game', RESULT: 'result', LEADERBOARD: 'lb' };
let screen = SCREEN.LOADING;

// Loading state
let loadPct = 0;

// Game state
let gameState   = null;
let selectedIds = new Set();
let errorMsg    = null;
let errorTimer  = null;
let localPlayerId = 'human';
let isMultiplayer = false;
let leaderboardEntries = [];

// Multiplayer room state
let currentRoom = null;

// Parse launch query (e.g. from share invite)
const launchOptions = wx.getLaunchOptionsSync();
const inviteRoomId  = parseInviteQuery(launchOptions.query);

// ── Render loop ───────────────────────────────────────────────────────────────

let _needsRender = true;
let _animFrame   = null;

function requestRender() { _needsRender = true; }

function renderLoop(ts) {
  _animFrame = requestAnimationFrame(renderLoop);
  // Always render room screen (animated dots) and during loading
  if (_needsRender || screen === SCREEN.ROOM || screen === SCREEN.LOADING) {
    _needsRender = false;
    _draw();
  }
}

function _draw() {
  ctx.clearRect(0, 0, W, H);
  switch (screen) {
    case SCREEN.LOADING:     renderLoading(ctx, W, H, loadPct); break;
    case SCREEN.LOGIN:       renderLogin(ctx, W, H, handleLogin); break;
    case SCREEN.LOBBY:       _drawLobby(); break;
    case SCREEN.ROOM:        renderRoom(ctx, W, H, currentRoom, getCachedUser()?.openid, handleShareInvite, handleLeaveRoom); break;
    case SCREEN.GAME:        _drawGame(); break;
    case SCREEN.RESULT:      renderResult(ctx, W, H, gameState, localPlayerId, handleNextRound, handleHome); break;
    case SCREEN.LEADERBOARD: renderLeaderboard(ctx, W, H, leaderboardEntries, handleHome); break;
  }
}

// ── Touch handling ────────────────────────────────────────────────────────────

wx.onTouchStart(e => {
  const t = e.touches[0];
  handleTouchAt(t.clientX, t.clientY);
});

// ── Loading ───────────────────────────────────────────────────────────────────

async function startLoading() {
  // Init WeChat Cloud
  initCloud();

  // Load audio
  await preloadAudio(pct => { loadPct = Math.round(pct * 0.6); requestRender(); });

  // Load card images
  await new Promise(resolve => preloadCardImages(() => {
    loadPct = 100;
    requestRender();
    resolve();
  }));

  await new Promise(r => setTimeout(r, 400));

  // Check for cached login
  const cached = getCachedUser();
  if (cached) {
    // Already logged in — check if launched from room invite
    if (inviteRoomId) {
      goToScreen(SCREEN.LOBBY);
      await handleJoinRoom(inviteRoomId);
    } else {
      goToScreen(SCREEN.LOBBY);
    }
    playBgm('home');
  } else {
    goToScreen(SCREEN.LOGIN);
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goToScreen(s) {
  screen = s;
  requestRender();
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function handleLogin() {
  try {
    const user = await login();
    goToScreen(SCREEN.LOBBY);
    playBgm('home');
  } catch (e) {
    showError('登录失败，请重试');
  }
}

// ── Lobby ─────────────────────────────────────────────────────────────────────

function _drawLobby() {
  const user = getCachedUser();
  renderLobby(ctx, W, H, user,
    handleSoloGame,
    handleCreateRoom,
    handleLeaderboard,
    () => { setAudioEnabled(!isAudioEnabled()); requestRender(); },
    isAudioEnabled()
  );
}

// ── Solo game ─────────────────────────────────────────────────────────────────

function handleSoloGame() {
  isMultiplayer = false;
  localPlayerId = 'human';
  selectedIds   = new Set();
  errorMsg      = null;
  gameState     = gameReducer(
    createInitialState({}, ['human', 'ai1', 'ai2'], ['你', '小明', '小红']),
    { type: 'DEAL' }
  );
  stopBgm();
  playBgm('game');
  goToScreen(SCREEN.GAME);
  scheduleAiMove();
}

// ── Multiplayer ───────────────────────────────────────────────────────────────

async function handleCreateRoom() {
  try {
    const result = await createRoom(_onRoomUpdate);
    currentRoom = result.room;
    goToScreen(SCREEN.ROOM);
  } catch (e) {
    showError('创建房间失败: ' + e.message);
  }
}

async function handleJoinRoom(roomId) {
  try {
    const result = await joinRoom(roomId, _onRoomUpdate);
    currentRoom = result.room;
    goToScreen(SCREEN.ROOM);
  } catch (e) {
    showError('加入房间失败: ' + e.message);
  }
}

function _onRoomUpdate(room) {
  currentRoom = room;
  if (room.status === 'playing' && gameState?.phase !== 'playing') {
    // Game started — transition to game screen
    isMultiplayer = true;
    const user = getCachedUser();
    localPlayerId = user?.openid ?? 'human';
    gameState = room.gameState;
    selectedIds = new Set();
    errorMsg = null;
    stopBgm();
    playBgm('game');
    goToScreen(SCREEN.GAME);
  } else if (room.status === 'playing') {
    // Game state updated mid-game
    gameState = room.gameState;
    if (gameState.phase === 'game_over') {
      _handleGameOver();
    }
    requestRender();
  }
  requestRender();
}

function handleShareInvite() {
  const room = getCurrentRoom();
  const user = getCachedUser();
  if (room && user) {
    shareRoomInvite(room.roomId, user.nickname || '好友');
  }
}

async function handleLeaveRoom() {
  await leaveRoom();
  currentRoom = null;
  goToScreen(SCREEN.LOBBY);
  playBgm('home');
}

// ── Game actions ──────────────────────────────────────────────────────────────

function handleToggleCard(card) {
  if (gameState?.phase !== 'playing' || gameState.currentTurn !== localPlayerId) return;
  playSfx('card_select');
  selectedIds = new Set(selectedIds);
  if (selectedIds.has(card.id)) selectedIds.delete(card.id);
  else selectedIds.add(card.id);
  errorMsg = null;
  requestRender();
}

function handlePlay() {
  if (!gameState) return;
  const hand = gameState.players[localPlayerId]?.hand ?? [];
  const cards = hand.filter(c => selectedIds.has(c.id));
  const combo = detectCombination(cards);

  if (!combo) { showError('请选择有效的牌型'); return; }
  const canPlay = gameState.trick.lastCombination === null || beats(gameState.trick.lastCombination, combo);
  if (!canPlay) { showError('出牌不合法，无法压过对方'); return; }

  const action = { type: 'PLAY', playerId: localPlayerId, cards };
  if (isMultiplayer) {
    sendAction(action).catch(e => showError('出牌失败'));
  } else {
    dispatchLocal(action);
  }
  selectedIds = new Set();
  errorMsg = null;
  playSfx(combo.type === 'rocket' ? 'rocket' : combo.type === 'bomb' ? 'bomb' : combo.type === 'plane' || combo.type === 'plane_solo' || combo.type === 'plane_pair' ? 'plane' : combo.type === 'straight' ? 'straight' : combo.type === 'pair_straight' ? 'pair_straight' : 'play_card');
}

function handlePass() {
  if (!gameState || gameState.trick.lastCombination === null) return;
  const action = { type: 'PASS', playerId: localPlayerId };
  if (isMultiplayer) {
    sendAction(action).catch(e => showError('操作失败'));
  } else {
    dispatchLocal(action);
  }
  selectedIds = new Set();
  playSfx('pass');
}

function handleHint() {
  if (!gameState) return;
  const hand = gameState.players[localPlayerId]?.hand ?? [];
  const hintCards = getHint(hand, gameState.trick.lastCombination);
  if (hintCards) {
    selectedIds = new Set(hintCards.map(c => c.id));
    errorMsg = null;
  } else {
    showError('没有可以出的牌，只能不出');
  }
  requestRender();
}

function handleBid(amount) {
  if (!gameState) return;
  const action = { type: 'BID', playerId: localPlayerId, bid: amount };
  if (isMultiplayer) {
    sendAction(action).catch(e => showError('叫分失败'));
  } else {
    dispatchLocal(action);
  }
  playSfx('bid');
}

// ── Local (solo) game reducer ─────────────────────────────────────────────────

function dispatchLocal(action) {
  gameState = gameReducer(gameState, action);
  selectedIds = new Set(); // clear on state change
  if (gameState.phase === 'game_over') {
    _handleGameOver();
  }
  requestRender();
  scheduleAiMove();
}

// ── AI automation ─────────────────────────────────────────────────────────────

let _aiTimer = null;

function scheduleAiMove() {
  if (isMultiplayer) return;
  if (!gameState) return;
  const { phase, currentTurn, players, turnOrder } = gameState;
  if (currentTurn === localPlayerId) return;
  if (phase !== 'bidding' && phase !== 'playing') return;

  if (_aiTimer) clearTimeout(_aiTimer);
  const delay = 600 + Math.random() * 700;
  _aiTimer = setTimeout(_executeAiMove, delay);
}

function _executeAiMove() {
  if (!gameState) return;
  const { phase, currentTurn, players, turnOrder, trick, bids, landlord } = gameState;
  if (currentTurn === localPlayerId) return;

  if (phase === 'bidding') {
    const currentMaxBid = bids.length > 0 ? Math.max(...bids.map(b => b.bid)) : 0;
    const hand = players[currentTurn]?.hand ?? [];
    const bidAmount = aiBidDecision(hand, currentMaxBid);
    dispatchLocal({ type: 'BID', playerId: currentTurn, bid: bidAmount });
    return;
  }

  if (phase === 'playing') {
    const hand = players[currentTurn]?.hand ?? [];
    const handSizes = Object.fromEntries(turnOrder.map(id => [id, players[id]?.hand.length ?? 0]));
    const cards = aiChoosePlay(hand, trick.lastCombination, trick.lastPlayerId, currentTurn, landlord, turnOrder, handSizes);
    if (cards) {
      dispatchLocal({ type: 'PLAY', playerId: currentTurn, cards });
    } else {
      dispatchLocal({ type: 'PASS', playerId: currentTurn });
    }
  }
}

// ── Game over ────────────────────────────────────────────────────────────────

function _handleGameOver() {
  const { winner, winnerTeam, scores, baseScore, multiplier, turnOrder } = gameState;
  playSfx(winner === localPlayerId || (winnerTeam === 'farmers' && localPlayerId !== gameState.landlord) ? 'win' : 'lose');
  stopBgm();

  // Save match result to cloud (non-blocking)
  _saveMatchResult().catch(() => {});

  setTimeout(() => {
    goToScreen(SCREEN.RESULT);
  }, 1500);
}

async function _saveMatchResult() {
  if (!getCachedUser()) return;
  const { winner, winnerTeam, scores, baseScore, multiplier, landlord, turnOrder } = gameState;
  const myDelta = scores[localPlayerId] ?? 0;
  const isWin = winner === localPlayerId || (winnerTeam === 'farmers' && localPlayerId !== landlord);

  try {
    await callFunction('saveMatch', {
      winner,
      winnerTeam,
      baseScore,
      multiplier,
      finalScore: baseScore * multiplier,
      isWin,
      scoreDelta: myDelta,
      playerIds: turnOrder,
      isMultiplayer,
    });
    // Update cached user stats
    const u = getCachedUser();
    if (u) {
      updateCachedUser({
        totalScore: (u.totalScore ?? 0) + myDelta,
        totalWins:  (u.totalWins ?? 0)  + (isWin ? 1 : 0),
        totalLosses: (u.totalLosses ?? 0) + (isWin ? 0 : 1),
      });
    }
  } catch (_) {}
}

// ── Next round / home ─────────────────────────────────────────────────────────

function handleNextRound() {
  if (isMultiplayer) {
    sendAction({ type: 'NEXT_ROUND' }).catch(() => {});
  } else {
    gameState = gameReducer(gameState, { type: 'NEXT_ROUND' });
    selectedIds = new Set();
    errorMsg = null;
    stopBgm();
    playBgm('game');
    goToScreen(SCREEN.GAME);
    scheduleAiMove();
  }
}

function handleHome() {
  if (_aiTimer) clearTimeout(_aiTimer);
  if (isMultiplayer) leaveRoom().catch(() => {});
  gameState = null;
  selectedIds = new Set();
  errorMsg = null;
  stopBgm();
  playBgm('home');
  goToScreen(SCREEN.LOBBY);
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

async function handleLeaderboard() {
  goToScreen(SCREEN.LEADERBOARD);
  try {
    const result = await callFunction('getLeaderboard', { limit: 20 });
    leaderboardEntries = result.entries ?? [];
    requestRender();
  } catch (_) { leaderboardEntries = []; }
}

// ── Error display ─────────────────────────────────────────────────────────────

function showError(msg) {
  errorMsg = msg;
  if (errorTimer) clearTimeout(errorTimer);
  errorTimer = setTimeout(() => { errorMsg = null; requestRender(); }, 2500);
  requestRender();
}

// ── Derived state for rendering ───────────────────────────────────────────────

function _drawGame() {
  if (!gameState) return;
  const { phase, players, currentTurn, trick, turnOrder } = gameState;
  const localPlayer = players[localPlayerId];
  const hand = localPlayer?.hand ?? [];
  const selectedCards = hand.filter(c => selectedIds.has(c.id));
  const combo = selectedCards.length > 0 ? detectCombination(selectedCards) : null;

  let canPlay = false;
  if (currentTurn === localPlayerId && phase === 'playing' && combo) {
    canPlay = trick.lastCombination === null ? true : beats(trick.lastCombination, combo);
  }
  const canPass = currentTurn === localPlayerId && phase === 'playing' && trick.lastCombination !== null;

  renderGame(
    ctx, W, H, gameState, selectedIds, localPlayerId,
    handleToggleCard, handlePlay, handlePass, handleHint, handleBid,
    canPlay, canPass, errorMsg
  );
}

// ── Share handler (global) ────────────────────────────────────────────────────

wx.onShareAppMessage(() => {
  const room = getCurrentRoom();
  if (room) {
    return {
      title: `${getCachedUser()?.nickname ?? '好友'} 邀请你来斗地主！`,
      query: `roomId=${encodeURIComponent(room.roomId)}`,
    };
  }
  return { title: '来战！经典斗地主', query: '' };
});

// ── Bootstrap ────────────────────────────────────────────────────────────────

requestAnimationFrame(renderLoop);
startLoading();
