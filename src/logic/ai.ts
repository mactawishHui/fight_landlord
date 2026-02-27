import { Card, Combination, PlayerId, Rank } from '../types';
import { generateCombinations, getValidBeats } from './combinations';

// ── Bidding ───────────────────────────────────────────────────────────────────

function handStrength(hand: Card[]): number {
  let score = 0;
  const rankMap = new Map<Rank, number>();
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
  for (const cnt of rankMap.values()) {
    if (cnt === 4) score += 5;
  }
  return score;
}

export function aiBidDecision(hand: Card[], currentMaxBid: number): 0 | 1 | 2 | 3 {
  const s = handStrength(hand);
  let bid: 0 | 1 | 2 | 3 = 0;
  if (s >= 24)      bid = 3;
  else if (s >= 18) bid = 2;
  else if (s >= 12) bid = 1;
  return bid > currentMaxBid ? bid : 0;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Rank frequency map for a hand. */
function rankFreq(hand: Card[]): Map<Rank, number> {
  const m = new Map<Rank, number>();
  for (const c of hand) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

/** Number of isolated singles (rank ≤ King, appears only once). */
function isolatedSingleCount(hand: Card[]): number {
  const freq = rankFreq(hand);
  let n = 0;
  for (const [r, cnt] of freq) if (cnt === 1 && r <= Rank.King) n++;
  return n;
}

/** Weakest card in hand, excluding jokers. */
function weakestCard(hand: Card[]): Card {
  const nonJoker = hand.filter(c => c.rank < Rank.BlackJoker);
  const pool = nonJoker.length > 0 ? nonJoker : hand;
  return pool.reduce((min, c) => c.rank < min.rank ? c : min);
}

/** True if this player is a farmer (not landlord). */
function isFarmer(id: PlayerId, landlord: PlayerId | null): boolean {
  return id !== landlord;
}

// ── Leading play ──────────────────────────────────────────────────────────────

/**
 * Choose what to play when leading a new trick.
 *
 * Farmer priorities:
 *  1. If teammate is 下家 (plays right after) and hand is weak → play the weakest
 *     single to hand control over to teammate (让牌给队友).
 *  2. Dump long straights / pair-straights to clear multiple weak cards at once.
 *  3. Clear isolated singles (cards that can't pair up) early.
 *  4. Play lowest pair as a safe mid-game move.
 *
 * Landlord priorities: long combos to empty hand fast, then pairs, then singles.
 */
function chooseLeadPlay(
  hand: Card[],
  isLandlord: boolean,
  teammateIsNext: boolean,
): Card[] {
  const combos = generateCombinations(hand);

  // Tiny hand → play smallest available combo to finish
  if (hand.length <= 3) {
    return combos
      .sort((a, b) => a.length - b.length || a.primaryRank - b.primaryRank)[0]?.cards
      ?? [hand[0]];
  }

  // ── Landlord ──────────────────────────────────────────────────────────────
  if (isLandlord) {
    // Planes first (clears most cards)
    const planes = combos
      .filter(c => c.type === 'plane' || c.type === 'plane_solo' || c.type === 'plane_pair')
      .sort((a, b) => b.length - a.length);
    if (planes.length > 0) return planes[0].cards;

    // Then pair-straights / straights
    const seqs = combos
      .filter(c => c.type === 'pair_straight' || c.type === 'straight')
      .sort((a, b) => b.length - a.length);
    if (seqs.length > 0) return seqs[0].cards;

    // Pairs
    const pairs = combos.filter(c => c.type === 'pair').sort((a, b) => a.primaryRank - b.primaryRank);
    if (pairs.length > 0) return pairs[0].cards;

    // Singles (non-joker)
    const singles = combos
      .filter(c => c.type === 'single' && c.primaryRank < Rank.BlackJoker)
      .sort((a, b) => a.primaryRank - b.primaryRank);
    return singles.length > 0 ? singles[0].cards : [hand[0]];
  }

  // ── Farmer ────────────────────────────────────────────────────────────────

  // 让牌策略: if teammate plays right after me and my hand is weak,
  // play the absolute weakest single so teammate can grab control.
  const isolated = isolatedSingleCount(hand);
  if (teammateIsNext && isolated >= 3) {
    return [weakestCard(hand)];
  }

  // Pair-straights: dump many cards efficiently
  const pairStraights = combos
    .filter(c => c.type === 'pair_straight')
    .sort((a, b) => b.length - a.length);
  if (pairStraights.length > 0 && hand.length >= 8) return pairStraights[0].cards;

  // Straights: dump sequential singles
  const straights = combos
    .filter(c => c.type === 'straight')
    .sort((a, b) => b.length - a.length);
  if (straights.length > 0 && hand.length >= 6) return straights[0].cards;

  // Dump isolated singles first (最先丢垃圾牌)
  if (isolated > 0) {
    const freq = rankFreq(hand);
    const garbageSingles = hand
      .filter(c => (freq.get(c.rank) ?? 0) === 1 && c.rank <= Rank.King)
      .sort((a, b) => a.rank - b.rank);
    if (garbageSingles.length > 0) return [garbageSingles[0]];
  }

  // Pairs (lowest first)
  const pairs = combos.filter(c => c.type === 'pair').sort((a, b) => a.primaryRank - b.primaryRank);
  if (pairs.length > 0) return pairs[0].cards;

  // Fallback: lowest non-joker single
  const singles = combos
    .filter(c => c.type === 'single' && c.primaryRank < Rank.BlackJoker)
    .sort((a, b) => a.primaryRank - b.primaryRank);
  return singles.length > 0 ? singles[0].cards : [hand[0]];
}

// ── Main play decision ────────────────────────────────────────────────────────

/**
 * Decide what cards the AI should play this turn.
 *
 * @param turnOrder   Full play order (used to determine 下家).
 * @param handSizes   Current hand sizes for all players (for urgency detection).
 */
export function aiChoosePlay(
  hand: Card[],
  lastCombination: Combination | null,
  lastPlayerId: PlayerId | null,
  myId: PlayerId,
  landlord: PlayerId | null,
  turnOrder: PlayerId[],
  handSizes: Record<PlayerId, number>,
): Card[] | null {
  const amLandlord = myId === landlord;
  const amFarmer   = isFarmer(myId, landlord);

  // Who plays right after me? (下家)
  const myIdx         = turnOrder.indexOf(myId);
  const nextId        = turnOrder[(myIdx + 1) % turnOrder.length];
  const teammateIsNext = amFarmer && nextId !== landlord;

  // Characterise the player who currently controls the table
  const lastIsTeammate = amFarmer
    && lastPlayerId !== null
    && lastPlayerId !== myId
    && isFarmer(lastPlayerId, landlord);
  const lastIsLandlord = lastPlayerId === landlord;

  // Urgency: landlord has few cards left → use strong plays / bombs freely
  const landlordCards  = landlord ? (handSizes[landlord] ?? 20) : 20;
  const landlordUrgent = landlordCards <= 5;

  // ── Leading ───────────────────────────────────────────────────────────────
  if (lastCombination === null) {
    return chooseLeadPlay(hand, amLandlord, teammateIsNext);
  }

  // ── Following ────────────────────────────────────────────────────────────

  // ── Case 1: Farmer teammate is controlling the table ─────────────────────
  if (lastIsTeammate) {
    // 接管策略: if teammate played a very weak combo (rank ≤ 7), "accept the pass"
    // by beating with a cheap card so we can dump OUR garbage and stay active.
    // This implements deliberate farmer-to-farmer control handoff.
    if (lastCombination.primaryRank <= Rank.Seven) {
      const validBeats = getValidBeats(hand, lastCombination);
      const cheapBeats = validBeats.filter(
        c => c.type !== 'bomb' && c.type !== 'rocket' && c.primaryRank <= Rank.Jack,
      );
      if (cheapBeats.length > 0) {
        return cheapBeats.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min).cards;
      }
    }
    // Teammate played strongly or we can't cheaply take over → pass (let them lead)
    return null;
  }

  // ── Case 2: Landlord (or nobody recorded yet) is controlling ─────────────
  const validBeats = getValidBeats(hand, lastCombination);
  if (validBeats.length === 0) return null;

  const bombs    = validBeats.filter(c => c.type === 'bomb' || c.type === 'rocket');
  const nonBombs = validBeats.filter(c => c.type !== 'bomb' && c.type !== 'rocket');

  // Always prefer non-bomb beats; save bombs as trump cards
  if (nonBombs.length > 0) {
    if (amFarmer && !lastIsLandlord) {
      // Edge case: nobody special controlling (shouldn't happen in 3p, but handle safely)
      return nonBombs.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min).cards;
    }

    // 压制地主: beat with minimum non-bomb
    const minBeat = nonBombs.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min);

    // 留大牌策略: save premium cards (2/joker/Ace) for strong targets
    if (amFarmer && !landlordUrgent && hand.length > 4) {
      const targetRank = lastCombination.primaryRank;
      // Don't spend a 2 or joker unless target is at least a King-level play
      if (minBeat.primaryRank >= Rank.Two && targetRank < Rank.King) return null;
      // Don't spend an Ace unless target is at least Queen-level
      if (minBeat.primaryRank === Rank.Ace && targetRank < Rank.Queen) return null;
    }

    return minBeat.cards;
  }

  // Only bombs/rockets available
  if (bombs.length > 0) {
    const minBomb = bombs.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min);

    if (amLandlord) {
      // Landlord: use bomb only when hand is getting small
      if (hand.length <= 6) return minBomb.cards;
    } else {
      // Farmer: use bomb when landlord is near winning OR our hand is small
      if (landlordUrgent || hand.length <= 5) return minBomb.cards;
    }
  }

  return null; // Pass
}
