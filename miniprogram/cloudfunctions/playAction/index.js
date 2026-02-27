/**
 * Cloud Function: playAction
 *
 * Validates and applies a game action (BID / PLAY / PASS / NEXT_ROUND)
 * to the room's gameState. All clients watching the room document receive
 * the update in real-time via db.watch().
 *
 * Input: { roomId, action: { type, playerId?, cards?, bid? } }
 * Returns: { success: true, gameState }
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ── Embedded game logic (server-side validation) ──────────────────────────────

const Rank = { Three:3,Four:4,Five:5,Six:6,Seven:7,Eight:8,Nine:9,Ten:10,Jack:11,Queen:12,King:13,Ace:14,Two:15,BlackJoker:16,RedJoker:17 };
const SUITS=['clubs','diamonds','hearts','spades'];
const NORMAL_RANKS=[3,4,5,6,7,8,9,10,11,12,13,14,15];

function createDeck(){const d=[];for(const s of SUITS)for(const r of NORMAL_RANKS)d.push({id:`${s[0].toUpperCase()}${r}`,suit:s,rank:r});d.push({id:'BJ',suit:null,rank:16});d.push({id:'RJ',suit:null,rank:17});return d;}
function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
function sortHand(c){const so={clubs:0,diamonds:1,hearts:2,spades:3};return[...c].sort((a,b)=>a.rank!==b.rank?a.rank-b.rank:(a.suit?so[a.suit]:4)-(b.suit?so[b.suit]:4));}
function dealCards(){const d=shuffle(createDeck());return{hands:[sortHand(d.slice(0,17)),sortHand(d.slice(17,34)),sortHand(d.slice(34,51))],bottomCards:d.slice(51,54)};}

function rankFreq(cards){const m=new Map();for(const c of cards){const g=m.get(c.rank)??[];g.push(c);m.set(c.rank,g);}return m;}
function sortedKeys(m){return Array.from(m.keys()).sort((a,b)=>a-b);}
function isConsec(r){for(let i=1;i<r.length;i++)if(r[i]!==r[i-1]+1)return false;return true;}
function noTwo(r){return r.every(x=>x<=Rank.Ace);}
function mk(t,p,l,c){return{type:t,primaryRank:p,length:l,cards:c};}

function detectCombination(cards){
  if(!cards||cards.length===0)return null;
  const n=cards.length,freq=rankFreq(cards),ranks=sortedKeys(freq);
  const wc=k=>ranks.filter(r=>freq.get(r).length===k);
  const wa=k=>ranks.filter(r=>freq.get(r).length>=k);
  if(n===2&&freq.has(Rank.BlackJoker)&&freq.has(Rank.RedJoker))return mk('rocket',Rank.RedJoker,2,cards);
  if(n===1)return mk('single',ranks[0],1,cards);
  if(n===2&&wc(2).length===1)return mk('pair',wc(2)[0],2,cards);
  if(n===3&&wc(3).length===1)return mk('triple',wc(3)[0],3,cards);
  if(n===4&&wc(4).length===1)return mk('bomb',wc(4)[0],4,cards);
  if(n===4){const t=wc(3);if(t.length===1&&wc(1).length===1)return mk('triple_one',t[0],4,cards);}
  if(n===5){const t=wc(3),p=wc(2);if(t.length===1&&p.length===1)return mk('triple_pair',t[0],5,cards);}
  if(n>=5&&wc(1).length===n&&noTwo(ranks)&&isConsec(ranks))return mk('straight',ranks[ranks.length-1],n,cards);
  if(n>=6&&n%2===0){const pr=wc(2);if(pr.length===n/2&&pr.length>=3&&noTwo(pr)&&isConsec(pr))return mk('pair_straight',pr[pr.length-1],n,cards);}
  const tr=wa(3).filter(r=>r<=Rank.Ace);
  if(tr.length>=2)for(let s=0;s<tr.length;s++)for(let len=2;s+len<=tr.length;len++){
    const seq=tr.slice(s,s+len);if(!isConsec(seq))break;
    const pid=new Set();seq.forEach(r=>freq.get(r).slice(0,3).forEach(c=>pid.add(c.id)));
    const rem=cards.filter(c=>!pid.has(c.id));const primary=seq[seq.length-1];
    if(rem.length===0&&n===len*3)return mk('plane',primary,n,cards);
    if(rem.length===len&&n===len*4)return mk('plane_solo',primary,n,cards);
    if(rem.length===len*2&&n===len*5&&Array.from(rankFreq(rem).values()).every(g=>g.length===2))return mk('plane_pair',primary,n,cards);
  }
  if(n===6){const q=wc(4);if(q.length===1&&cards.filter(c=>!new Set(freq.get(q[0]).map(x=>x.id)).has(c.id)).length===2)return mk('four_two',q[0],6,cards);}
  if(n===8){const q=wc(4);if(q.length===1){const qi=new Set(freq.get(q[0]).map(c=>c.id));const rem=cards.filter(c=>!qi.has(c.id));if(rem.length===4&&Array.from(rankFreq(rem).values()).every(g=>g.length===2))return mk('four_pairs',q[0],8,cards);}}
  return null;
}

function beats(cur,nxt){
  if(nxt.type==='rocket')return true;if(cur.type==='rocket')return false;
  if(nxt.type==='bomb'&&cur.type!=='bomb')return true;if(cur.type==='bomb'&&nxt.type!=='bomb')return false;
  if(nxt.type==='bomb'&&cur.type==='bomb')return nxt.primaryRank>cur.primaryRank;
  if(nxt.type!==cur.type)return false;if(nxt.length!==cur.length)return false;
  return nxt.primaryRank>cur.primaryRank;
}

function nextPlayer(order,cur){const i=order.indexOf(cur);return order[(i+1)%3];}

function computeScore(winner,landlord,base,mult,pids){
  const final=base*mult,isLW=winner===landlord,delta={};
  for(const id of pids)delta[id]=id===landlord?(isLW?final*2:-final*2):(isLW?-final:final);
  return delta;
}

function applyAction(state, action) {
  const { phase, players, currentTurn, trick, turnOrder, bids, landlordCards } = state;

  if (action.type === 'BID') {
    if (phase !== 'bidding') throw new Error('Not bidding phase');
    if (currentTurn !== action.playerId) throw new Error('Not your turn');
    const newBids = [...bids, { playerId: action.playerId, bid: action.bid }];
    const nextIdx = state.currentBidder + 1;
    if (newBids.length === 3 || action.bid === 3) {
      const maxBid = Math.max(...newBids.map(b => b.bid));
      if (maxBid === 0) {
        // Redeal
        const si = Math.floor(Math.random() * 3);
        const to = [...turnOrder.slice(si), ...turnOrder.slice(0, si)];
        const { hands, bottomCards: bc } = dealCards();
        const hm = Object.fromEntries(to.map((id, i) => [id, hands[i]]));
        const newPlayers = Object.fromEntries(Object.keys(players).map(id => [id, { ...players[id], hand: hm[id] || [], isLandlord: false }]));
        return { ...state, phase: 'bidding', players: newPlayers, turnOrder: to, currentTurn: to[0], landlordCards: bc, bids: [], currentBidder: 0, landlord: null, trick: { lastCombination: null, lastPlayerId: null, consecutivePasses: 0, lastPass: null }, multiplier: 1, winner: null, winnerTeam: null, history: [] };
      }
      const lbid = newBids.find(b => b.bid === maxBid);
      const lid = lbid.playerId;
      const lHand = sortHand([...players[lid].hand, ...landlordCards]);
      return { ...state, phase: 'playing', players: { ...players, [lid]: { ...players[lid], hand: lHand, isLandlord: true } }, landlord: lid, currentTurn: lid, baseScore: maxBid * 10, bids: newBids };
    }
    return { ...state, bids: newBids, currentBidder: nextIdx, currentTurn: turnOrder[nextIdx] };
  }

  if (action.type === 'PLAY') {
    if (phase !== 'playing') throw new Error('Not playing phase');
    if (currentTurn !== action.playerId) throw new Error('Not your turn');
    // Verify cards are actually in player's hand
    const handIds = new Set(players[action.playerId].hand.map(c => c.id));
    for (const c of action.cards) if (!handIds.has(c.id)) throw new Error('Card not in hand');
    const combo = detectCombination(action.cards);
    if (!combo) throw new Error('Invalid combination');
    if (trick.lastCombination !== null && !beats(trick.lastCombination, combo)) throw new Error('Cannot beat current play');
    const isNewTrick = trick.lastCombination === null;
    const playedIds = new Set(action.cards.map(c => c.id));
    const newHand = players[action.playerId].hand.filter(c => !playedIds.has(c.id));
    let newMult = state.multiplier;
    if (combo.type === 'bomb' || combo.type === 'rocket') newMult *= 2;
    const up = { ...players, [action.playerId]: { ...players[action.playerId], hand: newHand } };
    const hist = [...state.history, { playerId: action.playerId, combination: combo, isNewTrick }];
    if (newHand.length === 0) {
      const w = action.playerId, wt = w === state.landlord ? 'landlord' : 'farmers';
      const delta = computeScore(w, state.landlord, state.baseScore, newMult, turnOrder);
      const sc = Object.fromEntries(turnOrder.map(id => [id, (state.scores[id] ?? 0) + (delta[id] ?? 0)]));
      return { ...state, phase: 'game_over', players: up, multiplier: newMult, winner: w, winnerTeam: wt, scores: sc, history: hist, trick: { lastCombination: combo, lastPlayerId: action.playerId, consecutivePasses: 0, lastPass: null } };
    }
    return { ...state, players: up, multiplier: newMult, trick: { lastCombination: combo, lastPlayerId: action.playerId, consecutivePasses: 0, lastPass: null }, currentTurn: nextPlayer(turnOrder, action.playerId), history: hist };
  }

  if (action.type === 'PASS') {
    if (phase !== 'playing') throw new Error('Not playing phase');
    if (currentTurn !== action.playerId) throw new Error('Not your turn');
    if (trick.lastCombination === null) throw new Error('Cannot pass when leading');
    const np = trick.consecutivePasses + 1;
    const hist = [...state.history, { playerId: action.playerId, combination: null }];
    if (np >= 2) return { ...state, trick: { lastCombination: null, lastPlayerId: null, consecutivePasses: 0, lastPass: null }, currentTurn: trick.lastPlayerId, history: hist };
    return { ...state, trick: { ...trick, consecutivePasses: np, lastPass: action.playerId }, currentTurn: nextPlayer(turnOrder, action.playerId), history: hist };
  }

  if (action.type === 'NEXT_ROUND') {
    const si = Math.floor(Math.random() * 3);
    const to = [...turnOrder.slice(si), ...turnOrder.slice(0, si)];
    const { hands, bottomCards: bc } = dealCards();
    const hm = Object.fromEntries(to.map((id, i) => [id, hands[i]]));
    const np = Object.fromEntries(Object.keys(players).map(id => [id, { ...players[id], hand: hm[id] || [], isLandlord: false }]));
    return { ...state, phase: 'bidding', players: np, turnOrder: to, currentTurn: to[0], landlordCards: bc, bids: [], currentBidder: 0, landlord: null, trick: { lastCombination: null, lastPlayerId: null, consecutivePasses: 0, lastPass: null }, multiplier: 1, winner: null, winnerTeam: null, history: [] };
  }

  throw new Error(`Unknown action type: ${action.type}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { roomId, action } = event;

  // Force action playerId to caller's openid (security: prevent spoofing)
  const secureAction = { ...action, playerId: OPENID };

  // Fetch room
  const snap = await db.collection('rooms').where({ roomId }).get();
  if (!snap.data || snap.data.length === 0) throw new Error('Room not found');
  const room = snap.data[0];

  if (room.status !== 'playing') throw new Error('Game not active');

  // Apply action
  const newGameState = applyAction(room.gameState, secureAction);

  // Persist updated state
  await db.collection('rooms').doc(room._id).update({
    data: {
      gameState: newGameState,
      status: newGameState.phase === 'game_over' ? 'finished' : 'playing',
      updatedAt: db.serverDate(),
    },
  });

  return { success: true, gameState: newGameState };
};
