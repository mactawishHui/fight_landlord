import { Rank } from './deck.js';
import { generateCombinations, getValidBeats } from './combinations.js';

function handStrength(hand) {
  let score = 0;
  const rankMap = new Map();
  for (const c of hand) {
    rankMap.set(c.rank, (rankMap.get(c.rank) ?? 0) + 1);
    if (c.rank === Rank.RedJoker)        score += 9;
    else if (c.rank === Rank.BlackJoker) score += 8;
    else if (c.rank === Rank.Two)        score += 5;
    else if (c.rank === Rank.Ace)        score += 4;
    else if (c.rank === Rank.King)       score += 3;
    else if (c.rank === Rank.Queen)      score += 2;
    else if (c.rank >= Rank.Ten)         score += 1;
  }
  for (const cnt of rankMap.values()) if (cnt === 4) score += 5;
  return score;
}

export function aiBidDecision(hand, currentMaxBid) {
  const s = handStrength(hand);
  let bid = 0;
  if (s >= 24)      bid = 3;
  else if (s >= 18) bid = 2;
  else if (s >= 12) bid = 1;
  return bid > currentMaxBid ? bid : 0;
}

function rankFreq(hand) {
  const m = new Map();
  for (const c of hand) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

function isolatedSingleCount(hand) {
  const freq = rankFreq(hand);
  let n = 0;
  for (const [r, cnt] of freq) if (cnt === 1 && r <= Rank.King) n++;
  return n;
}

function weakestCard(hand) {
  const nonJoker = hand.filter(c => c.rank < Rank.BlackJoker);
  const pool = nonJoker.length > 0 ? nonJoker : hand;
  return pool.reduce((min, c) => c.rank < min.rank ? c : min);
}

function chooseLeadPlay(hand, isLandlord, teammateIsNext) {
  const combos = generateCombinations(hand);
  if (hand.length <= 3) {
    return combos.sort((a, b) => a.length - b.length || a.primaryRank - b.primaryRank)[0]?.cards ?? [hand[0]];
  }
  if (isLandlord) {
    const planes = combos.filter(c => c.type === 'plane' || c.type === 'plane_solo' || c.type === 'plane_pair').sort((a, b) => b.length - a.length);
    if (planes.length > 0) return planes[0].cards;
    const seqs = combos.filter(c => c.type === 'pair_straight' || c.type === 'straight').sort((a, b) => b.length - a.length);
    if (seqs.length > 0) return seqs[0].cards;
    const pairs = combos.filter(c => c.type === 'pair').sort((a, b) => a.primaryRank - b.primaryRank);
    if (pairs.length > 0) return pairs[0].cards;
    const singles = combos.filter(c => c.type === 'single' && c.primaryRank < Rank.BlackJoker).sort((a, b) => a.primaryRank - b.primaryRank);
    return singles.length > 0 ? singles[0].cards : [hand[0]];
  }
  const isolated = isolatedSingleCount(hand);
  if (teammateIsNext && isolated >= 3) return [weakestCard(hand)];
  const pairStraights = combos.filter(c => c.type === 'pair_straight').sort((a, b) => b.length - a.length);
  if (pairStraights.length > 0 && hand.length >= 8) return pairStraights[0].cards;
  const straights = combos.filter(c => c.type === 'straight').sort((a, b) => b.length - a.length);
  if (straights.length > 0 && hand.length >= 6) return straights[0].cards;
  if (isolated > 0) {
    const freq = rankFreq(hand);
    const garbageSingles = hand.filter(c => (freq.get(c.rank) ?? 0) === 1 && c.rank <= Rank.King).sort((a, b) => a.rank - b.rank);
    if (garbageSingles.length > 0) return [garbageSingles[0]];
  }
  const pairs = combos.filter(c => c.type === 'pair').sort((a, b) => a.primaryRank - b.primaryRank);
  if (pairs.length > 0) return pairs[0].cards;
  const singles = combos.filter(c => c.type === 'single' && c.primaryRank < Rank.BlackJoker).sort((a, b) => a.primaryRank - b.primaryRank);
  return singles.length > 0 ? singles[0].cards : [hand[0]];
}

export function aiChoosePlay(hand, lastCombination, lastPlayerId, myId, landlord, turnOrder, handSizes) {
  const amLandlord = myId === landlord;
  const amFarmer   = !amLandlord;
  const myIdx         = turnOrder.indexOf(myId);
  const nextId        = turnOrder[(myIdx + 1) % turnOrder.length];
  const teammateIsNext = amFarmer && nextId !== landlord;
  const lastIsTeammate = amFarmer && lastPlayerId !== null && lastPlayerId !== myId && lastPlayerId !== landlord;
  const lastIsLandlord = lastPlayerId === landlord;
  const landlordCards  = landlord ? (handSizes[landlord] ?? 20) : 20;
  const landlordUrgent = landlordCards <= 5;

  if (lastCombination === null) return chooseLeadPlay(hand, amLandlord, teammateIsNext);

  if (lastIsTeammate) {
    if (lastCombination.primaryRank <= Rank.Seven) {
      const validBeats = getValidBeats(hand, lastCombination);
      const cheapBeats = validBeats.filter(c => c.type !== 'bomb' && c.type !== 'rocket' && c.primaryRank <= Rank.Jack);
      if (cheapBeats.length > 0) return cheapBeats.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min).cards;
    }
    return null;
  }

  const validBeats = getValidBeats(hand, lastCombination);
  if (validBeats.length === 0) return null;

  const bombs    = validBeats.filter(c => c.type === 'bomb' || c.type === 'rocket');
  const nonBombs = validBeats.filter(c => c.type !== 'bomb' && c.type !== 'rocket');

  if (nonBombs.length > 0) {
    const minBeat = nonBombs.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min);
    if (amFarmer && !landlordUrgent && hand.length > 4) {
      const targetRank = lastCombination.primaryRank;
      if (minBeat.primaryRank >= Rank.Two && targetRank < Rank.King) return null;
      if (minBeat.primaryRank === Rank.Ace && targetRank < Rank.Queen) return null;
    }
    return minBeat.cards;
  }

  if (bombs.length > 0) {
    const minBomb = bombs.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min);
    if (amLandlord && hand.length <= 6) return minBomb.cards;
    if (!amLandlord && (landlordUrgent || hand.length <= 5)) return minBomb.cards;
  }
  return null;
}
