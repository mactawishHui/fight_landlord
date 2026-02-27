import React, { memo } from 'react';
import Svg, { Rect, Text, Line, G } from 'react-native-svg';
import { Card, Rank, Suit } from '../types';
import { SUIT_SYMBOLS, SUIT_COLORS, RANK_LABELS } from '../constants/cards';
import { CardImage } from './CardImage';

interface Props {
  card?: Card;
  faceUp?: boolean;
  width?: number;
  height?: number;
  selected?: boolean;
}

function getCardColor(card: Card): string {
  if (card.rank === Rank.RedJoker)  return '#cc0000';
  if (card.rank === Rank.BlackJoker) return '#1a1a1a';
  if (card.suit && (card.suit === 'hearts' || card.suit === 'diamonds')) return '#cc0000';
  return '#1a1a1a';
}

/** A single playing card rendered as SVG. */
function CardSvgInner({ card, faceUp = true, width = 52, height = 78, selected = false }: Props) {
  const ty = selected ? -14 : 0;

  // ── Card back ────────────────────────────────────────────────────────────
  if (!faceUp || !card) {
    return (
      <Svg width={width} height={height} style={{ transform: [{ translateY: ty }] }}>
        <Rect x={1} y={1} width={width - 2} height={height - 2} rx={5} fill="#1a4e8a" stroke="#0d2f5a" strokeWidth={1.5} />
        <Rect x={4} y={4} width={width - 8} height={height - 8} rx={3} fill="none" stroke="#2462a8" strokeWidth={1} />
        {/* Simple diagonal hatching */}
        {Array.from({ length: 14 }).map((_, i) => (
          <Line key={i}
            x1={-8 + i * 8} y1={0}
            x2={-8 + i * 8 + height} y2={height}
            stroke="#2462a8" strokeWidth={0.6} opacity={0.6}
          />
        ))}
      </Svg>
    );
  }

  // ── Card face — delegate to CardImage (realistic PNG) ────────────────────
  return (
    <CardImage cardId={card.id} width={width} height={height} selected={selected} />
  );
}

export const CardSvg = memo(CardSvgInner);
