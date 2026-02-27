import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { GameState, PlayerId } from '../types';
import { COMBO_LABELS, SUIT_SYMBOLS, RANK_LABELS } from '../constants/cards';
import { ColoredCardText } from '../components/ColoredCardText';

interface Props {
  state: GameState;
  onNextRound: () => void;
  onHome: () => void;
}

export function ResultScreen({ state, onNextRound, onHome }: Props) {
  const { winner, winnerTeam, landlord, baseScore, multiplier, scores, players, history } = state;

  const finalScore    = baseScore * multiplier;
  const isLandlordWin = winnerTeam === 'landlord';
  const winnerName    = winner ? players[winner].name : '?';

  // ── Round score delta for each player ─────────────────────────────────────
  const roundDelta: Record<PlayerId, number> = { human: 0, ai1: 0, ai2: 0 };
  if (winner && landlord) {
    for (const id of ['human', 'ai1', 'ai2'] as PlayerId[]) {
      roundDelta[id] = id === landlord
        ? (isLandlordWin ? finalScore * 2 : -finalScore * 2)
        : (isLandlordWin ? -finalScore : finalScore);
    }
  }

  // ── Build grouped trick history ────────────────────────────────────────────
  type PlayEntry = { playerId: PlayerId; comboLabel: string; cardsStr: string; isLandlord: boolean };
  const rounds: PlayEntry[][] = [];

  for (const h of history) {
    if (!h.combination) continue;

    const cardsStr = h.combination.cards.map(c => {
      if (!c.suit) return RANK_LABELS[c.rank] ?? '?';
      return (SUIT_SYMBOLS[c.suit] ?? '') + (RANK_LABELS[c.rank] ?? '?');
    }).join(' ');

    const entry: PlayEntry = {
      playerId:   h.playerId,
      comboLabel: COMBO_LABELS[h.combination.type] ?? h.combination.type,
      cardsStr,
      isLandlord: h.playerId === landlord,
    };

    if (h.isNewTrick || rounds.length === 0) {
      rounds.push([entry]);
    } else {
      rounds[rounds.length - 1].push(entry);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>

        {/* ── Result banner ─────────────────────────────────────────── */}
        <View style={[styles.banner, isLandlordWin ? styles.landlordBanner : styles.farmerBanner]}>
          <Text style={styles.bannerText}>
            {isLandlordWin ? '地主胜利！' : '农民胜利！'}
          </Text>
          <Text style={styles.winnerName}>{winnerName} 获胜</Text>
        </View>

        {/* ── Score summary ─────────────────────────────────────────── */}
        <View style={styles.scoreSection}>
          <Text style={styles.sectionTitle}>本局结算</Text>
          <Text style={styles.scoreFormula}>
            底分 {baseScore} × {multiplier}倍 = {finalScore} 分
          </Text>
          {multiplier > 1 && (
            <Text style={styles.multiplierNote}>（含炸弹翻倍）</Text>
          )}
          <View style={styles.scoreDivider} />
          {(['human', 'ai1', 'ai2'] as PlayerId[]).map(id => {
            const p     = players[id];
            const delta = roundDelta[id];
            const total = scores[id];
            const isLL  = id === landlord;
            return (
              <View key={id} style={styles.scoreRow}>
                <View style={styles.scoreNameRow}>
                  <View style={[styles.roleBadge, isLL ? styles.landlordBadge : styles.farmerBadge]}>
                    <Text style={styles.roleText}>{isLL ? '地主' : '农民'}</Text>
                  </View>
                  <Text style={styles.playerName}>{p.name}</Text>
                </View>
                <View style={styles.scoreValGroup}>
                  <Text style={[styles.scoreDelta, delta >= 0 ? styles.positive : styles.negative]}>
                    {delta >= 0 ? '+' : ''}{delta}
                  </Text>
                  <Text style={styles.scoreTotal}>
                    总 {total >= 0 ? '+' : ''}{total}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Play history (scrollable, takes remaining space) ──────── */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>出牌记录（共 {rounds.length} 轮）</Text>
          <ScrollView nestedScrollEnabled>
            {rounds.map((round, ri) => (
              <View key={ri} style={styles.roundBlock}>
                <Text style={styles.roundTitle}>— 第 {ri + 1} 轮 —</Text>
                {round.map((entry, ei) => (
                  <View key={ei} style={styles.historyEntry}>
                    <View style={[
                      styles.entryRole,
                      entry.isLandlord ? styles.landlordBadge : styles.farmerBadge,
                    ]}>
                      <Text style={styles.entryRoleText}>
                        {entry.isLandlord ? '地主' : '农民'}
                      </Text>
                    </View>
                    <Text style={styles.entryName}>{players[entry.playerId].name}</Text>
                    <Text style={styles.entryCombo}>{entry.comboLabel}</Text>
                    <ColoredCardText style={styles.entryCards} numberOfLines={1} text={entry.cardsStr} />
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* ── Action buttons — always visible at bottom ─────────────── */}
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.homeBtn]} onPress={onHome}>
            <Text style={styles.btnText}>返回首页</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.nextBtn]} onPress={onNextRound}>
            <Text style={styles.btnText}>再来一局</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '92%',
    maxWidth: 420,
    maxHeight: '92%',
    overflow: 'hidden',
    elevation: 10,
    flexDirection: 'column',
  },

  // Banner
  banner:        { paddingVertical: 12, alignItems: 'center' },
  landlordBanner:{ backgroundColor: '#c0392b' },
  farmerBanner:  { backgroundColor: '#27ae60' },
  bannerText:    { fontSize: 24, fontWeight: 'bold', color: '#fff', letterSpacing: 4 },
  winnerName:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  // Score
  scoreSection:  { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  sectionTitle:  { fontSize: 10, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 5 },
  scoreFormula:  { fontSize: 15, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  multiplierNote:{ fontSize: 11, color: '#e74c3c', textAlign: 'center', marginTop: 2 },
  scoreDivider:  { height: 1, backgroundColor: '#eee', marginVertical: 7 },
  scoreRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  scoreNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleBadge:     { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  landlordBadge: { backgroundColor: '#c0392b' },
  farmerBadge:   { backgroundColor: '#27ae60' },
  roleText:      { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  playerName:    { fontSize: 13, color: '#333' },
  scoreValGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreDelta:    { fontSize: 16, fontWeight: 'bold', minWidth: 40, textAlign: 'right' },
  scoreTotal:    { fontSize: 11, color: '#888' },
  positive:      { color: '#27ae60' },
  negative:      { color: '#e74c3c' },

  // History — flex:1 so it takes remaining vertical space
  historySection: {
    flex: 1,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  roundBlock: { marginBottom: 6 },
  roundTitle: { fontSize: 10, color: '#999', textAlign: 'center', marginBottom: 3, fontWeight: 'bold' },
  historyEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, gap: 4 },
  entryRole:     { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  entryRoleText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  entryName:     { fontSize: 11, color: '#333', width: 38 },
  entryCombo:    { fontSize: 11, color: '#555', width: 48 },
  entryCards:    { fontSize: 11, color: '#333', flex: 1 },

  // Buttons
  btnRow:   { flexDirection: 'row', padding: 12, gap: 12 },
  btn:      { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  homeBtn:  { backgroundColor: '#7f8c8d' },
  nextBtn:  { backgroundColor: '#e74c3c' },
  btnText:  { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
