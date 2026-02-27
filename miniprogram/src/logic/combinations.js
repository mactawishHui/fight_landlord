import { Rank } from './deck.js';

// ── Utilities ──────────────────────────────────────────────────────────────────

function rankFreq(cards) {
  const map = new Map();
  for (const c of cards) {
    const g = map.get(c.rank) ?? [];
    g.push(c);
    map.set(c.rank, g);
  }
  return map;
}

function sortedKeys(map) {
  return Array.from(map.keys()).sort((a, b) => a - b);
}

function isConsecutive(ranks) {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

function noTwosOrJokers(ranks) {
  return ranks.every(r => r <= Rank.Ace);
}

function mk(type, primaryRank, length, cards) {
  return { type, primaryRank, length, cards };
}

// ── Core detector ──────────────────────────────────────────────────────────────

export function detectCombination(cards) {
  if (cards.length === 0) return null;
  const n = cards.length;
  const freq = rankFreq(cards);
  const ranks = sortedKeys(freq);
  const withCount  = k => ranks.filter(r => freq.get(r).length === k);
  const withAtLeast = k => ranks.filter(r => freq.get(r).length >= k);

  if (n === 2 && freq.has(Rank.BlackJoker) && freq.has(Rank.RedJoker))
    return mk('rocket', Rank.RedJoker, 2, cards);
  if (n === 1) return mk('single', ranks[0], 1, cards);
  if (n === 2 && withCount(2).length === 1) return mk('pair', withCount(2)[0], 2, cards);
  if (n === 3 && withCount(3).length === 1) return mk('triple', withCount(3)[0], 3, cards);
  if (n === 4 && withCount(4).length === 1) return mk('bomb', withCount(4)[0], 4, cards);

  if (n === 4) {
    const t = withCount(3);
    if (t.length === 1 && withCount(1).length === 1) return mk('triple_one', t[0], 4, cards);
  }
  if (n === 5) {
    const t = withCount(3); const p = withCount(2);
    if (t.length === 1 && p.length === 1) return mk('triple_pair', t[0], 5, cards);
  }
  if (n >= 5 && withCount(1).length === n && noTwosOrJokers(ranks) && isConsecutive(ranks))
    return mk('straight', ranks[ranks.length - 1], n, cards);
  if (n >= 6 && n % 2 === 0) {
    const pr = withCount(2);
    if (pr.length === n / 2 && pr.length >= 3 && noTwosOrJokers(pr) && isConsecutive(pr))
      return mk('pair_straight', pr[pr.length - 1], n, cards);
  }

  const tripleRanks = withAtLeast(3).filter(r => r <= Rank.Ace);
  if (tripleRanks.length >= 2) {
    for (let s = 0; s < tripleRanks.length; s++) {
      for (let len = 2; s + len <= tripleRanks.length; len++) {
        const seq = tripleRanks.slice(s, s + len);
        if (!isConsecutive(seq)) break;
        const planeIds = new Set();
        seq.forEach(r => freq.get(r).slice(0, 3).forEach(c => planeIds.add(c.id)));
        const remaining = cards.filter(c => !planeIds.has(c.id));
        const primary = seq[seq.length - 1];
        if (remaining.length === 0 && n === len * 3) return mk('plane', primary, n, cards);
        if (remaining.length === len && n === len * 4) return mk('plane_solo', primary, n, cards);
        if (remaining.length === len * 2 && n === len * 5) {
          const remFreq = rankFreq(remaining);
          if (Array.from(remFreq.values()).every(g => g.length === 2))
            return mk('plane_pair', primary, n, cards);
        }
      }
    }
  }

  if (n === 6) {
    const q = withCount(4);
    if (q.length === 1) {
      const qIds = new Set(freq.get(q[0]).map(c => c.id));
      if (cards.filter(c => !qIds.has(c.id)).length === 2) return mk('four_two', q[0], 6, cards);
    }
  }
  if (n === 8) {
    const q = withCount(4);
    if (q.length === 1) {
      const qIds = new Set(freq.get(q[0]).map(c => c.id));
      const remaining = cards.filter(c => !qIds.has(c.id));
      if (remaining.length === 4) {
        const remFreq = rankFreq(remaining);
        if (Array.from(remFreq.values()).every(g => g.length === 2))
          return mk('four_pairs', q[0], 8, cards);
      }
    }
  }
  return null;
}

// ── Beat comparison ────────────────────────────────────────────────────────────

export function beats(current, next) {
  if (next.type === 'rocket') return true;
  if (current.type === 'rocket') return false;
  if (next.type === 'bomb' && current.type !== 'bomb') return true;
  if (current.type === 'bomb' && next.type !== 'bomb') return false;
  if (next.type === 'bomb' && current.type === 'bomb') return next.primaryRank > current.primaryRank;
  if (next.type !== current.type) return false;
  if (next.length !== current.length) return false;
  return next.primaryRank > current.primaryRank;
}

// ── Combination generator ─────────────────────────────────────────────────────

export function generateCombinations(hand) {
  const result = [];
  const freq = rankFreq(hand);
  const ranks = sortedKeys(freq);

  for (const c of hand) result.push(mk('single', c.rank, 1, [c]));
  for (const [r, cs] of freq) if (cs.length >= 2) result.push(mk('pair', r, 2, cs.slice(0, 2)));
  for (const [r, cs] of freq) if (cs.length >= 3) result.push(mk('triple', r, 3, cs.slice(0, 3)));
  for (const [r, cs] of freq) if (cs.length === 4) result.push(mk('bomb', r, 4, cs));

  if (freq.has(Rank.BlackJoker) && freq.has(Rank.RedJoker))
    result.push(mk('rocket', Rank.RedJoker, 2, [freq.get(Rank.BlackJoker)[0], freq.get(Rank.RedJoker)[0]]));

  for (const [tr, tcs] of freq) {
    if (tcs.length < 3) continue;
    const kickers = hand.filter(c => c.rank !== tr);
    if (kickers.length > 0) result.push(mk('triple_one', tr, 4, [...tcs.slice(0, 3), kickers[0]]));
    for (const [pr, pcs] of freq) {
      if (pr === tr || pcs.length < 2) continue;
      result.push(mk('triple_pair', tr, 5, [...tcs.slice(0, 3), ...pcs.slice(0, 2)]));
    }
  }

  const straightable = ranks.filter(r => r <= Rank.Ace);
  for (let s = 0; s < straightable.length; s++) {
    const strCards = [freq.get(straightable[s])[0]];
    for (let e = s + 1; e < straightable.length; e++) {
      if (straightable[e] !== straightable[e - 1] + 1) break;
      strCards.push(freq.get(straightable[e])[0]);
      if (strCards.length >= 5) result.push(mk('straight', straightable[e], strCards.length, [...strCards]));
    }
  }

  const pairable = ranks.filter(r => r <= Rank.Ace && freq.get(r).length >= 2);
  for (let s = 0; s < pairable.length; s++) {
    const psCards = [...freq.get(pairable[s]).slice(0, 2)];
    for (let e = s + 1; e < pairable.length; e++) {
      if (pairable[e] !== pairable[e - 1] + 1) break;
      psCards.push(...freq.get(pairable[e]).slice(0, 2));
      if (e - s + 1 >= 3) result.push(mk('pair_straight', pairable[e], psCards.length, [...psCards]));
    }
  }

  const tripleRanks = ranks.filter(r => r <= Rank.Ace && freq.get(r).length >= 3);
  for (let s = 0; s < tripleRanks.length; s++) {
    const planeCards = [...freq.get(tripleRanks[s]).slice(0, 3)];
    for (let e = s + 1; e < tripleRanks.length; e++) {
      if (tripleRanks[e] !== tripleRanks[e - 1] + 1) break;
      planeCards.push(...freq.get(tripleRanks[e]).slice(0, 3));
      const numTriples = e - s + 1;
      const primary = tripleRanks[e];
      const planeIds = new Set(planeCards.map(c => c.id));
      const remaining = hand.filter(c => !planeIds.has(c.id));
      result.push(mk('plane', primary, planeCards.length, [...planeCards]));
      if (remaining.length >= numTriples)
        result.push(mk('plane_solo', primary, planeCards.length + numTriples, [...planeCards, ...remaining.slice(0, numTriples)]));
      const remPairs = Array.from(rankFreq(remaining).entries()).filter(([, g]) => g.length >= 2).sort(([a], [b]) => a - b);
      if (remPairs.length >= numTriples) {
        const pairCards = remPairs.slice(0, numTriples).flatMap(([, g]) => g.slice(0, 2));
        result.push(mk('plane_pair', primary, planeCards.length + numTriples * 2, [...planeCards, ...pairCards]));
      }
    }
  }

  for (const [r, cs] of freq) {
    if (cs.length < 4) continue;
    const qIds = new Set(cs.map(c => c.id));
    const rem = hand.filter(c => !qIds.has(c.id));
    if (rem.length >= 2) result.push(mk('four_two', r, 6, [...cs, ...rem.slice(0, 2)]));
    const remPairs = Array.from(rankFreq(rem).entries()).filter(([, g]) => g.length >= 2).sort(([a], [b]) => a - b);
    if (remPairs.length >= 2) {
      const pairCards = [...remPairs[0][1].slice(0, 2), ...remPairs[1][1].slice(0, 2)];
      result.push(mk('four_pairs', r, 8, [...cs, ...pairCards]));
    }
  }

  const seen = new Set();
  return result.filter(c => {
    const key = `${c.type}|${c.primaryRank}|${c.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getValidBeats(hand, target) {
  return generateCombinations(hand).filter(c => beats(target, c));
}

export function getHint(hand, target) {
  if (target === null) {
    const combos = generateCombinations(hand);
    const pairs = combos.filter(c => c.type === 'pair').sort((a, b) => a.primaryRank - b.primaryRank);
    if (pairs.length > 0) return pairs[0].cards;
    const singles = combos.filter(c => c.type === 'single' && c.primaryRank < Rank.BlackJoker).sort((a, b) => a.primaryRank - b.primaryRank);
    return singles.length > 0 ? singles[0].cards : (hand.length > 0 ? [hand[0]] : null);
  }
  const valid = getValidBeats(hand, target);
  if (valid.length === 0) return null;
  const nonBombs = valid.filter(c => c.type !== 'bomb' && c.type !== 'rocket');
  const pool = nonBombs.length > 0 ? nonBombs : valid;
  return pool.reduce((min, c) => c.primaryRank < min.primaryRank ? c : min).cards;
}

export const COMBO_LABELS = {
  single: '单张', pair: '对子', triple: '三张', triple_one: '三带一',
  triple_pair: '三带二', straight: '顺子', pair_straight: '双顺',
  plane: '飞机', plane_solo: '飞机带单', plane_pair: '飞机带对',
  four_two: '四带二', four_pairs: '四带两对', bomb: '炸弹', rocket: '火箭',
};
