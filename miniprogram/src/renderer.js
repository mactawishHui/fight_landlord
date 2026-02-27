/**
 * Canvas renderer for the WeChat Mini Game.
 *
 * All drawing functions accept the canvas 2D context and current state.
 * Card images are preloaded into cardImgs map before rendering begins.
 *
 * Coordinate system: top-left origin, portrait orientation.
 */

import { COMBO_LABELS, RANK_LABELS, SUIT_SYMBOLS, cardImagePath } from './logic/deck.js';
import {
  clearHitAreas, registerHitArea, drawButton, drawBadge,
  drawText, drawBoldText, drawProgressBar, drawAvatar, roundRect,
} from './ui.js';

// ── Card image cache ──────────────────────────────────────────────────────────

export const cardImgs = {};    // cardId → WXImage
let cardBackImg = null;
let imagesLoaded = false;

/** Preload all 55 card images (54 faces + 1 back). */
export function preloadCardImages(onComplete) {
  const ALL_IDS = [];
  const suits = ['C','D','H','S'];
  const rankStrs = ['3','4','5','6','7','8','9','0','J','Q','K','A','2'];
  for (const s of suits) for (const r of rankStrs) ALL_IDS.push(`${s}${r}`);
  ALL_IDS.push('BJ', 'RJ');

  let loaded = 0;
  const total = ALL_IDS.length + 1; // +1 for back

  function checkDone() {
    loaded++;
    if (loaded >= total) { imagesLoaded = true; if (onComplete) onComplete(); }
  }

  // Load card faces
  for (const id of ALL_IDS) {
    const suitMap = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
    const rankMap = {'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'0':10,'J':11,'Q':12,'K':13,'A':14,'2':15};
    let card;
    if (id === 'BJ') card = { id: 'BJ', suit: null, rank: 16 };
    else if (id === 'RJ') card = { id: 'RJ', suit: null, rank: 17 };
    else card = { id, suit: suitMap[id[0]], rank: rankMap[id.slice(1)] };

    const img = wx.createImage();
    img.onload = () => { cardImgs[id] = img; checkDone(); };
    img.onerror = () => checkDone(); // skip if missing
    img.src = cardImagePath(card);
  }

  // Load card back
  const backImg = wx.createImage();
  backImg.onload = () => { cardBackImg = backImg; checkDone(); };
  backImg.onerror = () => checkDone();
  backImg.src = 'assets/cards/back.png';
}

// ── Card drawing helpers ──────────────────────────────────────────────────────

const CW = 44;   // card width
const CH = 66;   // card height
const MINI_CW = 28;
const MINI_CH = 42;

function drawCard(ctx, card, x, y, w, h, selected = false, faceUp = true) {
  const oy = selected ? -14 : 0;
  if (faceUp && card && cardImgs[card.id]) {
    ctx.drawImage(cardImgs[card.id], x, y + oy, w, h);
  } else if (!faceUp && cardBackImg) {
    ctx.drawImage(cardBackImg, x, y + oy, w, h);
  } else {
    // Fallback: draw colored rect
    ctx.fillStyle = faceUp ? '#fff' : '#1a4e8a';
    roundRect(ctx, x, y + oy, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (faceUp && card) {
      const label = (RANK_LABELS[card.rank] ?? '?');
      const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#cc0000' : '#000';
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(w * 0.3)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + oy + h / 2);
    }
  }
}

// ── Screen renderers ──────────────────────────────────────────────────────────

/** Loading screen with progress bar. */
export function renderLoading(ctx, W, H, pct) {
  clearHitAreas();
  // Background
  ctx.fillStyle = '#1a6b1a';
  ctx.fillRect(0, 0, W, H);

  // Logo / title
  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold ${Math.round(W * 0.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('斗地主', W / 2, H * 0.38);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `${Math.round(W * 0.04)}px sans-serif`;
  ctx.fillText('经典斗地主', W / 2, H * 0.46);

  // Progress bar
  const bw = W * 0.6, bh = 12, bx = (W - bw) / 2, by = H * 0.6;
  drawProgressBar(ctx, bx, by, bw, bh, pct / 100, '#f1c40f', 'rgba(255,255,255,0.2)');

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.round(W * 0.035)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`加载中… ${pct}%`, W / 2, by + bh + 16);
}

/** Login screen. */
export function renderLogin(ctx, W, H, onLogin) {
  clearHitAreas();
  ctx.fillStyle = '#1a6b1a';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold ${Math.round(W * 0.12)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('斗地主', W / 2, H * 0.32);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `${Math.round(W * 0.042)}px sans-serif`;
  ctx.fillText('微信小游戏版', W / 2, H * 0.42);

  // WeChat login button
  const bw = W * 0.65, bh = 50, bx = (W - bw) / 2, by = H * 0.58;
  drawButton(ctx, 'btn_login', bx, by, bw, bh, '微信一键登录', '#07c160', '#fff', false, onLogin);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `${Math.round(W * 0.03)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('登录后可保存战绩和参与排行榜', W / 2, by + bh + 16);
}

/** Lobby screen. */
export function renderLobby(ctx, W, H, user, onSolo, onMulti, onLeaderboard, onToggleSound, soundOn) {
  clearHitAreas();
  ctx.fillStyle = '#1a6b1a';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold ${Math.round(W * 0.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('斗地主', W / 2, H * 0.15);

  // User info
  if (user) {
    drawAvatar(ctx, user.nickname || '玩', W / 2, H * 0.27, 28, false, false);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(W * 0.04)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(user.nickname || '玩家', W / 2, H * 0.27 + 34);

    const score = user.totalScore ?? 0;
    ctx.fillStyle = 'rgba(255,255,200,0.8)';
    ctx.font = `${Math.round(W * 0.033)}px sans-serif`;
    ctx.fillText(`总分 ${score >= 0 ? '+' : ''}${score}  胜 ${user.totalWins ?? 0}  负 ${user.totalLosses ?? 0}`, W / 2, H * 0.27 + 58);
  }

  const bw = W * 0.7, bx = (W - bw) / 2;
  const bh = 52;
  const gap = 18;
  const baseY = H * 0.46;

  drawButton(ctx, 'btn_solo', bx, baseY, bw, bh, '单机对战', '#e67e22', '#fff', false, onSolo);
  drawButton(ctx, 'btn_multi', bx, baseY + bh + gap, bw, bh, '在线联机', '#2980b9', '#fff', false, onMulti);
  drawButton(ctx, 'btn_lb', bx, baseY + (bh + gap) * 2, bw, bh, '排行榜', '#8e44ad', '#fff', false, onLeaderboard);

  // Sound toggle
  const sw = 80, sh = 34, sx = W - sw - 16, sy = 16;
  drawButton(ctx, 'btn_sound', sx, sy, sw, sh, soundOn ? '🔊 音效' : '🔇 静音', 'rgba(0,0,0,0.4)', '#fff', false, onToggleSound);
}

/** Multiplayer room waiting screen. */
export function renderRoom(ctx, W, H, room, myOpenid, onShare, onCancel) {
  clearHitAreas();
  ctx.fillStyle = '#0d3d3d';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold ${Math.round(W * 0.055)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('等待玩家加入…', W / 2, H * 0.08);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${Math.round(W * 0.032)}px sans-serif`;
  ctx.fillText(`房间号: ${room?.roomId ?? '…'}`, W / 2, H * 0.08 + 36);

  // Player slots
  const players = room?.players ?? [];
  const maxPlayers = 3;
  const slotW = W * 0.25, slotH = 90;
  const totalW = slotW * maxPlayers + 20 * (maxPlayers - 1);
  let sx = (W - totalW) / 2;
  const sy = H * 0.28;

  for (let i = 0; i < maxPlayers; i++) {
    const player = players[i];
    ctx.fillStyle = player ? 'rgba(39,174,96,0.35)' : 'rgba(255,255,255,0.08)';
    roundRect(ctx, sx, sy, slotW, slotH, 10);
    ctx.fill();
    ctx.strokeStyle = player ? '#27ae60' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (player) {
      drawAvatar(ctx, player.nickname || '?', sx + slotW / 2, sy + 28, 20, false, false);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(W * 0.033)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = player.openid === myOpenid ? `${player.nickname}(你)` : player.nickname;
      ctx.fillText(label || '玩家', sx + slotW / 2, sy + 54);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `${Math.round(W * 0.055)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', sx + slotW / 2, sy + slotH / 2);
    }
    sx += slotW + 20;
  }

  // Share invite button
  const bw = W * 0.6, bh = 50, bx = (W - bw) / 2;
  drawButton(ctx, 'btn_share', bx, H * 0.56, bw, bh, '邀请好友加入', '#07c160', '#fff', false, onShare);

  // Cancel button
  drawButton(ctx, 'btn_cancel', bx + bw * 0.2, H * 0.67, bw * 0.6, 40, '取消', 'rgba(200,50,50,0.7)', '#fff', false, onCancel);

  // Loading dots
  const dots = '.'.repeat(1 + (Math.floor(Date.now() / 600) % 3));
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${Math.round(W * 0.038)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`等待中${dots}`, W / 2, H * 0.75);
}

/** Main game screen. */
export function renderGame(ctx, W, H, gameState, selectedIds, localPlayerId, onToggleCard, onPlay, onPass, onHint, onBid, canPlay, canPass, errorMsg) {
  if (!gameState) return;
  clearHitAreas();

  const { phase, players, currentTurn, trick, landlord, landlordCards, bids, turnOrder } = gameState;
  const topBarH = 52;
  const humanSectionH = Math.min(200, H * 0.26);
  const mainRowH = H - topBarH - humanSectionH;
  const aiPanelW = 72;
  const tableW = W - aiPanelW * 2;

  // ── Background ────────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a5c1a');
  grad.addColorStop(1, '#0d3d0d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Table felt
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(aiPanelW, topBarH, tableW, mainRowH);

  // ── Top bar ───────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, topBarH);

  // Score info
  const landlordName = landlord ? (players[landlord]?.name ?? '?') : '';
  const infoText = `底分 ${gameState.baseScore}  ×${gameState.multiplier}${landlord ? `  地主: ${landlordName}` : ''}`;
  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold ${Math.round(W * 0.033)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(infoText, 10, topBarH / 2);

  // Score (right side)
  const localPlayer = players[localPlayerId];
  const myScore = gameState.scores[localPlayerId] ?? 0;
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(W * 0.03)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`你 ${myScore >= 0 ? '+' : ''}${myScore}`, W - 10, topBarH / 2);

  // Landlord bottom cards (shown face-up after bidding)
  if (landlordCards && landlordCards.length > 0) {
    const showFaceUp = phase !== 'bidding' || landlord !== null;
    const cx = W / 2;
    const y  = 4;
    for (let i = 0; i < landlordCards.length; i++) {
      const x = cx - (landlordCards.length * (MINI_CW + 2)) / 2 + i * (MINI_CW + 2);
      drawCard(ctx, landlordCards[i], x, y, MINI_CW, MINI_CH, false, showFaceUp);
    }
  }

  // ── AI panels ────────────────────────────────────────────────────────────
  _renderOpponent(ctx, W, H, players, turnOrder, trick, landlord, 0, topBarH, mainRowH, aiPanelW, localPlayerId);
  _renderOpponent(ctx, W, H, players, turnOrder, trick, landlord, 2, topBarH, mainRowH, aiPanelW, localPlayerId);

  // ── Center table ─────────────────────────────────────────────────────────
  const tableX = aiPanelW, tableY = topBarH;
  _renderTableCenter(ctx, tableX, tableY, tableW, mainRowH, phase, gameState, currentTurn, players, trick, landlord, bids);

  // ── Human section ─────────────────────────────────────────────────────────
  const hSecY = topBarH + mainRowH;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, hSecY, W, humanSectionH);

  const isLocalTurn = currentTurn === localPlayerId;
  _renderHumanSection(ctx, W, hSecY, humanSectionH, localPlayer, localPlayerId, selectedIds, landlord, isLocalTurn, phase, trick, canPlay, canPass, errorMsg, gameState, onToggleCard, onPlay, onPass, onHint, onBid, bids, currentTurn, players);
}

function _renderOpponent(ctx, W, H, players, turnOrder, trick, landlord, slot, topBarH, mainRowH, aiPanelW, localPlayerId) {
  const isLeft = slot === 0;
  const opponentId = turnOrder[isLeft ? (turnOrder.indexOf(localPlayerId) + 1) % 3 : (turnOrder.indexOf(localPlayerId) + 2) % 3];
  const player = players[opponentId];
  if (!player) return;

  const px = isLeft ? 0 : W - aiPanelW;
  const py = topBarH;
  const ph = mainRowH;

  const isCurrentTurn = turnOrder[0] === opponentId || false; // simplified: check state
  const justPassed = trick.lastPass === opponentId;
  const landlordKnown = landlord !== null;
  const isLandlord = opponentId === landlord;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(px, py, aiPanelW, ph);

  // Avatar
  const cx = px + aiPanelW / 2;
  drawAvatar(ctx, player.name, cx, py + 32, 18, isCurrentTurn, isLandlord);

  // Role badge
  if (landlordKnown) {
    const label = isLandlord ? '地主' : '农民';
    const bg = isLandlord ? '#c0392b' : '#27ae60';
    drawBadge(ctx, cx - 18, py + 54, 36, 16, label, bg, '#fff');
  }

  // Card count
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${Math.round(aiPanelW * 0.22)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${player.hand.length}张`, cx, py + 74);

  // Card backs (stacked vertically)
  const count = Math.min(player.hand.length, 8);
  const step = 9;
  const stackH = count > 0 ? step * (count - 1) + MINI_CH : MINI_CH;
  const stackY = py + 96;
  for (let i = 0; i < count; i++) {
    drawCard(ctx, null, cx - MINI_CW / 2, stackY + i * step, MINI_CW, MINI_CH, false, false);
  }

  // Pass badge
  if (justPassed) {
    drawBadge(ctx, cx - 22, stackY + stackH + 8, 44, 20, '不出', 'rgba(0,0,0,0.55)', '#ff9999');
  }

  // Name
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.round(aiPanelW * 0.2)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(player.name, cx, py + ph - 6);
}

function _renderTableCenter(ctx, tx, ty, tw, th, phase, state, currentTurn, players, trick, landlord, bids) {
  const cx = tx + tw / 2;
  const cy = ty + th / 2;

  if (phase === 'bidding') {
    // Bidding panel is rendered in human section; just show "叫地主" text
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `bold ${Math.round(tw * 0.065)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('叫 地 主', cx, cy);
    // Show current bids
    bids.forEach((b, i) => {
      const name = players[b.playerId]?.name ?? b.playerId;
      const label = b.bid === 0 ? '不叫' : `叫${b.bid}分`;
      ctx.fillStyle = b.bid > 0 ? '#f1c40f' : 'rgba(255,255,255,0.4)';
      ctx.font = `${Math.round(tw * 0.04)}px sans-serif`;
      ctx.fillText(`${name}: ${label}`, cx, cy + 30 + i * 24);
    });
    return;
  }

  if (phase === 'playing' || phase === 'game_over') {
    if (trick.lastCombination && trick.lastPlayerId) {
      // Show last play
      const player = players[trick.lastPlayerId];
      const isLandlord = trick.lastPlayerId === landlord;
      const comboLabel = COMBO_LABELS[trick.lastCombination.type] ?? '';

      // Player name label
      const nameLabel = `${player?.name ?? '?'} · ${comboLabel}`;
      const nlw = nameLabel.length * Math.round(tw * 0.035) + 20;
      const nlh = 26;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, cx - nlw / 2, cy - 55, nlw, nlh, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(tw * 0.038)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nameLabel, cx, cy - 55 + nlh / 2);

      // Cards
      const cards = trick.lastCombination.cards;
      const totalW = cards.length * (CW + 2) - 2;
      let cardX = cx - totalW / 2;
      const maxW = tw - 16;
      const step = totalW > maxW ? (maxW - CW) / (cards.length - 1) : CW + 2;
      cardX = cx - Math.min(totalW, maxW) / 2;
      for (let i = 0; i < cards.length; i++) {
        drawCard(ctx, cards[i], cardX + i * step, cy - 33 + 55, CW, CH, false, true);
      }
    } else {
      // No trick — show leader
      const leaderName = currentTurn ? (players[currentTurn]?.name ?? '?') : '';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${Math.round(tw * 0.042)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(leaderName ? `${leaderName} 领牌中…` : '等待出牌…', cx, cy);
    }
  }
}

function _renderHumanSection(ctx, W, hSecY, humanSectionH, player, localPlayerId, selectedIds, landlord, isLocalTurn, phase, trick, canPlay, canPass, errorMsg, state, onToggleCard, onPlay, onPass, onHint, onBid, bids, currentTurn, players) {
  if (!player) return;
  const cx = W / 2;
  const landlordKnown = landlord !== null;
  const isLandlord = localPlayerId === landlord;
  const roleLabel = landlordKnown ? (isLandlord ? '地主' : '农民') : null;

  // Player info row
  const avatarY = hSecY + 22;
  drawAvatar(ctx, player.name, 32, avatarY, 16, isLocalTurn, isLandlord);
  if (roleLabel) {
    const bg = isLandlord ? '#c0392b' : '#27ae60';
    drawBadge(ctx, 52, avatarY - 10, 32, 18, roleLabel, bg, '#fff');
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${Math.round(W * 0.033)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${player.hand.length}张`, 88, avatarY);

  // Status message
  if (trick.lastPass === localPlayerId) {
    drawBadge(ctx, cx - 30, hSecY + 4, 60, 22, '不出', 'rgba(0,0,0,0.5)', '#ff9999');
  }
  if (errorMsg) {
    drawBadge(ctx, cx - 80, hSecY + 4, 160, 22, errorMsg, 'rgba(180,30,30,0.8)', '#fff');
  }

  // Action area
  const actionY = hSecY + 42;
  if (phase === 'playing' && isLocalTurn) {
    const bw = 80, bh = 36, gap = 10;
    const totalBW = bw * 3 + gap * 2;
    const bx = (W - totalBW) / 2;
    drawButton(ctx, 'btn_hint', bx, actionY, bw, bh, '提示', 'rgba(52,152,219,0.85)', '#fff', false, onHint);
    drawButton(ctx, 'btn_pass', bx + bw + gap, actionY, bw, bh, '不出', 'rgba(149,165,166,0.85)', '#fff', !canPass, onPass);
    drawButton(ctx, 'btn_play', bx + (bw + gap) * 2, actionY, bw, bh, '出牌', 'rgba(231,76,60,0.9)', '#fff', !canPlay, onPlay);
  } else if (phase === 'bidding' && currentTurn === localPlayerId) {
    const maxBid = bids.length > 0 ? Math.max(...bids.map(b => b.bid)) : 0;
    const bidOptions = [0, 1, 2, 3].filter(b => b === 0 || b > maxBid);
    const bw = 70, bh = 36, gap = 10;
    const totalBW = bw * bidOptions.length + gap * (bidOptions.length - 1);
    let bx = (W - totalBW) / 2;
    const bidLabels = { 0: '不叫', 1: '叫1分', 2: '叫2分', 3: '叫3分' };
    const bidColors = { 0: 'rgba(100,100,100,0.8)', 1: 'rgba(39,174,96,0.85)', 2: 'rgba(243,156,18,0.85)', 3: 'rgba(231,76,60,0.9)' };
    for (const b of bidOptions) {
      const bidVal = b;
      drawButton(ctx, `btn_bid_${b}`, bx, actionY, bw, bh, bidLabels[b], bidColors[b], '#fff', false, () => onBid(bidVal));
      bx += bw + gap;
    }
  } else if (phase === 'playing') {
    // Waiting for opponent
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.round(W * 0.035)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const waitName = players[currentTurn]?.name ?? '对方';
    ctx.fillText(`等待 ${waitName} 出牌…`, W / 2, actionY + 18);
  }

  // Human hand
  const handY = hSecY + 88;
  const handCards = player.hand;
  if (handCards.length === 0) return;

  const available = W - 32;
  const step = handCards.length > 1 ? Math.min(CW, (available - CW) / (handCards.length - 1)) : CW;
  const totalW = step * (handCards.length - 1) + CW;
  const startX = (W - totalW) / 2;
  const reversed = [...handCards].reverse(); // highest on left

  for (let i = 0; i < reversed.length; i++) {
    const card = reversed[i];
    const selected = selectedIds.has(card.id);
    const x = startX + i * step;
    drawCard(ctx, card, x, handY, CW, CH, selected, true);
    if (isLocalTurn && phase === 'playing') {
      registerHitArea(`card_${card.id}`, x, handY - 14, CW, CH + 14, () => onToggleCard(card));
    }
  }
}

/** Game over / result overlay. */
export function renderResult(ctx, W, H, state, localPlayerId, onNextRound, onHome) {
  clearHitAreas();
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);

  // Result card
  const rw = W * 0.85, rh = H * 0.55;
  const rx = (W - rw) / 2, ry = (H - rh) / 2;
  ctx.fillStyle = 'rgba(15,40,15,0.97)';
  roundRect(ctx, rx, ry, rw, rh, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const { winner, winnerTeam, players, scores, baseScore, multiplier, landlord, history, turnOrder } = state;
  const finalScore = baseScore * multiplier;
  const winnerName = winner ? (players[winner]?.name ?? '?') : '?';
  const teamLabel = winnerTeam === 'landlord' ? '地主胜' : '农民胜';
  const teamColor = winnerTeam === 'landlord' ? '#e74c3c' : '#27ae60';

  ctx.fillStyle = teamColor;
  ctx.font = `bold ${Math.round(rw * 0.11)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(teamLabel, W / 2, ry + 20);

  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold ${Math.round(rw * 0.065)}px sans-serif`;
  ctx.fillText(`${winnerName} 获胜！`, W / 2, ry + 20 + Math.round(rw * 0.11) + 8);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.round(rw * 0.045)}px sans-serif`;
  ctx.fillText(`${baseScore} × ${multiplier} = ${finalScore} 分`, W / 2, ry + 20 + Math.round(rw * 0.11) + 44);

  // Score table
  let rowY = ry + 20 + Math.round(rw * 0.11) + 80;
  (turnOrder || ['human', 'ai1', 'ai2']).forEach(id => {
    const p = players[id];
    if (!p) return;
    const delta = scores[id] ?? 0;
    const isWinner = id === winner;
    ctx.fillStyle = delta >= 0 ? '#2ecc71' : '#e74c3c';
    ctx.font = `${Math.round(rw * 0.042)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${p.name}${id === localPlayerId ? ' (你)' : ''}${id === landlord ? ' 👑' : ''}`, rx + 20, rowY);
    ctx.textAlign = 'right';
    ctx.fillText(`${delta >= 0 ? '+' : ''}${delta}`, rx + rw - 20, rowY);
    rowY += 26;
  });

  // Buttons
  const bw = rw * 0.4, bh = 44, gap = 16;
  const btotalW = bw * 2 + gap;
  const bx = (W - btotalW) / 2;
  const bby = ry + rh - bh - 20;
  drawButton(ctx, 'btn_home', bx, bby, bw, bh, '返回主页', 'rgba(100,100,100,0.8)', '#fff', false, onHome);
  drawButton(ctx, 'btn_next', bx + bw + gap, bby, bw, bh, '再来一局', '#e67e22', '#fff', false, onNextRound);
}

/** Leaderboard screen. */
export function renderLeaderboard(ctx, W, H, entries, onBack) {
  clearHitAreas();
  ctx.fillStyle = '#0d3d0d';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f1c40f';
  ctx.font = `bold ${Math.round(W * 0.065)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('排行榜', W / 2, 24);

  // Table header
  const colX = [20, W * 0.12, W * 0.4, W * 0.62, W * 0.8];
  const headerY = 80;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${Math.round(W * 0.033)}px sans-serif`;
  ctx.textAlign = 'left';
  ['#', '玩家', '总分', '胜', '负'].forEach((h, i) => {
    ctx.textAlign = i === 0 ? 'center' : 'left';
    ctx.fillText(h, colX[i], headerY);
  });

  // Rows
  (entries || []).slice(0, 12).forEach((e, i) => {
    const ry = headerY + 28 + i * 30;
    ctx.fillStyle = i < 3 ? `rgba(241,196,15,${0.15 - i * 0.03})` : 'rgba(255,255,255,0.04)';
    ctx.fillRect(10, ry - 4, W - 20, 26);

    const rankColor = i === 0 ? '#f1c40f' : i === 1 ? '#bdc3c7' : i === 2 ? '#cd6133' : 'rgba(255,255,255,0.7)';
    ctx.fillStyle = rankColor;
    ctx.font = i < 3 ? `bold ${Math.round(W * 0.038)}px sans-serif` : `${Math.round(W * 0.035)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}`, colX[0], ry);
    ctx.textAlign = 'left';
    ctx.fillText(e.nickname?.slice(0, 6) ?? '—', colX[1], ry);
    ctx.fillStyle = e.totalScore >= 0 ? '#2ecc71' : '#e74c3c';
    ctx.fillText(`${e.totalScore >= 0 ? '+' : ''}${e.totalScore}`, colX[2], ry);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${e.totalWins}`, colX[3], ry);
    ctx.fillText(`${e.totalLosses}`, colX[4], ry);
  });

  drawButton(ctx, 'btn_back', (W - 120) / 2, H - 70, 120, 44, '返回', 'rgba(100,100,100,0.8)', '#fff', false, onBack);
}
