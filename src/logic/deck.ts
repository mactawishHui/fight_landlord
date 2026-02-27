import { Card, Rank, Suit } from '../types';

const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];

const NORMAL_RANKS: Rank[] = [
  Rank.Three, Rank.Four,  Rank.Five,  Rank.Six,  Rank.Seven,
  Rank.Eight, Rank.Nine,  Rank.Ten,   Rank.Jack, Rank.Queen,
  Rank.King,  Rank.Ace,   Rank.Two,
];

/** Build a standard 54-card deck (52 + 2 jokers). */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of NORMAL_RANKS) {
      deck.push({
        id: `${suit[0].toUpperCase()}${rank}`,
        suit,
        rank,
      });
    }
  }
  deck.push({ id: 'BJ', suit: null, rank: Rank.BlackJoker });
  deck.push({ id: 'RJ', suit: null, rank: Rank.RedJoker });
  return deck;
}

/** Fisher-Yates shuffle — returns a new array. */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Sort a hand: ascending rank, then by suit within same rank. */
export function sortHand(cards: Card[]): Card[] {
  const suitOrder: Record<string, number> = {
    clubs: 0, diamonds: 1, hearts: 2, spades: 3,
  };
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const sa = a.suit != null ? suitOrder[a.suit] : 4;
    const sb = b.suit != null ? suitOrder[b.suit] : 4;
    return sa - sb;
  });
}

/**
 * Deal a shuffled deck: 17 cards each to 3 players, 3 as bottom cards.
 * Returns hands in player order [0, 1, 2].
 */
export function deal(): {
  hands: [Card[], Card[], Card[]];
  bottomCards: Card[];
} {
  const deck = shuffle(createDeck());
  return {
    hands: [
      sortHand(deck.slice(0, 17)),
      sortHand(deck.slice(17, 34)),
      sortHand(deck.slice(34, 51)),
    ],
    bottomCards: deck.slice(51, 54),
  };
}
