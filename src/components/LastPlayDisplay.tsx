import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Combination, Player, PlayerId } from '../types';
import { CardSvg } from './CardSvg';
import { COMBO_LABELS } from '../constants/cards';

interface Props {
  lastCombination: Combination | null;
  lastPlayerId: PlayerId | null;
  players: Record<PlayerId, Player>;
  /** Needed to show landlord/farmer badge next to the player name */
  landlord: PlayerId | null;
  /** Current turn player — shown as "XXX 领牌中…" when no combo in play */
  currentTurn?: PlayerId | null;
}

export function LastPlayDisplay({ lastCombination, lastPlayerId, players, landlord, currentTurn }: Props) {
  if (!lastCombination || !lastPlayerId) {
    const leaderName = currentTurn ? (players[currentTurn]?.name ?? currentTurn) : null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {leaderName ? `${leaderName} 领牌中…` : '等待出牌…'}
        </Text>
      </View>
    );
  }

  const player     = players[lastPlayerId];
  const playerName = player?.name ?? lastPlayerId;
  const comboLabel = COMBO_LABELS[lastCombination.type] ?? lastCombination.type;

  const roleKnown = landlord !== null;
  const isLandlord = lastPlayerId === landlord;
  const roleLabel  = roleKnown ? (isLandlord ? '地主' : '农民') : null;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {roleLabel && (
          <View style={[styles.roleBadge, isLandlord ? styles.landlordBadge : styles.farmerBadge]}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        )}
        <Text style={styles.label}>{playerName} · {comboLabel}</Text>
      </View>
      <View style={styles.cards}>
        {lastCombination.cards.map((card, i) => (
          <View
            key={card.id}
            style={{ marginRight: i < lastCombination.cards.length - 1 ? -18 : 0, zIndex: i }}
          >
            <CardSvg card={card} faceUp width={44} height={66} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  roleBadge: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  landlordBadge: { backgroundColor: '#c0392b' },
  farmerBadge:   { backgroundColor: '#27ae60' },
  roleText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  label: {
    fontSize: 13,
    color: '#fff',
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cards: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 90,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
});
