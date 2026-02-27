/**
 * Pure game reducer — identical logic to the React Native version but
 * works with generic player IDs (supports both AI and human online players).
 *
 * Player IDs in solo mode: 'human', 'ai1', 'ai2'
 * Player IDs in multiplayer: WeChat openids
 */
import { deal, sortHand } from './deck.js';
import { detectCombination, beats } from './combinations.js';
import { computeScore } from './scoring.js';

function nextPlayer(order, current) {
  const idx = order.indexOf(current);
  return order[(idx + 1) % 3];
}

const EMPTY_TRICK = {
  lastCombination: null,
  lastPlayerId: null,
  consecutivePasses: 0,
  lastPass: null,
};

function endBidding(state) {
  const { bids, players, landlordCards } = state;
  const maxBid = Math.max(...bids.map(b => b.bid));
  if (maxBid === 0) {
    return gameReducer(createInitialState(state.scores, state.turnOrder), { type: 'DEAL' });
  }
  const landlordBid = bids.find(b => b.bid === maxBid);
  const landlordId = landlordBid.playerId;
  const baseScore = maxBid * 10;
  const landlordHand = sortHand([...players[landlordId].hand, ...landlordCards]);
  return {
    ...state,
    phase: 'playing',
    players: {
      ...players,
      [landlordId]: { ...players[landlordId], hand: landlordHand, isLandlord: true },
    },
    landlord: landlordId,
    currentTurn: landlordId,
    baseScore,
  };
}

/**
 * Create initial game state.
 * @param {Record<string, number>} existingScores
 * @param {string[]} playerIds - array of 3 player IDs (openids or 'human'/'ai1'/'ai2')
 * @param {string[]} playerNames - display names
 */
export function createInitialState(existingScores, playerIds, playerNames) {
  const ids = playerIds || ['human', 'ai1', 'ai2'];
  const names = playerNames || ['你', '小明', '小红'];
  const scores = existingScores ?? Object.fromEntries(ids.map(id => [id, 0]));
  const players = Object.fromEntries(ids.map((id, i) => [id, {
    id, name: names[i], hand: [], isLandlord: false,
  }]));
  return {
    phase: 'idle',
    players,
    turnOrder: ids,
    currentTurn: ids[0],
    landlordCards: [],
    bids: [],
    currentBidder: 0,
    landlord: null,
    trick: { ...EMPTY_TRICK },
    multiplier: 1,
    baseScore: 10,
    scores,
    winner: null,
    winnerTeam: null,
    history: [],
  };
}

export function gameReducer(state, action) {
  switch (action.type) {

    case 'DEAL': {
      const { hands, bottomCards } = deal();
      const startIdx = Math.floor(Math.random() * 3);
      const baseOrder = state.turnOrder;
      const turnOrder = [
        ...baseOrder.slice(startIdx),
        ...baseOrder.slice(0, startIdx),
      ];
      const playerEntries = Object.entries(state.players);
      const updatedPlayers = Object.fromEntries(
        playerEntries.map(([id, p], i) => {
          const orderIdx = turnOrder.indexOf(id);
          return [id, { ...p, hand: hands[orderIdx] ?? [], isLandlord: false }];
        })
      );
      // Assign hands by turn order position
      const handMap = Object.fromEntries(turnOrder.map((id, i) => [id, hands[i]]));
      const playersWithHands = Object.fromEntries(
        Object.keys(state.players).map(id => [id, { ...state.players[id], hand: handMap[id] || [], isLandlord: false }])
      );
      return {
        ...state,
        phase: 'bidding',
        players: playersWithHands,
        turnOrder,
        currentTurn: turnOrder[0],
        landlordCards: bottomCards,
        bids: [],
        currentBidder: 0,
        landlord: null,
        trick: { ...EMPTY_TRICK },
        multiplier: 1,
        winner: null,
        winnerTeam: null,
        history: [],
      };
    }

    case 'BID': {
      if (state.phase !== 'bidding') return state;
      if (state.currentTurn !== action.playerId) return state;
      const newBids = [...state.bids, { playerId: action.playerId, bid: action.bid }];
      const nextBidderIdx = state.currentBidder + 1;
      if (newBids.length === 3 || action.bid === 3) {
        return endBidding({ ...state, bids: newBids });
      }
      return {
        ...state,
        bids: newBids,
        currentBidder: nextBidderIdx,
        currentTurn: state.turnOrder[nextBidderIdx],
      };
    }

    case 'PLAY': {
      if (state.phase !== 'playing') return state;
      if (state.currentTurn !== action.playerId) return state;
      const combo = detectCombination(action.cards);
      if (!combo) return state;
      if (state.trick.lastCombination !== null && !beats(state.trick.lastCombination, combo)) return state;

      const isNewTrick = state.trick.lastCombination === null;
      const playedIds = new Set(action.cards.map(c => c.id));
      const newHand = state.players[action.playerId].hand.filter(c => !playedIds.has(c.id));
      let newMultiplier = state.multiplier;
      if (combo.type === 'bomb' || combo.type === 'rocket') newMultiplier *= 2;

      const updatedPlayers = {
        ...state.players,
        [action.playerId]: { ...state.players[action.playerId], hand: newHand },
      };
      const newHistory = [...state.history, { playerId: action.playerId, combination: combo, isNewTrick }];

      if (newHand.length === 0) {
        const winner = action.playerId;
        const winnerTeam = winner === state.landlord ? 'landlord' : 'farmers';
        const delta = computeScore(winner, state.landlord, state.baseScore, newMultiplier, state.turnOrder);
        const newScores = Object.fromEntries(
          state.turnOrder.map(id => [id, (state.scores[id] ?? 0) + (delta[id] ?? 0)])
        );
        return {
          ...state,
          phase: 'game_over',
          players: updatedPlayers,
          multiplier: newMultiplier,
          winner,
          winnerTeam,
          scores: newScores,
          history: newHistory,
          trick: { lastCombination: combo, lastPlayerId: action.playerId, consecutivePasses: 0, lastPass: null },
        };
      }

      return {
        ...state,
        players: updatedPlayers,
        multiplier: newMultiplier,
        trick: { lastCombination: combo, lastPlayerId: action.playerId, consecutivePasses: 0, lastPass: null },
        currentTurn: nextPlayer(state.turnOrder, action.playerId),
        history: newHistory,
      };
    }

    case 'PASS': {
      if (state.phase !== 'playing') return state;
      if (state.currentTurn !== action.playerId) return state;
      if (state.trick.lastCombination === null) return state;

      const newPasses = state.trick.consecutivePasses + 1;
      const newHistory = [...state.history, { playerId: action.playerId, combination: null }];
      if (newPasses >= 2) {
        return {
          ...state,
          trick: { lastCombination: null, lastPlayerId: null, consecutivePasses: 0, lastPass: null },
          currentTurn: state.trick.lastPlayerId,
          history: newHistory,
        };
      }
      return {
        ...state,
        trick: { ...state.trick, consecutivePasses: newPasses, lastPass: action.playerId },
        currentTurn: nextPlayer(state.turnOrder, action.playerId),
        history: newHistory,
      };
    }

    case 'NEXT_ROUND': {
      return gameReducer(createInitialState(state.scores, state.turnOrder, state.turnOrder.map(id => state.players[id].name)), { type: 'DEAL' });
    }

    default:
      return state;
  }
}
