// ── Rank constants (mirrors TypeScript enum) ─────────────────────────────────

export const Rank = {
  Three: 3, Four: 4, Five: 5, Six: 6, Seven: 7, Eight: 8, Nine: 9,
  Ten: 10, Jack: 11, Queen: 12, King: 13, Ace: 14, Two: 15,
  BlackJoker: 16, RedJoker: 17,
};

export const RANK_LABELS = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: 'BJ', 17: 'RJ',
};

export const SUIT_SYMBOLS = {
  clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠',
};

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const NORMAL_RANKS = [3,4,5,6,7,8,9,10,11,12,13,14,15];

/** Build a standard 54-card deck. */
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of NORMAL_RANKS) {
      deck.push({ id: `${suit[0].toUpperCase()}${rank}`, suit, rank });
    }
  }
  deck.push({ id: 'BJ', suit: null, rank: Rank.BlackJoker });
  deck.push({ id: 'RJ', suit: null, rank: Rank.RedJoker });
  return deck;
}

/** Fisher-Yates shuffle. */
export function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Sort cards: ascending rank, then by suit. */
export function sortHand(cards) {
  const suitOrder = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const sa = a.suit != null ? suitOrder[a.suit] : 4;
    const sb = b.suit != null ? suitOrder[b.suit] : 4;
    return sa - sb;
  });
}

/** Deal: 17+17+17+3 cards. Returns { hands: [[], [], []], bottomCards: [] }. */
export function deal() {
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

/**
 * Returns the assets/cards path for a card object or id string.
 * Card file naming: rank 10 → '0', J → 'J', Q → 'Q', K → 'K', A → 'A', 2 → '2', 3–9 → face value
 */
export function cardImagePath(card) {
  if (card.id === 'BJ') return 'assets/cards/BJ.png';
  if (card.id === 'RJ') return 'assets/cards/RJ.png';
  const suitLetter = card.suit[0].toUpperCase();
  const rank = card.rank;
  let rankStr;
  if (rank >= 3 && rank <= 9) rankStr = String(rank);
  else if (rank === 10) rankStr = '0';
  else if (rank === 11) rankStr = 'J';
  else if (rank === 12) rankStr = 'Q';
  else if (rank === 13) rankStr = 'K';
  else if (rank === 14) rankStr = 'A';
  else if (rank === 15) rankStr = '2';
  else rankStr = String(rank);
  return `assets/cards/${suitLetter}${rankStr}.png`;
}
