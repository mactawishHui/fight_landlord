import { Card, Combination, CombinationType, Rank } from '../types';

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Group cards by rank. */
function rankFreq(cards: Card[]): Map<Rank, Card[]> {
  const map = new Map<Rank, Card[]>();
  for (const c of cards) {
    const g = map.get(c.rank) ?? [];
    g.push(c);
    map.set(c.rank, g);
  }
  return map;
}

/** Sorted unique ranks from a frequency map. */
function sortedKeys(map: Map<Rank, Card[]>): Rank[] {
  return Array.from(map.keys()).sort((a, b) => a - b);
}

/** True if sorted rank array has no gaps (values increase by 1 each step). */
function isConsecutive(ranks: Rank[]): boolean {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/** True if no rank is ≥ Rank.Two (i.e. no 2s or jokers). */
function noTwosOrJokers(ranks: Rank[]): boolean {
  return ranks.every(r => r <= Rank.Ace);
}

// ── Core combination detector ─────────────────────────────────────────────────

/**
 * Given an arbitrary selection of cards, return the matching Combination or
 * null if the selection is not a valid Dou Di Zhu play.
 */
export function detectCombination(cards: Card[]): Combination | null {
  if (cards.length === 0) return null;

  const n = cards.length;
  const freq = rankFreq(cards);
  const ranks = sortedKeys(freq);

  const withCount  = (k: number) => ranks.filter(r => freq.get(r)!.length === k);
  const withAtLeast = (k: number) => ranks.filter(r => freq.get(r)!.length >= k);

  // 1. Rocket
  if (n === 2 && freq.has(Rank.BlackJoker) && freq.has(Rank.RedJoker)) {
    return mk('rocket', Rank.RedJoker, 2, cards);
  }

  // 2. Single
  if (n === 1) return mk('single', ranks[0], 1, cards);

  // 3. Pair
  if (n === 2 && withCount(2).length === 1) {
    return mk('pair', withCount(2)[0], 2, cards);
  }

  // 4. Triple
  if (n === 3 && withCount(3).length === 1) {
    return mk('triple', withCount(3)[0], 3, cards);
  }

  // 5. Bomb
  if (n === 4 && withCount(4).length === 1) {
    return mk('bomb', withCount(4)[0], 4, cards);
  }

  // 6. Triple + 1  (三带一)
  if (n === 4) {
    const t = withCount(3);
    if (t.length === 1 && withCount(1).length === 1) {
      return mk('triple_one', t[0], 4, cards);
    }
  }

  // 7. Triple + pair  (三带二)
  if (n === 5) {
    const t = withCount(3);
    const p = withCount(2);
    if (t.length === 1 && p.length === 1) {
      return mk('triple_pair', t[0], 5, cards);
    }
  }

  // 8. Straight  (顺子 ≥5 singles, no 2/joker)
  if (n >= 5 && withCount(1).length === n && noTwosOrJokers(ranks) && isConsecutive(ranks)) {
    return mk('straight', ranks[ranks.length - 1], n, cards);
  }

  // 9. Pair straight  (双顺 ≥3 consecutive pairs, no 2/joker)
  if (n >= 6 && n % 2 === 0) {
    const pr = withCount(2);
    if (pr.length === n / 2 && pr.length >= 3 && noTwosOrJokers(pr) && isConsecutive(pr)) {
      return mk('pair_straight', pr[pr.length - 1], n, cards);
    }
  }

  // 10–12. Airplane variants (飞机)
  const tripleRanks = withAtLeast(3).filter(r => r <= Rank.Ace);
  if (tripleRanks.length >= 2) {
    for (let s = 0; s < tripleRanks.length; s++) {
      for (let len = 2; s + len <= tripleRanks.length; len++) {
        const seq = tripleRanks.slice(s, s + len);
        if (!isConsecutive(seq)) break;

        // Extract exactly 3 from each triple rank
        const planeIds = new Set<string>();
        seq.forEach(r => freq.get(r)!.slice(0, 3).forEach(c => planeIds.add(c.id)));
        const remaining = cards.filter(c => !planeIds.has(c.id));
        const primary = seq[seq.length - 1];

        // 10. Bare plane (飞机不带)
        if (remaining.length === 0 && n === len * 3) {
          return mk('plane', primary, n, cards);
        }
        // 11. Plane + singles (飞机带单)
        if (remaining.length === len && n === len * 4) {
          return mk('plane_solo', primary, n, cards);
        }
        // 12. Plane + pairs (飞机带对)
        if (remaining.length === len * 2 && n === len * 5) {
          const remFreq = rankFreq(remaining);
          if (Array.from(remFreq.values()).every(g => g.length === 2)) {
            return mk('plane_pair', primary, n, cards);
          }
        }
      }
    }
  }

  // 13. Four + 2 singles  (四带两单)
  if (n === 6) {
    const q = withCount(4);
    if (q.length === 1) {
      const qIds = new Set(freq.get(q[0])!.map(c => c.id));
      if (cards.filter(c => !qIds.has(c.id)).length === 2) {
        return mk('four_two', q[0], 6, cards);
      }
    }
  }

  // 14. Four + 2 pairs  (四带两对)
  if (n === 8) {
    const q = withCount(4);
    if (q.length === 1) {
      const qIds = new Set(freq.get(q[0])!.map(c => c.id));
      const remaining = cards.filter(c => !qIds.has(c.id));
      if (remaining.length === 4) {
        const remFreq = rankFreq(remaining);
        if (Array.from(remFreq.values()).every(g => g.length === 2)) {
          return mk('four_pairs', q[0], 8, cards);
        }
      }
    }
  }

  return null;
}

function mk(
  type: CombinationType,
  primaryRank: Rank,
  length: number,
  cards: Card[],
): Combination {
  return { type, primaryRank, length, cards };
}

// ── Beat comparison ───────────────────────────────────────────────────────────

/**
 * Returns true if `next` beats `current`.
 * Precedence: rocket > bomb > everything else (same type + same length + higher rank).
 */
export function beats(current: Combination, next: Combination): boolean {
  if (next.type === 'rocket') return true;
  if (current.type === 'rocket') return false;
  if (next.type === 'bomb' && current.type !== 'bomb') return true;
  if (current.type === 'bomb' && next.type !== 'bomb') return false;
  if (next.type === 'bomb' && current.type === 'bomb') {
    return next.primaryRank > current.primaryRank;
  }
  // Regular: same type and same total card count required
  if (next.type !== current.type) return false;
  if (next.length !== current.length) return false;
  return next.primaryRank > current.primaryRank;
}

// ── Combination generator (used by AI + hint) ─────────────────────────────────

/**
 * Enumerate all structurally distinct valid combinations from a hand.
 * Does NOT enumerate every possible attachment variant — that would be
 * exponential.  Instead it generates one "representative" version of each
 * shape (lowest-rank attachment), which is sufficient for AI/hint purposes.
 */
export function generateCombinations(hand: Card[]): Combination[] {
  const result: Combination[] = [];
  const freq = rankFreq(hand);
  const ranks = sortedKeys(freq);

  // Singles
  for (const c of hand) {
    result.push(mk('single', c.rank, 1, [c]));
  }

  // Pairs
  for (const [r, cs] of freq) {
    if (cs.length >= 2) result.push(mk('pair', r, 2, cs.slice(0, 2)));
  }

  // Triples
  for (const [r, cs] of freq) {
    if (cs.length >= 3) result.push(mk('triple', r, 3, cs.slice(0, 3)));
  }

  // Bombs
  for (const [r, cs] of freq) {
    if (cs.length === 4) result.push(mk('bomb', r, 4, cs));
  }

  // Rocket
  if (freq.has(Rank.BlackJoker) && freq.has(Rank.RedJoker)) {
    result.push(mk('rocket', Rank.RedJoker, 2, [
      freq.get(Rank.BlackJoker)![0],
      freq.get(Rank.RedJoker)![0],
    ]));
  }

  // Triple + 1  (for each triple, attach each card of a different rank)
  for (const [tr, tcs] of freq) {
    if (tcs.length < 3) continue;
    const tripleCards = tcs.slice(0, 3);
    const kickers = hand.filter(c => c.rank !== tr);
    if (kickers.length > 0) {
      // Attach the lowest-rank kicker as the representative
      const kicker = kickers[0];
      result.push(mk('triple_one', tr, 4, [...tripleCards, kicker]));
    }
  }

  // Triple + pair
  for (const [tr, tcs] of freq) {
    if (tcs.length < 3) continue;
    const tripleCards = tcs.slice(0, 3);
    for (const [pr, pcs] of freq) {
      if (pr === tr || pcs.length < 2) continue;
      result.push(mk('triple_pair', tr, 5, [...tripleCards, ...pcs.slice(0, 2)]));
    }
  }

  // Straights (5 to 12 cards)
  const straightable = ranks.filter(r => r <= Rank.Ace);
  for (let s = 0; s < straightable.length; s++) {
    const strCards: Card[] = [freq.get(straightable[s])![0]];
    for (let e = s + 1; e < straightable.length; e++) {
      if (straightable[e] !== straightable[e - 1] + 1) break;
      strCards.push(freq.get(straightable[e])![0]);
      if (strCards.length >= 5) {
        result.push(mk('straight', straightable[e], strCards.length, [...strCards]));
      }
    }
  }

  // Pair straights (3+ consecutive pairs)
  const pairable = ranks.filter(r => r <= Rank.Ace && freq.get(r)!.length >= 2);
  for (let s = 0; s < pairable.length; s++) {
    const psCards: Card[] = [...freq.get(pairable[s])!.slice(0, 2)];
    for (let e = s + 1; e < pairable.length; e++) {
      if (pairable[e] !== pairable[e - 1] + 1) break;
      psCards.push(...freq.get(pairable[e])!.slice(0, 2));
      if (e - s + 1 >= 3) {
        result.push(mk('pair_straight', pairable[e], psCards.length, [...psCards]));
      }
    }
  }

  // Airplanes (2+ consecutive triples, no 2/joker)
  const tripleRanks = ranks.filter(r => r <= Rank.Ace && freq.get(r)!.length >= 3);
  for (let s = 0; s < tripleRanks.length; s++) {
    const planeCards: Card[] = [...freq.get(tripleRanks[s])!.slice(0, 3)];
    const planeRanks: Rank[] = [tripleRanks[s]];
    for (let e = s + 1; e < tripleRanks.length; e++) {
      if (tripleRanks[e] !== tripleRanks[e - 1] + 1) break;
      planeCards.push(...freq.get(tripleRanks[e])!.slice(0, 3));
      planeRanks.push(tripleRanks[e]);
      const primary = tripleRanks[e];
      const numTriples = e - s + 1;
      const planeIds = new Set(planeCards.map(c => c.id));
      const remaining = hand.filter(c => !planeIds.has(c.id));

      // Bare plane
      result.push(mk('plane', primary, planeCards.length, [...planeCards]));

      // Plane + singles: attach numTriples lowest-rank remaining cards
      if (remaining.length >= numTriples) {
        const singles = remaining.slice(0, numTriples);
        result.push(mk('plane_solo', primary, planeCards.length + numTriples, [
          ...planeCards, ...singles,
        ]));
      }

      // Plane + pairs: attach numTriples lowest-rank pairs from remaining
      const remPairs = Array.from(rankFreq(remaining).entries())
        .filter(([, g]) => g.length >= 2)
        .sort(([a], [b]) => a - b);
      if (remPairs.length >= numTriples) {
        const pairCards = remPairs.slice(0, numTriples).flatMap(([, g]) => g.slice(0, 2));
        result.push(mk('plane_pair', primary, planeCards.length + numTriples * 2, [
          ...planeCards, ...pairCards,
        ]));
      }
    }
  }

  // Four + 2 singles
  for (const [r, cs] of freq) {
    if (cs.length < 4) continue;
    const qIds = new Set(cs.map(c => c.id));
    const rem = hand.filter(c => !qIds.has(c.id));
    if (rem.length >= 2) {
      result.push(mk('four_two', r, 6, [...cs, ...rem.slice(0, 2)]));
    }
  }

  // Four + 2 pairs
  for (const [r, cs] of freq) {
    if (cs.length < 4) continue;
    const qIds = new Set(cs.map(c => c.id));
    const rem = hand.filter(c => !qIds.has(c.id));
    const remPairs = Array.from(rankFreq(rem).entries())
      .filter(([, g]) => g.length >= 2)
      .sort(([a], [b]) => a - b);
    if (remPairs.length >= 2) {
      const pairCards = [...remPairs[0][1].slice(0, 2), ...remPairs[1][1].slice(0, 2)];
      result.push(mk('four_pairs', r, 8, [...cs, ...pairCards]));
    }
  }

  // Deduplicate by (type, primaryRank, length)
  const seen = new Set<string>();
  return result.filter(c => {
    const key = `${c.type}|${c.primaryRank}|${c.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** All combinations from hand that beat `target`. */
export function getValidBeats(hand: Card[], target: Combination): Combination[] {
  return generateCombinations(hand).filter(c => beats(target, c));
}

/**
 * Simple hint: returns the weakest play that is valid in the current context.
 * If leading (target === null), returns the weakest non-bomb single.
 */
export function getHint(hand: Card[], target: Combination | null): Card[] | null {
  if (target === null) {
    const combos = generateCombinations(hand);
    const pairs = combos.filter(c => c.type === 'pair').sort((a, b) => a.primaryRank - b.primaryRank);
    if (pairs.length > 0) return pairs[0].cards;
    const singles = combos
      .filter(c => c.type === 'single' && c.primaryRank < Rank.BlackJoker)
      .sort((a, b) => a.primaryRank - b.primaryRank);
    return singles.length > 0 ? singles[0].cards : (hand.length > 0 ? [hand[0]] : null);
  }
  const valid = getValidBeats(hand, target);
  if (valid.length === 0) return null;
  // Prefer non-bombs, then minimum rank
  const nonBombs = valid.filter(c => c.type !== 'bomb' && c.type !== 'rocket');
  const pool = nonBombs.length > 0 ? nonBombs : valid;
  const best = pool.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min);
  return best.cards;
}
