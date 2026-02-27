import { GameState, GameAction, PlayerId } from '../types';
import { deal, sortHand } from './deck';
import { detectCombination, beats } from './combinations';
import { computeScore } from './scoring';

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextPlayer(order: PlayerId[], current: PlayerId): PlayerId {
  const idx = order.indexOf(current);
  return order[(idx + 1) % 3];
}

const EMPTY_TRICK = {
  lastCombination: null,
  lastPlayerId: null,
  consecutivePasses: 0,
  lastPass: null,
} as const;

function endBidding(state: GameState): GameState {
  const { bids, players, landlordCards } = state;
  const maxBid = Math.max(...bids.map(b => b.bid));

  // All passed → redeal
  if (maxBid === 0) {
    return gameReducer(createInitialState(state.scores), { type: 'DEAL' });
  }

  const landlordBid = bids.find(b => b.bid === maxBid)!;
  const landlordId  = landlordBid.playerId;
  const baseScore   = maxBid * 10;
  const landlordHand = sortHand([...players[landlordId].hand, ...landlordCards]);

  return {
    ...state,
    phase: 'playing',
    players: {
      ...players,
      [landlordId]: { ...players[landlordId], hand: landlordHand, isLandlord: true },
    },
    landlord:    landlordId,
    currentTurn: landlordId,
    baseScore,
  };
}

// ── Initial state ─────────────────────────────────────────────────────────────

export function createInitialState(
  existingScores?: Record<PlayerId, number>,
): GameState {
  const scores = existingScores ?? { human: 0, ai1: 0, ai2: 0 };
  return {
    phase: 'idle',
    players: {
      human: { id: 'human', name: '你',   hand: [], isLandlord: false },
      ai1:   { id: 'ai1',   name: '小明', hand: [], isLandlord: false },
      ai2:   { id: 'ai2',   name: '小红', hand: [], isLandlord: false },
    },
    turnOrder:    ['human', 'ai1', 'ai2'],
    currentTurn:  'human',
    landlordCards: [],
    bids:          [],
    currentBidder: 0,
    landlord:      null,
    trick:         { ...EMPTY_TRICK },
    multiplier:    1,
    baseScore:     10,
    scores,
    winner:        null,
    winnerTeam:    null,
    history:       [],
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {

    // ── DEAL ────────────────────────────────────────────────────────────────
    case 'DEAL': {
      const { hands, bottomCards } = deal();
      const startIdx = Math.floor(Math.random() * 3);
      const baseOrder: PlayerId[] = ['human', 'ai1', 'ai2'];
      const turnOrder = [
        ...baseOrder.slice(startIdx),
        ...baseOrder.slice(0, startIdx),
      ] as PlayerId[];

      return {
        ...state,
        phase: 'bidding',
        players: {
          human: { id: 'human', name: '你',   hand: hands[0], isLandlord: false },
          ai1:   { id: 'ai1',   name: '小明', hand: hands[1], isLandlord: false },
          ai2:   { id: 'ai2',   name: '小红', hand: hands[2], isLandlord: false },
        },
        turnOrder,
        currentTurn:   turnOrder[0],
        landlordCards: bottomCards,
        bids:          [],
        currentBidder: 0,
        landlord:      null,
        trick:         { ...EMPTY_TRICK },
        multiplier:    1,
        winner:        null,
        winnerTeam:    null,
        history:       [],
      };
    }

    // ── BID ─────────────────────────────────────────────────────────────────
    case 'BID': {
      if (state.phase !== 'bidding') return state;
      if (state.currentTurn !== action.playerId) return state;

      const newBids       = [...state.bids, { playerId: action.playerId, bid: action.bid }];
      const nextBidderIdx = state.currentBidder + 1;

      if (newBids.length === 3 || action.bid === 3) {
        return endBidding({ ...state, bids: newBids });
      }

      return {
        ...state,
        bids:          newBids,
        currentBidder: nextBidderIdx,
        currentTurn:   state.turnOrder[nextBidderIdx],
      };
    }

    // ── PLAY ────────────────────────────────────────────────────────────────
    case 'PLAY': {
      if (state.phase !== 'playing') return state;
      if (state.currentTurn !== action.playerId) return state;

      const combo = detectCombination(action.cards);
      if (!combo) return state;

      if (state.trick.lastCombination !== null) {
        if (!beats(state.trick.lastCombination, combo)) return state;
      }

      // Is this a free lead (start of a new trick)?
      const isNewTrick = state.trick.lastCombination === null;

      const playedIds = new Set(action.cards.map(c => c.id));
      const newHand   = state.players[action.playerId].hand.filter(c => !playedIds.has(c.id));

      let newMultiplier = state.multiplier;
      if (combo.type === 'bomb' || combo.type === 'rocket') newMultiplier *= 2;

      const updatedPlayers = {
        ...state.players,
        [action.playerId]: { ...state.players[action.playerId], hand: newHand },
      };

      const newHistory = [
        ...state.history,
        { playerId: action.playerId, combination: combo, isNewTrick },
      ];

      // Check for winner
      if (newHand.length === 0) {
        const winner    = action.playerId;
        const winnerTeam = winner === state.landlord ? 'landlord' : 'farmers';
        const delta     = computeScore(winner, state.landlord!, state.baseScore, newMultiplier);
        return {
          ...state,
          phase: 'game_over',
          players: updatedPlayers,
          multiplier: newMultiplier,
          winner,
          winnerTeam: winnerTeam as 'landlord' | 'farmers',
          scores: {
            human: state.scores.human + delta.human,
            ai1:   state.scores.ai1   + delta.ai1,
            ai2:   state.scores.ai2   + delta.ai2,
          },
          history: newHistory,
          trick: { lastCombination: combo, lastPlayerId: action.playerId, consecutivePasses: 0, lastPass: null },
        };
      }

      return {
        ...state,
        players:    updatedPlayers,
        multiplier: newMultiplier,
        trick:      { lastCombination: combo, lastPlayerId: action.playerId, consecutivePasses: 0, lastPass: null },
        currentTurn: nextPlayer(state.turnOrder, action.playerId),
        history:    newHistory,
      };
    }

    // ── PASS ────────────────────────────────────────────────────────────────
    case 'PASS': {
      if (state.phase !== 'playing') return state;
      if (state.currentTurn !== action.playerId) return state;
      if (state.trick.lastCombination === null) return state;

      const newPasses = state.trick.consecutivePasses + 1;
      const newHistory = [...state.history, { playerId: action.playerId, combination: null }];

      // Two consecutive passes → winner of trick leads a fresh trick
      // lastPass is cleared (null) so the "不出" badge doesn't linger into the new trick
      if (newPasses >= 2) {
        return {
          ...state,
          trick:       { lastCombination: null, lastPlayerId: null, consecutivePasses: 0, lastPass: null },
          currentTurn: state.trick.lastPlayerId!,
          history:     newHistory,
        };
      }

      return {
        ...state,
        trick: {
          ...state.trick,
          consecutivePasses: newPasses,
          lastPass: action.playerId,  // record who just passed for UI
        },
        currentTurn: nextPlayer(state.turnOrder, action.playerId),
        history:     newHistory,
      };
    }

    // ── NEXT_ROUND ──────────────────────────────────────────────────────────
    case 'NEXT_ROUND': {
      return gameReducer(createInitialState(state.scores), { type: 'DEAL' });
    }

    default:
      return state;
  }
}
