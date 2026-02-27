import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { Card, GameAction, GameState, PlayerId, CombinationType } from '../types';
import { gameReducer, createInitialState } from '../logic/gameEngine';
import { aiBidDecision, aiChoosePlay } from '../logic/ai';
import { AudioManager, SfxName } from '../utils/AudioManager';

// Combo type → SFX name mapping
const COMBO_SFX_MAP: Partial<Record<CombinationType, SfxName>> = {
  straight:      'straight',
  pair_straight: 'pair_straight',
  plane:         'plane',
  plane_solo:    'plane',
  plane_pair:    'plane',
  bomb:          'bomb',
  rocket:        'rocket',
};

// ── Context shape ─────────────────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  playCards: (cards: Card[]) => void;
  pass: () => void;
  bid: (amount: 0 | 1 | 2 | 3) => void;
  startGame: () => void;
  nextRound: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const prevPhaseRef    = useRef<string>('idle');
  const prevHistoryLen  = useRef<number>(0);

  // ── Audio: bid SFX ───────────────────────────────────────────────────────
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    // New bidding round started
    if (state.phase === 'bidding' && prevPhase !== 'bidding') {
      AudioManager.playSfx('bid').catch(() => {});
    }
    // Game over
    if (state.phase === 'game_over' && prevPhase !== 'game_over') {
      const humanIsLandlord = state.players.human.isLandlord;
      const humanWon = (state.winnerTeam === 'landlord') === humanIsLandlord;
      setTimeout(() => {
        AudioManager.playSfx(humanWon ? 'win' : 'lose').catch(() => {});
      }, 600);
    }
  }, [state.phase]);

  // ── Audio: play/pass SFX ─────────────────────────────────────────────────
  useEffect(() => {
    if (state.history.length <= prevHistoryLen.current) {
      prevHistoryLen.current = state.history.length;
      return;
    }
    prevHistoryLen.current = state.history.length;
    const last = state.history[state.history.length - 1];
    if (!last) return;
    if (!last.combination) {
      AudioManager.playSfx('pass').catch(() => {});
      return;
    }
    const sfx: SfxName = COMBO_SFX_MAP[last.combination.type] ?? 'play_card';
    AudioManager.playSfx(sfx).catch(() => {});
    // Extra: trick_win when this play starts a new trick (opponent cleared)
    if (last.isNewTrick && state.phase === 'playing') {
      setTimeout(() => AudioManager.playSfx('trick_win').catch(() => {}), 200);
    }
  }, [state.history.length]);

  // ── AI turn automation ───────────────────────────────────────────────────
  useEffect(() => {
    const { phase, currentTurn, players, trick, landlord, bids } = state;

    // AI bidding
    if (phase === 'bidding' && currentTurn !== 'human') {
      const delay = 600 + Math.random() * 600;
      const timer = setTimeout(() => {
        const currentMaxBid = bids.length > 0 ? Math.max(...bids.map(b => b.bid)) : 0;
        const bidAmount = aiBidDecision(players[currentTurn].hand, currentMaxBid);
        dispatch({ type: 'BID', playerId: currentTurn, bid: bidAmount });
      }, delay);
      return () => clearTimeout(timer);
    }

    // AI playing
    if (phase === 'playing' && currentTurn !== 'human') {
      const delay = 800 + Math.random() * 500;
      const timer = setTimeout(() => {
        const player = players[currentTurn];
        const handSizes: Record<PlayerId, number> = {
          human: players.human.hand.length,
          ai1:   players.ai1.hand.length,
          ai2:   players.ai2.hand.length,
        };
        const cards = aiChoosePlay(
          player.hand,
          trick.lastCombination,
          trick.lastPlayerId,
          currentTurn,
          landlord,
          state.turnOrder,
          handSizes,
        );
        if (cards && cards.length > 0) {
          dispatch({ type: 'PLAY', playerId: currentTurn, cards });
        } else {
          dispatch({ type: 'PASS', playerId: currentTurn });
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [state.currentTurn, state.phase]);

  // ── Human action helpers ─────────────────────────────────────────────────

  const playCards = useCallback(
    (cards: Card[]) => dispatch({ type: 'PLAY', playerId: 'human', cards }),
    [],
  );
  const pass = useCallback(
    () => dispatch({ type: 'PASS', playerId: 'human' }),
    [],
  );
  const bid = useCallback(
    (amount: 0 | 1 | 2 | 3) => dispatch({ type: 'BID', playerId: 'human', bid: amount }),
    [],
  );
  const startGame = useCallback(() => dispatch({ type: 'DEAL' }), []);
  const nextRound  = useCallback(() => dispatch({ type: 'NEXT_ROUND' }), []);

  return (
    <GameContext.Provider value={{ state, playCards, pass, bid, startGame, nextRound }}>
      {children}
    </GameContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within <GameProvider>');
  return ctx;
}
