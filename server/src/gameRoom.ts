/**
 * WebSocket Game Room Manager.
 *
 * Each room has up to 3 players. Game state is computed server-side
 * and broadcast to all connected clients in the room.
 *
 * This provides a lower-latency alternative to WeChat Cloud Functions
 * for multiplayer game actions.
 */
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { User, Room, GameState, GameAction, ServerMessage, ClientMessage } from './types';

// ── Shared game logic (mirrored from miniprogram/cloudfunctions/playAction) ───

const _SUITS = ['clubs','diamonds','hearts','spades'] as const;
const _NORMAL_RANKS = [3,4,5,6,7,8,9,10,11,12,13,14,15];

function _createDeck() {
  const d: any[] = [];
  for (const s of _SUITS) for (const r of _NORMAL_RANKS) d.push({ id: `${s[0].toUpperCase()}${r}`, suit: s, rank: r });
  d.push({ id: 'BJ', suit: null, rank: 16 }, { id: 'RJ', suit: null, rank: 17 });
  return d;
}
function _shuffle<T>(a: T[]): T[] { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; }
function _sortHand(c: any[]): any[] { const so: any={clubs:0,diamonds:1,hearts:2,spades:3}; return [...c].sort((a,b)=>a.rank!==b.rank?a.rank-b.rank:(a.suit?so[a.suit]:4)-(b.suit?so[b.suit]:4)); }
function _dealCards() { const d=_shuffle(_createDeck()); return { hands:[_sortHand(d.slice(0,17)),_sortHand(d.slice(17,34)),_sortHand(d.slice(34,51))], bottomCards:d.slice(51,54) }; }
function _rankFreq(cards: any[]) { const m=new Map<number,any[]>(); for(const c of cards){const g=m.get(c.rank)??[];g.push(c);m.set(c.rank,g);} return m; }
function _sortedKeys(m: Map<number,any[]>) { return Array.from(m.keys()).sort((a,b)=>a-b); }
function _isConsec(r: number[]) { for(let i=1;i<r.length;i++) if(r[i]!==r[i-1]+1) return false; return true; }
function _noTwo(r: number[]) { return r.every(x=>x<=14); } // Ace = 14
function _mk(t: string,p: number,l: number,c: any[]) { return {type:t,primaryRank:p,length:l,cards:c}; }

function _detectCombination(cards: any[]): any {
  if(!cards||cards.length===0) return null;
  const n=cards.length, freq=_rankFreq(cards), ranks=_sortedKeys(freq);
  const wc=(k: number)=>ranks.filter(r=>freq.get(r)!.length===k);
  const wa=(k: number)=>ranks.filter(r=>freq.get(r)!.length>=k);
  if(n===2&&freq.has(16)&&freq.has(17)) return _mk('rocket',17,2,cards);
  if(n===1) return _mk('single',ranks[0],1,cards);
  if(n===2&&wc(2).length===1) return _mk('pair',wc(2)[0],2,cards);
  if(n===3&&wc(3).length===1) return _mk('triple',wc(3)[0],3,cards);
  if(n===4&&wc(4).length===1) return _mk('bomb',wc(4)[0],4,cards);
  if(n===4){const t=wc(3); if(t.length===1&&wc(1).length===1) return _mk('triple_one',t[0],4,cards);}
  if(n===5){const t=wc(3),p=wc(2); if(t.length===1&&p.length===1) return _mk('triple_pair',t[0],5,cards);}
  if(n>=5&&wc(1).length===n&&_noTwo(ranks)&&_isConsec(ranks)) return _mk('straight',ranks[ranks.length-1],n,cards);
  if(n>=6&&n%2===0){const pr=wc(2); if(pr.length===n/2&&pr.length>=3&&_noTwo(pr)&&_isConsec(pr)) return _mk('pair_straight',pr[pr.length-1],n,cards);}
  const tr=wa(3).filter(r=>r<=14);
  if(tr.length>=2) for(let s=0;s<tr.length;s++) for(let len=2;s+len<=tr.length;len++){
    const seq=tr.slice(s,s+len); if(!_isConsec(seq)) break;
    const pid=new Set<string>(); seq.forEach(r=>freq.get(r)!.slice(0,3).forEach((c: any)=>pid.add(c.id)));
    const rem=cards.filter(c=>!pid.has(c.id)); const primary=seq[seq.length-1];
    if(rem.length===0&&n===len*3) return _mk('plane',primary,n,cards);
    if(rem.length===len&&n===len*4) return _mk('plane_solo',primary,n,cards);
    if(rem.length===len*2&&n===len*5&&Array.from(_rankFreq(rem).values()).every(g=>g.length===2)) return _mk('plane_pair',primary,n,cards);
  }
  if(n===6){const q=wc(4); if(q.length===1&&cards.filter(c=>!new Set(freq.get(q[0])!.map((x: any)=>x.id)).has(c.id)).length===2) return _mk('four_two',q[0],6,cards);}
  if(n===8){const q=wc(4); if(q.length===1){const qi=new Set(freq.get(q[0])!.map((c: any)=>c.id)); const rem=cards.filter(c=>!qi.has(c.id)); if(rem.length===4&&Array.from(_rankFreq(rem).values()).every(g=>g.length===2)) return _mk('four_pairs',q[0],8,cards);}}
  return null;
}

function _beats(cur: any, nxt: any): boolean {
  if(nxt.type==='rocket') return true; if(cur.type==='rocket') return false;
  if(nxt.type==='bomb'&&cur.type!=='bomb') return true; if(cur.type==='bomb'&&nxt.type!=='bomb') return false;
  if(nxt.type==='bomb'&&cur.type==='bomb') return nxt.primaryRank>cur.primaryRank;
  if(nxt.type!==cur.type) return false; if(nxt.length!==cur.length) return false;
  return nxt.primaryRank>cur.primaryRank;
}

function _nextPlayer(order: string[], cur: string): string { const i=order.indexOf(cur); return order[(i+1)%3]; }

function _computeScore(winner: string, landlord: string, base: number, mult: number, pids: string[]) {
  const final=base*mult, isLW=winner===landlord, delta: Record<string,number>={};
  for(const id of pids) delta[id]=id===landlord?(isLW?final*2:-final*2):(isLW?-final:final);
  return delta;
}

function applyAction(state: GameState, action: GameAction): GameState {
  const { phase, players, currentTurn, trick, turnOrder, bids, landlordCards } = state as any;

  if (action.type === 'BID') {
    if (phase !== 'bidding') throw new Error('Not bidding phase');
    if (currentTurn !== action.playerId) throw new Error('Not your turn');
    const newBids = [...(bids||[]), { playerId: action.playerId, bid: (action as any).bid }];
    const nextIdx = (state as any).currentBidder + 1;
    if (newBids.length === 3 || (action as any).bid === 3) {
      const maxBid = Math.max(...newBids.map((b: any) => b.bid));
      if (maxBid === 0) {
        const si=Math.floor(Math.random()*3), to=[...turnOrder.slice(si),...turnOrder.slice(0,si)];
        const { hands, bottomCards: bc } = _dealCards();
        const hm=Object.fromEntries(to.map((id: string,i: number)=>[id,hands[i]]));
        const np=Object.fromEntries(Object.keys(players).map((id: string)=>[id,{...players[id],hand:hm[id]??[],isLandlord:false}]));
        return {...state,phase:'bidding',players:np,turnOrder:to,currentTurn:to[0],landlordCards:bc,bids:[],currentBidder:0,landlord:null,trick:{lastCombination:null,lastPlayerId:null,consecutivePasses:0,lastPass:null},multiplier:1,winner:null,winnerTeam:null,history:[]} as any;
      }
      const lbid=newBids.find((b: any)=>b.bid===maxBid)!;
      const lid=lbid.playerId;
      const lHand=_sortHand([...players[lid].hand,...landlordCards]);
      return {...state,phase:'playing',players:{...players,[lid]:{...players[lid],hand:lHand,isLandlord:true}},landlord:lid,currentTurn:lid,baseScore:maxBid*10,bids:newBids} as any;
    }
    return {...state,bids:newBids,currentBidder:nextIdx,currentTurn:turnOrder[nextIdx]} as any;
  }

  if (action.type === 'PLAY') {
    if (phase !== 'playing') throw new Error('Not playing phase');
    if (currentTurn !== action.playerId) throw new Error('Not your turn');
    const handIds=new Set(players[action.playerId].hand.map((c: any)=>c.id));
    for(const c of (action as any).cards) if(!handIds.has(c.id)) throw new Error('Card not in hand');
    const combo=_detectCombination((action as any).cards);
    if(!combo) throw new Error('Invalid combination');
    if(trick.lastCombination!==null&&!_beats(trick.lastCombination,combo)) throw new Error('Cannot beat current play');
    const isNewTrick=trick.lastCombination===null;
    const playedIds=new Set((action as any).cards.map((c: any)=>c.id));
    const newHand=players[action.playerId].hand.filter((c: any)=>!playedIds.has(c.id));
    let newMult=(state as any).multiplier;
    if(combo.type==='bomb'||combo.type==='rocket') newMult*=2;
    const up={...players,[action.playerId]:{...players[action.playerId],hand:newHand}};
    const hist=[...(state as any).history,{playerId:action.playerId,combination:combo,isNewTrick}];
    if(newHand.length===0){
      const w=action.playerId,wt=w===(state as any).landlord?'landlord':'farmers';
      const delta=_computeScore(w,(state as any).landlord,(state as any).baseScore,newMult,turnOrder);
      const sc=Object.fromEntries(turnOrder.map((id: string)=>[id,((state as any).scores[id]??0)+(delta[id]??0)]));
      return {...state,phase:'game_over',players:up,multiplier:newMult,winner:w,winnerTeam:wt,scores:sc,history:hist,trick:{lastCombination:combo,lastPlayerId:action.playerId,consecutivePasses:0,lastPass:null}} as any;
    }
    return {...state,players:up,multiplier:newMult,trick:{lastCombination:combo,lastPlayerId:action.playerId,consecutivePasses:0,lastPass:null},currentTurn:_nextPlayer(turnOrder,action.playerId),history:hist} as any;
  }

  if (action.type === 'PASS') {
    if (phase !== 'playing') throw new Error('Not playing phase');
    if (currentTurn !== action.playerId) throw new Error('Not your turn');
    if (trick.lastCombination===null) throw new Error('Cannot pass when leading');
    const np=trick.consecutivePasses+1;
    const hist=[...(state as any).history,{playerId:action.playerId,combination:null}];
    if(np>=2) return {...state,trick:{lastCombination:null,lastPlayerId:null,consecutivePasses:0,lastPass:null},currentTurn:trick.lastPlayerId,history:hist} as any;
    return {...state,trick:{...trick,consecutivePasses:np,lastPass:action.playerId},currentTurn:_nextPlayer(turnOrder,action.playerId),history:hist} as any;
  }

  if (action.type === 'NEXT_ROUND') {
    const si=Math.floor(Math.random()*3), to=[...turnOrder.slice(si),...turnOrder.slice(0,si)];
    const { hands, bottomCards: bc } = _dealCards();
    const hm=Object.fromEntries(to.map((id: string,i: number)=>[id,hands[i]]));
    const np=Object.fromEntries(Object.keys(players).map((id: string)=>[id,{...players[id],hand:hm[id]??[],isLandlord:false}]));
    return {...state,phase:'bidding',players:np,turnOrder:to,currentTurn:to[0],landlordCards:bc,bids:[],currentBidder:0,landlord:null,trick:{lastCombination:null,lastPlayerId:null,consecutivePasses:0,lastPass:null},multiplier:1,winner:null,winnerTeam:null,history:[]} as any;
  }

  throw new Error(`Unknown action type: ${(action as any).type}`);
}

// ── Connected client ──────────────────────────────────────────────────────────

interface ConnectedClient {
  ws:     WebSocket;
  user:   User;
  roomId: string | null;
}

// ── In-memory rooms ───────────────────────────────────────────────────────────

interface LiveRoom {
  id:         string;
  roomCode:   string;
  status:     'waiting' | 'playing' | 'finished';
  players:    Array<{ userId: number; openid: string; nickname: string; slot: number; ws: WebSocket }>;
  gameState:  GameState | null;
  createdAt:  Date;
}

const rooms     = new Map<string, LiveRoom>();   // roomId → LiveRoom
const roomCodes = new Map<string, string>();     // roomCode → roomId
const clients   = new Map<WebSocket, ConnectedClient>();

// ── Public API ────────────────────────────────────────────────────────────────

export function registerClient(ws: WebSocket, user: User): void {
  clients.set(ws, { ws, user, roomId: null });
  ws.on('close', () => handleDisconnect(ws));
}

export function handleMessage(ws: WebSocket, raw: string): void {
  const client = clients.get(ws);
  if (!client) return;
  let msg: ClientMessage;
  try { msg = JSON.parse(raw); } catch { return; }

  switch (msg.type) {
    case 'CREATE_ROOM':  handleCreateRoom(client); break;
    case 'JOIN_ROOM':    handleJoinRoom(client, msg.roomCode); break;
    case 'LEAVE_ROOM':   handleLeaveRoom(client); break;
    case 'GAME_ACTION':  handleGameAction(client, msg.action); break;
    case 'PING':         send(ws, { type: 'PONG' }); break;
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleCreateRoom(client: ConnectedClient): void {
  const roomId   = uuidv4();
  const roomCode = generateRoomCode();
  const room: LiveRoom = {
    id: roomId, roomCode, status: 'waiting', players: [], gameState: null, createdAt: new Date(),
  };
  rooms.set(roomId, room);
  roomCodes.set(roomCode, roomId);
  _joinRoom(client, room);
  send(client.ws, { type: 'ROOM_CREATED', room: _toPublicRoom(room) });
}

function handleJoinRoom(client: ConnectedClient, roomCode: string): void {
  const roomId = roomCodes.get(roomCode.toUpperCase());
  if (!roomId) { send(client.ws, { type: 'ERROR', message: '房间不存在' }); return; }
  const room = rooms.get(roomId);
  if (!room) { send(client.ws, { type: 'ERROR', message: '房间不存在' }); return; }
  if (room.status !== 'waiting') { send(client.ws, { type: 'ERROR', message: '游戏已开始' }); return; }
  if (room.players.length >= 3) { send(client.ws, { type: 'ERROR', message: '房间已满' }); return; }

  const slot = room.players.length;
  _joinRoom(client, room);
  send(client.ws, { type: 'ROOM_JOINED', room: _toPublicRoom(room), mySlot: slot });
  broadcastRoom(room, { type: 'ROOM_UPDATE', room: _toPublicRoom(room) });

  // Auto-start when 3 players joined
  if (room.players.length === 3) {
    startGame(room);
  }
}

function handleLeaveRoom(client: ConnectedClient): void {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (room) {
    room.players = room.players.filter(p => p.openid !== client.user.openid);
    broadcastRoom(room, { type: 'ROOM_UPDATE', room: _toPublicRoom(room) });
    if (room.players.length === 0) {
      rooms.delete(room.id);
      roomCodes.delete(room.roomCode);
    }
  }
  client.roomId = null;
}

function handleGameAction(client: ConnectedClient, action: GameAction): void {
  if (!client.roomId) { send(client.ws, { type: 'ERROR', message: '不在房间中' }); return; }
  const room = rooms.get(client.roomId);
  if (!room || !room.gameState) { send(client.ws, { type: 'ERROR', message: '游戏未开始' }); return; }

  // Security: force playerId to caller's openid
  const secureAction = { ...action, playerId: client.user.openid } as GameAction;

  try {
    const newState = applyAction(room.gameState, secureAction);
    room.gameState = newState;
    if ((newState as any).phase === 'game_over') room.status = 'finished';
    broadcastRoom(room, { type: 'GAME_STATE', gameState: newState });
  } catch (e: any) {
    send(client.ws, { type: 'ERROR', message: e.message });
  }
}

function handleDisconnect(ws: WebSocket): void {
  const client = clients.get(ws);
  if (client) handleLeaveRoom(client);
  clients.delete(ws);
}

// ── Game start ────────────────────────────────────────────────────────────────

function startGame(room: LiveRoom): void {
  const playerIds   = room.players.map(p => p.openid);
  const playerNames = room.players.map(p => p.nickname);
  const startIdx    = Math.floor(Math.random() * 3);
  const turnOrder   = [...playerIds.slice(startIdx), ...playerIds.slice(0, startIdx)];
  const { hands, bottomCards } = _dealCards();
  const handMap     = Object.fromEntries(turnOrder.map((id, i) => [id, hands[i]]));
  const players     = Object.fromEntries(playerIds.map((id, i) => [id, { id, name: playerNames[i], hand: handMap[id] ?? [], isLandlord: false }]));

  room.status = 'playing';
  room.gameState = {
    phase: 'bidding', players, turnOrder, currentTurn: turnOrder[0],
    landlordCards: bottomCards, bids: [], currentBidder: 0, landlord: null,
    trick: { lastCombination: null, lastPlayerId: null, consecutivePasses: 0, lastPass: null },
    multiplier: 1, baseScore: 10,
    scores: Object.fromEntries(playerIds.map(id => [id, 0])),
    winner: null, winnerTeam: null, history: [],
  };

  broadcastRoom(room, { type: 'GAME_STATE', gameState: room.gameState });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _joinRoom(client: ConnectedClient, room: LiveRoom): void {
  client.roomId = room.id;
  room.players.push({ userId: client.user.id, openid: client.user.openid, nickname: client.user.nickname, slot: room.players.length, ws: client.ws });
}

function _toPublicRoom(room: LiveRoom): Room {
  return {
    id: room.id as unknown as number,
    roomCode: room.roomCode,
    status: room.status,
    maxPlayers: 3,
    gameState: room.gameState,
    players: room.players.map(p => ({ userId: p.userId, openid: p.openid, nickname: p.nickname, slot: p.slot })),
  };
}

function broadcastRoom(room: LiveRoom, msg: ServerMessage): void {
  for (const p of room.players) send(p.ws, msg);
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
