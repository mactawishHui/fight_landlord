// ── Shared server types ───────────────────────────────────────────────────────

export interface User {
  id: number;
  openid: string;
  nickname: string;
  avatarUrl: string;
  totalScore: number;
  totalWins: number;
  totalLosses: number;
}

export interface Room {
  id: number;
  roomCode: string;
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  gameState: GameState | null;
  players: RoomPlayer[];
}

export interface RoomPlayer {
  userId: number;
  openid: string;
  nickname: string;
  slot: number;
}

// ── Minimal GameState types (mirrors miniprogram/src/logic) ──────────────────

export interface Card {
  id: string;
  suit: string | null;
  rank: number;
}

export interface Combination {
  type: string;
  primaryRank: number;
  length: number;
  cards: Card[];
}

export interface TrickState {
  lastCombination: Combination | null;
  lastPlayerId: string | null;
  consecutivePasses: number;
  lastPass: string | null;
}

export interface PlayerState {
  id: string;
  name: string;
  hand: Card[];
  isLandlord: boolean;
}

export interface GameState {
  phase: 'idle' | 'bidding' | 'playing' | 'game_over';
  players: Record<string, PlayerState>;
  turnOrder: string[];
  currentTurn: string;
  landlordCards: Card[];
  bids: Array<{ playerId: string; bid: number }>;
  currentBidder: number;
  landlord: string | null;
  trick: TrickState;
  multiplier: number;
  baseScore: number;
  scores: Record<string, number>;
  winner: string | null;
  winnerTeam: 'landlord' | 'farmers' | null;
  history: Array<{ playerId: string; combination: Combination | null; isNewTrick?: boolean }>;
}

// ── WebSocket message types ───────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'AUTH';        token: string }
  | { type: 'CREATE_ROOM' }
  | { type: 'JOIN_ROOM';   roomCode: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'GAME_ACTION'; action: GameAction }
  | { type: 'PING' };

export type GameAction =
  | { type: 'BID';  playerId: string; bid: 0 | 1 | 2 | 3 }
  | { type: 'PLAY'; playerId: string; cards: Card[] }
  | { type: 'PASS'; playerId: string }
  | { type: 'NEXT_ROUND' };

export type ServerMessage =
  | { type: 'AUTHENTICATED'; user: User }
  | { type: 'ROOM_CREATED';  room: Room }
  | { type: 'ROOM_JOINED';   room: Room; mySlot: number }
  | { type: 'ROOM_UPDATE';   room: Room }
  | { type: 'GAME_STATE';    gameState: GameState }
  | { type: 'GAME_OVER';     gameState: GameState }
  | { type: 'ERROR';         message: string }
  | { type: 'PONG' };
