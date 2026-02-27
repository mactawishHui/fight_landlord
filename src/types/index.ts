// ── Card primitives ──────────────────────────────────────────────────────────

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

/** Numeric rank values used for comparison. Higher = stronger. */
export enum Rank {
  Three     = 3,
  Four      = 4,
  Five      = 5,
  Six       = 6,
  Seven     = 7,
  Eight     = 8,
  Nine      = 9,
  Ten       = 10,
  Jack      = 11,
  Queen     = 12,
  King      = 13,
  Ace       = 14,
  Two       = 15,
  BlackJoker = 16,
  RedJoker  = 17,
}

export interface Card {
  /** Unique identifier, e.g. "H9", "BJ", "RJ", "S3" */
  id: string;
  suit: Suit | null; // null for jokers
  rank: Rank;
}

// ── Combination types ─────────────────────────────────────────────────────────

export type CombinationType =
  | 'single'         // 单张
  | 'pair'           // 对子
  | 'triple'         // 三张
  | 'triple_one'     // 三带一
  | 'triple_pair'    // 三带二
  | 'straight'       // 顺子 (≥5 consecutive singles, no 2/joker)
  | 'pair_straight'  // 双顺 (≥3 consecutive pairs, no 2/joker)
  | 'plane'          // 飞机不带 (≥2 consecutive triples, no 2/joker)
  | 'plane_solo'     // 飞机带单
  | 'plane_pair'     // 飞机带对
  | 'four_two'       // 四带两单
  | 'four_pairs'     // 四带两对
  | 'bomb'           // 炸弹
  | 'rocket';        // 火箭 (both jokers)

export interface Combination {
  type: CombinationType;
  /** The rank that determines strength when comparing same-type combos. */
  primaryRank: Rank;
  /** Total number of cards. Used to ensure same shape when comparing. */
  length: number;
  cards: Card[];
}

// ── Player & game state ───────────────────────────────────────────────────────

export type PlayerId = 'human' | 'ai1' | 'ai2';

export interface Player {
  id: PlayerId;
  name: string;
  hand: Card[];
  isLandlord: boolean;
}

export type Phase = 'idle' | 'bidding' | 'playing' | 'game_over';

export interface BidRecord {
  playerId: PlayerId;
  bid: 0 | 1 | 2 | 3; // 0 = pass
}

export interface TrickState {
  lastCombination: Combination | null;
  lastPlayerId: PlayerId | null;
  consecutivePasses: number;
  /** Most recent player who passed — used to show "不出" badge in UI. */
  lastPass: PlayerId | null;
}

export interface GameState {
  phase: Phase;
  players: Record<PlayerId, Player>;
  /** Rotation determines play order; index 0 bids/plays first. */
  turnOrder: PlayerId[];
  currentTurn: PlayerId;
  landlordCards: Card[];   // the 3 hidden bottom cards
  bids: BidRecord[];
  currentBidder: number;   // index into turnOrder
  landlord: PlayerId | null;
  trick: TrickState;
  multiplier: number;      // doubles per bomb/rocket
  baseScore: number;       // bid level × 10
  /** Cumulative scores across rounds. */
  scores: Record<PlayerId, number>;
  winner: PlayerId | null;
  winnerTeam: 'landlord' | 'farmers' | null;
  /** Full play history (null combination = pass). */
  history: Array<{
    playerId: PlayerId;
    combination: Combination | null;
    /** True when this play is a free lead (start of a new trick). */
    isNewTrick?: boolean;
  }>;
}

// ── Action union ──────────────────────────────────────────────────────────────

export type GameAction =
  | { type: 'DEAL' }
  | { type: 'BID'; playerId: PlayerId; bid: 0 | 1 | 2 | 3 }
  | { type: 'PLAY'; playerId: PlayerId; cards: Card[] }
  | { type: 'PASS'; playerId: PlayerId }
  | { type: 'NEXT_ROUND' };
