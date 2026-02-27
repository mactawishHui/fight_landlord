/**
 * Cloud Function: joinRoom
 *
 * Adds the calling player to an existing room.
 * If room reaches maxPlayers, automatically starts the game (DEAL action).
 *
 * Input: { roomId, nickname, avatarUrl }
 * Returns: { room: RoomDoc }
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// Minimal game engine import (same logic as client) ──────────────────────────
const Rank = { Three:3,Four:4,Five:5,Six:6,Seven:7,Eight:8,Nine:9,Ten:10,Jack:11,Queen:12,King:13,Ace:14,Two:15,BlackJoker:16,RedJoker:17 };
const SUITS = ['clubs','diamonds','hearts','spades'];
const NORMAL_RANKS = [3,4,5,6,7,8,9,10,11,12,13,14,15];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of NORMAL_RANKS)
    deck.push({ id: `${suit[0].toUpperCase()}${rank}`, suit, rank });
  deck.push({ id: 'BJ', suit: null, rank: Rank.BlackJoker });
  deck.push({ id: 'RJ', suit: null, rank: Rank.RedJoker });
  return deck;
}
function shuffle(arr) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function sortHand(cards) {
  const so = { clubs:0, diamonds:1, hearts:2, spades:3 };
  return [...cards].sort((a,b) => a.rank !== b.rank ? a.rank-b.rank : (a.suit?so[a.suit]:4)-(b.suit?so[b.suit]:4));
}
function dealCards() {
  const deck = shuffle(createDeck());
  return {
    hands: [sortHand(deck.slice(0,17)), sortHand(deck.slice(17,34)), sortHand(deck.slice(34,51))],
    bottomCards: deck.slice(51,54),
  };
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { roomId, nickname, avatarUrl } = event;

  // Find room by roomId field
  const querySnap = await db.collection('rooms').where({ roomId }).get();
  if (!querySnap.data || querySnap.data.length === 0) throw new Error('Room not found');

  const room = querySnap.data[0];
  if (room.status !== 'waiting') throw new Error('Room is not waiting for players');

  const alreadyIn = room.players.some(p => p.openid === OPENID);
  if (!alreadyIn) {
    if (room.players.length >= room.maxPlayers) throw new Error('Room is full');
    room.players.push({
      openid: OPENID,
      nickname: nickname || '玩家',
      avatarUrl: avatarUrl || '',
      slot: room.players.length,
    });
  }

  let updateData = {
    players: room.players,
    updatedAt: db.serverDate(),
  };

  // If room is now full, start the game
  if (room.players.length === room.maxPlayers) {
    const playerIds  = room.players.map(p => p.openid);
    const playerNames = room.players.map(p => p.nickname);
    const startIdx   = Math.floor(Math.random() * 3);
    const turnOrder  = [...playerIds.slice(startIdx), ...playerIds.slice(0, startIdx)];
    const { hands, bottomCards } = dealCards();

    const handMap = Object.fromEntries(turnOrder.map((id, i) => [id, hands[i]]));
    const players = Object.fromEntries(playerIds.map((id, i) => [id, {
      id, name: playerNames[i], hand: handMap[id] || [], isLandlord: false,
    }]));

    const gameState = {
      phase: 'bidding',
      players,
      turnOrder,
      currentTurn: turnOrder[0],
      landlordCards: bottomCards,
      bids: [],
      currentBidder: 0,
      landlord: null,
      trick: { lastCombination: null, lastPlayerId: null, consecutivePasses: 0, lastPass: null },
      multiplier: 1,
      baseScore: 10,
      scores: Object.fromEntries(playerIds.map(id => [id, 0])),
      winner: null,
      winnerTeam: null,
      history: [],
    };

    updateData.status = 'playing';
    updateData.gameState = gameState;
  }

  await db.collection('rooms').doc(room._id).update({ data: updateData });

  const updatedSnap = await db.collection('rooms').doc(room._id).get();
  return { room: updatedSnap.data };
};
