import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Player } from '../types';
import { CardSvg } from './CardSvg';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  player: Player;
  isCurrentTurn: boolean;
  side: 'left' | 'right';
  /** True when this player just passed — show "不出" badge */
  justPassed?: boolean;
  /** Whether the landlord has been determined yet */
  landlordKnown?: boolean;
  /** Vertical layout for landscape side panels */
  vertical?: boolean;
  /**
   * Override the number of card backs shown.
   * Used during deal animation to progressively reveal cards.
   * When undefined, uses player.hand.length.
   */
  visibleCount?: number;
}

const MAX_BACKS          = 10;
const MAX_BACKS_VERTICAL = 8;

export function OpponentArea({ player, isCurrentTurn, side, justPassed, landlordKnown, vertical, visibleCount }: Props) {
  const roleLabel = landlordKnown
    ? (player.isLandlord ? '地主' : '农民')
    : null;

  // ── Vertical layout (landscape side panel) ────────────────────────────────
  if (vertical) {
    const count        = visibleCount ?? player.hand.length;
    const visibleBacks = Math.min(count, MAX_BACKS_VERTICAL);
    const backStep     = 9;
    const backsHeight  = visibleBacks > 0 ? backStep * (visibleBacks - 1) + 42 : 42;

    return (
      <View style={styles.verticalContainer}>
        <PlayerAvatar
          name={player.name}
          isLandlord={player.isLandlord}
          size={36}
          isCurrentTurn={isCurrentTurn}
          avatarKey={`player_${player.id}`}
        />

        {roleLabel && (
          <View style={[styles.roleBadge, player.isLandlord ? styles.landlordBadge : styles.farmerBadge]}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        )}

        <Text style={styles.cardCountText}>{player.hand.length} 张</Text>

        {/* Vertical stack of card backs */}
        <View style={[styles.verticalBacks, { height: Math.max(backsHeight, 42) }]}>
          {Array.from({ length: visibleBacks }).map((_, i) => (
            <View key={i} style={[styles.verticalBack, { top: i * backStep, zIndex: i }]}>
              <CardSvg faceUp={false} width={28} height={42} />
            </View>
          ))}
        </View>

        {justPassed && (
          <View style={styles.passBadge}>
            <Text style={styles.passText}>不出</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Horizontal layout (portrait) ──────────────────────────────────────────
  const count        = visibleCount ?? player.hand.length;
  const visibleBacks = Math.min(count, MAX_BACKS);
  const backStep     = 12;

  return (
    <View style={[styles.container, side === 'right' && styles.right]}>
      <PlayerAvatar
        name={player.name}
        isLandlord={player.isLandlord}
        size={44}
        isCurrentTurn={isCurrentTurn}
        avatarKey={`player_${player.id}`}
      />

      {roleLabel && (
        <View style={[styles.roleBadge, player.isLandlord ? styles.landlordBadge : styles.farmerBadge]}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      )}

      <View style={[styles.backsContainer, { width: Math.max(backStep * (visibleBacks - 1) + 36, 36) }]}>
        {Array.from({ length: visibleBacks }).map((_, i) => (
          <View key={i} style={[styles.back, { left: i * backStep, zIndex: i }]}>
            <CardSvg faceUp={false} width={36} height={54} />
          </View>
        ))}
      </View>

      {justPassed && (
        <View style={styles.passBadge}>
          <Text style={styles.passText}>不出</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Portrait (horizontal) styles ──────────────────────────────────────────
  container: {
    alignItems: 'center',
    flexDirection: 'column',
    paddingHorizontal: 8,
  },
  right: {
    alignItems: 'center',
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  landlordBadge: { backgroundColor: '#c0392b' },
  farmerBadge:   { backgroundColor: '#27ae60' },
  roleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  backsContainer: {
    height: 58,
    position: 'relative',
    marginTop: 4,
  },
  back: {
    position: 'absolute',
    top: 0,
  },
  passBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  passText: {
    color: '#ff9999',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // ── Landscape (vertical) styles ───────────────────────────────────────────
  verticalContainer: {
    width: 76,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cardCountText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 4,
  },
  verticalBacks: {
    position: 'relative',
    width: 28,
  },
  verticalBack: {
    position: 'absolute',
    left: 0,
  },
});
