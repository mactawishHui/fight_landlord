import { Rank, Suit, CombinationType } from '../types';

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs:    '♣',
  diamonds: '♦',
  hearts:   '♥',
  spades:   '♠',
};

export const SUIT_COLORS: Record<Suit, string> = {
  clubs:    '#1a1a1a',
  diamonds: '#cc0000',
  hearts:   '#cc0000',
  spades:   '#1a1a1a',
};

export const RANK_LABELS: Partial<Record<number, string>> = {
  [Rank.Three]:      '3',
  [Rank.Four]:       '4',
  [Rank.Five]:       '5',
  [Rank.Six]:        '6',
  [Rank.Seven]:      '7',
  [Rank.Eight]:      '8',
  [Rank.Nine]:       '9',
  [Rank.Ten]:        '10',
  [Rank.Jack]:       'J',
  [Rank.Queen]:      'Q',
  [Rank.King]:       'K',
  [Rank.Ace]:        'A',
  [Rank.Two]:        '2',
  [Rank.BlackJoker]: 'SJ',
  [Rank.RedJoker]:   'BJ',
};

export const COMBO_LABELS: Record<CombinationType, string> = {
  single:        '单张',
  pair:          '对子',
  triple:        '三张',
  triple_one:    '三带一',
  triple_pair:   '三带二',
  straight:      '顺子',
  pair_straight: '双顺',
  plane:         '飞机',
  plane_solo:    '飞机带单',
  plane_pair:    '飞机带对',
  four_two:      '四带两单',
  four_pairs:    '四带两对',
  bomb:          '炸弹',
  rocket:        '火箭',
};
