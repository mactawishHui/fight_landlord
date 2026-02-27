import React, { useRef } from 'react';
import { View, TouchableOpacity, useWindowDimensions, PanResponder } from 'react-native';
import { Card } from '../types';
import { CardSvg } from './CardSvg';

const CARD_W  = 52;
const CARD_H  = 78;
const PADDING = 16;

interface Props {
  cards: Card[];
  selectedIds: Set<string>;
  onToggle: (card: Card) => void;
  disabled?: boolean;
  /**
   * Show only the first N cards (used during deal animation to progressively
   * fill the hand). When undefined, all cards are shown.
   */
  visibleCount?: number;
}

/**
 * Horizontally overlapping fan of face-up cards.
 * Selected cards lift upward (handled inside CardSvg).
 * Supports swipe-to-select gesture for multi-card selection.
 */
export function CardHand({ cards, selectedIds, onToggle, disabled = false, visibleCount }: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const n = cards.length;

  const available     = Math.max(CARD_W + 1, screenWidth - PADDING * 2);
  const totalNoOverlap = n * CARD_W;
  const step = n > 1
    ? (totalNoOverlap > available
        ? Math.max((available - CARD_W) / (n - 1), 10)
        : CARD_W)
    : CARD_W;

  const totalWidth = n === 0 ? 0 : Math.min(step * (n - 1) + CARD_W, available);

  // Display highest card on the left, lowest on the right
  const allCards     = [...cards].reverse();
  // During deal animation, show only the first visibleCount cards
  const displayCards = visibleCount !== undefined
    ? allCards.slice(0, Math.min(visibleCount, allCards.length))
    : allCards;

  // ── Refs ─────────────────────────────────────────────────────────────────
  const containerRef      = useRef<View>(null);
  const containerLeftRef  = useRef(0);
  const swipeSelectedRef  = useRef(new Set<number>());

  // "Latest values" ref so PanResponder handlers always see current props
  const latestRef = useRef({ step, n, displayCards, onToggle, disabled });
  latestRef.current = { step, n, displayCards, onToggle, disabled };

  // ── PanResponder ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      // Don't claim on initial touch so TouchableOpacity taps still fire
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Claim once horizontal movement exceeds threshold
      onMoveShouldSetPanResponder: (_, g) =>
        !latestRef.current.disabled && Math.abs(g.dx) > 6,
      onMoveShouldSetPanResponderCapture: () => false,

      onPanResponderGrant: (evt, gestureState) => {
        swipeSelectedRef.current = new Set();
        const { step: s, n: len, displayCards: dc, onToggle: tog } = latestRef.current;
        // Toggle cards from the gesture start position up to the current position
        const startRelX = gestureState.x0 - containerLeftRef.current;
        const currRelX  = evt.nativeEvent.pageX - containerLeftRef.current;
        const minRelX   = Math.min(startRelX, currRelX);
        const maxRelX   = Math.max(startRelX, currRelX);
        const fromIdx   = Math.max(0, Math.floor(minRelX / s));
        const toIdx     = Math.min(len - 1, Math.floor(maxRelX / s));
        for (let i = fromIdx; i <= toIdx; i++) {
          tog(dc[i]);
          swipeSelectedRef.current.add(i);
        }
      },

      onPanResponderMove: (evt) => {
        const { step: s, n: len, displayCards: dc, onToggle: tog } = latestRef.current;
        const relX = evt.nativeEvent.pageX - containerLeftRef.current;
        const idx  = Math.min(Math.max(Math.floor(relX / s), 0), len - 1);
        if (!swipeSelectedRef.current.has(idx)) {
          tog(dc[idx]);
          swipeSelectedRef.current.add(idx);
        }
      },

      onPanResponderRelease: () => {
        swipeSelectedRef.current = new Set();
      },
      onPanResponderTerminate: () => {
        swipeSelectedRef.current = new Set();
      },
    })
  ).current;

  if (n === 0) return null;

  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      <View
        ref={containerRef}
        onLayout={() => {
          containerRef.current?.measure((_x, _y, _w, _h, pageX) => {
            containerLeftRef.current = pageX;
          });
        }}
        style={{ width: totalWidth, height: CARD_H + 20, position: 'relative' }}
        {...panResponder.panHandlers}
      >
        {displayCards.map((card, index) => {
          const selected = selectedIds.has(card.id);
          return (
            <TouchableOpacity
              key={card.id}
              activeOpacity={0.85}
              onPress={() => !disabled && onToggle(card)}
              style={{
                position: 'absolute',
                left: index * step,
                bottom: 0,
                zIndex: index, // Never boost zIndex for selected — only lift via CardSvg translateY
              }}
            >
              <CardSvg card={card} faceUp width={CARD_W} height={CARD_H} selected={selected} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
