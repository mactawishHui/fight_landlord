import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { AudioManager } from '../utils/AudioManager';
import { Card } from '../types';
import { useGame } from '../state/GameContext';
import { CardSvg } from '../components/CardSvg';
import { CardHand } from '../components/CardHand';
import { OpponentArea } from '../components/OpponentArea';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { LastPlayDisplay } from '../components/LastPlayDisplay';
import { BidPanel } from '../components/BidPanel';
import { ActionBar } from '../components/ActionBar';
import { ColoredCardText } from '../components/ColoredCardText';
import { ResultScreen } from './ResultScreen';
import { detectCombination, beats, getHint } from '../logic/combinations';
import { COMBO_LABELS, SUIT_SYMBOLS, RANK_LABELS } from '../constants/cards';

// ── Deal animation constants ──────────────────────────────────────────────────

/**
 * Total animated cards during deal:
 *   6 rounds × 3 players = 18  +  3 landlord cards = 21
 */
const NUM_DEAL_CARDS = 21;
const DEAL_CARD_DELAY_MS = 85;   // ms between launching each card
const DEAL_SETTLE_MS     = 220;  // approx spring settle time → when card arrives

/** Round-robin: 6 × [ai1, ai2, human], then 3 × [landlord] */
function buildDealSequence(): number[] {
  const seq: number[] = [];
  for (let r = 0; r < 6; r++) seq.push(0, 1, 2);
  seq.push(3, 3, 3);
  return seq;
}

type DealCounts = { ai1: number; ai2: number; human: number; landlord: number };
const ZERO_COUNTS: DealCounts = { ai1: 0, ai2: 0, human: 0, landlord: 0 };

// ── Component ─────────────────────────────────────────────────────────────────

export function GameScreen({ onHome }: { onHome: () => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const { state, playCards, pass, bid, nextRound } = useGame();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [showResult, setShowResult]   = useState(false);
  const [dealAnimating, setDealAnimating] = useState(false);
  const [dealCounts, setDealCounts]   = useState<DealCounts>(ZERO_COUNTS);
  const [historyVisible, setHistoryVisible] = useState(false);
  const prevPhaseRef = useRef<string>('idle');

  // ── 21 Animated values for deal cards ────────────────────────────────────
  const dealCardAnims = useRef(
    Array.from({ length: NUM_DEAL_CARDS }, () => new Animated.ValueXY({ x: 0, y: 0 }))
  ).current;
  const dealCardOpacities = useRef(
    Array.from({ length: NUM_DEAL_CARDS }, () => new Animated.Value(0))
  ).current;

  const { phase, players, currentTurn, trick, landlord, bids, landlordCards } = state;
  const human = players['human'];
  const ai1   = players['ai1'];
  const ai2   = players['ai2'];

  const isHumanTurn    = currentTurn === 'human';
  const currentMaxBid  = bids.length > 0 ? Math.max(...bids.map(b => b.bid)) : 0;
  const landlordKnown  = landlord !== null;

  // ── Compute deal animation targets from screen dimensions ─────────────────
  const dealTargets = useMemo(() => {
    const cx = W / 2;
    const cy = H / 2;
    const topBarH       = 48;
    const humanSectionH = Math.min(220, H * 0.27); // ~27% of screen
    const mainRowH      = H - topBarH - humanSectionH;
    const aiPanelW      = 76;

    // ai1 card stack center (left vertical panel)
    const ai1X = aiPanelW / 2;
    const ai1Y = topBarH + mainRowH * 0.48;
    // ai2 card stack center (right vertical panel)
    const ai2X = W - aiPanelW / 2;
    // human card hand center (inside humanSection)
    const humanHandY = H - humanSectionH + 85;
    // landlord pile (in topBar)
    const landlordY = topBarH / 2;

    return [
      { x: ai1X - cx,  y: ai1Y - cy     }, // 0 = ai1
      { x: ai2X - cx,  y: ai1Y - cy     }, // 1 = ai2
      { x: 0,          y: humanHandY-cy  }, // 2 = human
      { x: W*0.08,     y: landlordY - cy }, // 3 = landlord pile
    ];
  }, [W, H]);

  // ── Game BGM ─────────────────────────────────────────────────────────────
  useEffect(() => {
    AudioManager.playBgm('game').catch(() => {});
    return () => { AudioManager.stopBgm().catch(() => {}); };
  }, []);

  // ── Deal animation + SFX ─────────────────────────────────────────────────
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (phase === 'bidding' && prevPhase !== 'bidding') {
      // Reset animation values and card counts
      dealCardAnims.forEach(a => a.setValue({ x: 0, y: 0 }));
      dealCardOpacities.forEach(a => a.setValue(0));
      setDealCounts(ZERO_COUNTS);
      setDealAnimating(true);

      const sequence = buildDealSequence();
      const playerKeys = ['ai1', 'ai2', 'human', 'landlord'] as const;

      // Per-card spring animations
      const animations = sequence.map((targetIdx, i) =>
        Animated.sequence([
          Animated.delay(i * DEAL_CARD_DELAY_MS),
          Animated.parallel([
            Animated.timing(dealCardOpacities[i], {
              toValue: 1, duration: 35, useNativeDriver: true,
            }),
            Animated.spring(dealCardAnims[i], {
              toValue: dealTargets[targetIdx],
              speed: 24,
              bounciness: 1,
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      Animated.parallel(animations).start(() => {
        setTimeout(() => setDealAnimating(false), 300);
      });

      // Play deal sound + increment card count when each card arrives
      sequence.forEach((targetIdx, i) => {
        const launchDelay = i * DEAL_CARD_DELAY_MS;
        // Sound plays when card launches
        setTimeout(
          () => AudioManager.playSfx('deal').catch(() => {}),
          launchDelay
        );
        // Count increments when card settles at destination
        setTimeout(() => {
          setDealCounts(prev => ({
            ...prev,
            [playerKeys[targetIdx]]: prev[playerKeys[targetIdx]] + 1,
          }));
        }, launchDelay + DEAL_SETTLE_MS);
      });
    }
  }, [phase, dealTargets]);

  // 2-second delay before showing result overlay
  useEffect(() => {
    if (phase === 'game_over') {
      const t = setTimeout(() => setShowResult(true), 2000);
      return () => clearTimeout(t);
    } else {
      setShowResult(false);
    }
  }, [phase]);

  // ── Auto-clear error message ──────────────────────────────────────────────
  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 2500);
    return () => clearTimeout(t);
  }, [errorMsg]);

  // ── Clear selection when it's no longer human's turn ─────────────────────
  useEffect(() => {
    if (!isHumanTurn) setSelectedIds(new Set());
  }, [isHumanTurn]);

  // ── Card selection ────────────────────────────────────────────────────────
  const toggleCard = useCallback((card: Card) => {
    AudioManager.playSfx('card_select').catch(() => {});
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
    setErrorMsg(null);
  }, []);

  // ── Derived combo validation ──────────────────────────────────────────────
  const selectedCards = human.hand.filter(c => selectedIds.has(c.id));
  const selectedCombo = selectedCards.length > 0 ? detectCombination(selectedCards) : null;

  let canPlay = false;
  if (isHumanTurn && phase === 'playing' && selectedCombo) {
    canPlay = trick.lastCombination === null ? true : beats(trick.lastCombination, selectedCombo);
  }
  const canPass = isHumanTurn && phase === 'playing' && trick.lastCombination !== null;

  // ── Actions ───────────────────────────────────────────────────────────────
  const handlePlay = () => {
    if (!canPlay) {
      setErrorMsg(selectedCombo ? '出牌不合法，无法压过对方' : '请选择有效的牌型');
      return;
    }
    playCards(selectedCards);
    setSelectedIds(new Set());
    setErrorMsg(null);
  };

  const handlePass = () => {
    pass();
    setSelectedIds(new Set());
    setErrorMsg(null);
  };

  const handleHint = () => {
    const hintCards = getHint(human.hand, trick.lastCombination);
    if (hintCards) {
      setSelectedIds(new Set(hintCards.map(c => c.id)));
      setErrorMsg(null);
    } else {
      setErrorMsg('没有可以出的牌，只能不出');
    }
  };

  const handleBid = (amount: 0 | 1 | 2 | 3) => {
    bid(amount);
    setErrorMsg(null);
  };

  const humanRoleLabel = landlordKnown
    ? (human.isLandlord ? '地主' : '农民')
    : null;

  // ── History formatting ────────────────────────────────────────────────────
  type HistEntry = {
    name: string; isLandlord: boolean;
    cardsText: string; comboLabel: string;
    isPassed: boolean; isNewTrick: boolean;
  };

  const formattedHistory: HistEntry[] = state.history.map(h => {
    const name = players[h.playerId].name;
    const isLandlord = h.playerId === landlord;
    if (!h.combination) {
      return { name, isLandlord, cardsText: '不出', comboLabel: '不出', isPassed: true, isNewTrick: h.isNewTrick ?? false };
    }
    const cardsText = h.combination.cards.map(c => {
      if (!c.suit) return RANK_LABELS[c.rank] ?? '?';
      return SUIT_SYMBOLS[c.suit] + (RANK_LABELS[c.rank] ?? '?');
    }).join(' ');
    return {
      name, isLandlord, cardsText,
      comboLabel: COMBO_LABELS[h.combination.type] ?? '',
      isPassed: false, isNewTrick: h.isNewTrick ?? false,
    };
  });

  const recentPlays = formattedHistory.slice(-4);

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0d4d0d" hidden />

      {/* ── Top bar: score + landlord cards ───────────────────────────────── */}
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>
          底分 {state.baseScore}  ×{state.multiplier}
          {landlord ? `  地主：${players[landlord].name}` : ''}
        </Text>

        <View style={styles.topBarCards}>
          {/* Show landlord cards progressively during deal */}
          {landlordCards.slice(0, dealAnimating ? dealCounts.landlord : landlordCards.length).map((card) => (
            <View key={card.id} style={{ marginHorizontal: 2 }}>
              <CardSvg
                card={card}
                faceUp={phase !== 'bidding' || landlord !== null}
                width={28}
                height={42}
              />
            </View>
          ))}
          {landlord && <Text style={styles.landlordTag}>底牌</Text>}
        </View>

        <Text style={styles.topBarScore}>
          你 {state.scores.human >= 0 ? '+' : ''}{state.scores.human}
        </Text>
      </View>

      {/* ── Main row: AI1 | center table | AI2 ────────────────────────────── */}
      <View style={styles.mainRow}>

        {/* Left AI (ai1) */}
        <OpponentArea
          player={ai1}
          isCurrentTurn={currentTurn === 'ai1'}
          side="left"
          justPassed={trick.lastPass === 'ai1'}
          landlordKnown={landlordKnown}
          vertical
          visibleCount={dealAnimating ? dealCounts.ai1 : undefined}
        />

        {/* Center table */}
        <View style={styles.table}>
          {phase === 'bidding' && !dealAnimating ? (
            <BidPanel
              isHumanTurn={isHumanTurn}
              currentMaxBid={currentMaxBid}
              onBid={handleBid}
              waitingPlayerName={!isHumanTurn ? players[currentTurn].name : undefined}
            />
          ) : phase === 'playing' ? (
            <LastPlayDisplay
              lastCombination={trick.lastCombination}
              lastPlayerId={trick.lastPlayerId}
              players={players}
              landlord={landlord}
              currentTurn={currentTurn}
            />
          ) : null}

          {/* Combo label while selecting */}
          {phase === 'playing' && selectedCombo && (
            <Text style={[styles.comboLabel, canPlay ? styles.comboValid : styles.comboInvalid]}>
              {COMBO_LABELS[selectedCombo.type]}
              {!canPlay && trick.lastCombination ? '（无法压过）' : ''}
            </Text>
          )}

          {/* History corner widget — only during playing phase */}
          {phase === 'playing' && formattedHistory.length > 0 && (
            <TouchableOpacity
              style={styles.historyWidget}
              onPress={() => setHistoryVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.historyWidgetTitle}>出牌记录 ▶</Text>
              {recentPlays.map((e, i) => (
                <ColoredCardText
                  key={i}
                  style={styles.historyWidgetLine}
                  numberOfLines={1}
                  text={`${e.name.slice(0, 2)}: ${e.isPassed ? '不出' : e.cardsText}`}
                />
              ))}
            </TouchableOpacity>
          )}
        </View>

        {/* Right AI (ai2) */}
        <OpponentArea
          player={ai2}
          isCurrentTurn={currentTurn === 'ai2'}
          side="right"
          justPassed={trick.lastPass === 'ai2'}
          landlordKnown={landlordKnown}
          vertical
          visibleCount={dealAnimating ? dealCounts.ai2 : undefined}
        />

      </View>

      {/* ── Human player area ─────────────────────────────────────────────── */}
      <View style={styles.humanSection}>

        {/* Player info header */}
        <View style={styles.humanHeader}>
          <PlayerAvatar
            name={human.name}
            isLandlord={human.isLandlord}
            size={36}
            isCurrentTurn={isHumanTurn}
            avatarKey="player_you"
          />
          {humanRoleLabel && (
            <View style={[styles.roleBadge, human.isLandlord ? styles.landlordBadge : styles.farmerBadge]}>
              <Text style={styles.roleText}>{humanRoleLabel}</Text>
            </View>
          )}
          <Text style={styles.handCount}>{human.hand.length} 张</Text>
        </View>

        {/* Status messages near human area (pass badge + error) */}
        {trick.lastPass === 'human' && (
          <View style={styles.humanStatusBadge}>
            <Text style={styles.humanPassText}>不出</Text>
          </View>
        )}
        {errorMsg && (
          <View style={styles.humanStatusBadge}>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
          </View>
        )}

        {/* Action bar — ABOVE the card hand */}
        {phase === 'playing' && (
          <ActionBar
            isHumanTurn={isHumanTurn}
            canPlay={canPlay}
            canPass={canPass}
            onPlay={handlePlay}
            onPass={handlePass}
            onHint={handleHint}
          />
        )}

        {/* Card hand */}
        <CardHand
          cards={human.hand}
          selectedIds={selectedIds}
          onToggle={toggleCard}
          disabled={!isHumanTurn || phase !== 'playing'}
          visibleCount={dealAnimating ? dealCounts.human : undefined}
        />

      </View>

      {/* ── Result overlay ──────────────────────────────────────────────────── */}
      {phase === 'game_over' && showResult && (
        <ResultScreen
          state={state}
          onNextRound={() => { setSelectedIds(new Set()); nextRound(); }}
          onHome={() => { setSelectedIds(new Set()); onHome(); }}
        />
      )}

      {/* ── Deal animation overlay ─────────────────────────────────────────── */}
      {dealAnimating && (
        <View style={styles.dealOverlay} pointerEvents="none">
          {dealCardAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dealCard,
                {
                  opacity: dealCardOpacities[i],
                  transform: [
                    { translateX: anim.x },
                    { translateY: anim.y },
                  ],
                },
              ]}
            />
          ))}
        </View>
      )}

      {/* ── History full overlay ───────────────────────────────────────────── */}
      {historyVisible && (
        <TouchableOpacity
          style={styles.historyOverlayBg}
          activeOpacity={1}
          onPress={() => setHistoryVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.historyOverlayCard} onPress={() => {}}>
            <View style={styles.historyOverlayHeader}>
              <Text style={styles.historyOverlayTitle}>出牌记录</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.historyCloseBtn}>
                <Text style={styles.historyCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.historyOverlayScroll}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {formattedHistory.length === 0 ? (
                <Text style={styles.historyEmpty}>暂无出牌记录</Text>
              ) : (
                formattedHistory.map((e, i) => {
                  const isTrickStart = e.isNewTrick && i > 0;
                  return (
                    <View key={i}>
                      {isTrickStart && <View style={styles.historyDivider} />}
                      <View style={styles.historyOverlayEntry}>
                        <View style={[
                          styles.historyRoleBadge,
                          e.isLandlord ? styles.historyLandlordBadge : styles.historyFarmerBadge,
                        ]}>
                          <Text style={styles.historyRoleText}>{e.isLandlord ? '地' : '农'}</Text>
                        </View>
                        <Text style={styles.historyEntryName} numberOfLines={1}>{e.name}</Text>
                        {e.isPassed ? (
                          <Text style={styles.historyPassText}>不出</Text>
                        ) : (
                          <>
                            <Text style={styles.historyComboLabel}>{e.comboLabel}</Text>
                            <ColoredCardText style={styles.historyEntryCards} numberOfLines={1} text={e.cardsText} />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a6b1a' },

  // ── Top bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topBarText:  { color: '#f1c40f', fontSize: 12, fontWeight: 'bold', flex: 1 },
  topBarCards: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  landlordTag: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginLeft: 6 },
  topBarScore: { color: '#fff', fontSize: 12, flex: 1, textAlign: 'right' },

  // ── Main row ──────────────────────────────────────────────────────────────
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // ── Center table ──────────────────────────────────────────────────────────
  table: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  comboLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comboValid:   { backgroundColor: 'rgba(39,174,96,0.8)',  color: '#fff' },
  comboInvalid: { backgroundColor: 'rgba(231,76,60,0.8)',  color: '#fff' },

  // ── History corner widget ──────────────────────────────────────────────────
  historyWidget: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 100,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderRadius: 8,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  historyWidgetTitle: { color: '#f1c40f', fontSize: 9, fontWeight: 'bold', marginBottom: 3 },
  historyWidgetLine:  { color: '#fff', fontSize: 9, lineHeight: 13 },

  // ── History overlay ────────────────────────────────────────────────────────
  historyOverlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 80,
  },
  historyOverlayCard: {
    backgroundColor: 'rgba(15,40,15,0.97)',
    borderRadius: 14,
    width: '88%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  historyOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  historyOverlayTitle: { color: '#f1c40f', fontSize: 15, fontWeight: 'bold', letterSpacing: 2 },
  historyCloseBtn:     { padding: 4 },
  historyCloseBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 16 },
  historyOverlayScroll: { flex: 1, paddingHorizontal: 12, paddingTop: 6 },
  historyEmpty:  { color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', marginTop: 20 },
  historyDivider:{ height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 5 },
  historyOverlayEntry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 5 },
  historyRoleBadge: { width: 18, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  historyLandlordBadge: { backgroundColor: '#c0392b' },
  historyFarmerBadge:   { backgroundColor: '#27ae60' },
  historyRoleText:    { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  historyEntryName:   { color: 'rgba(255,255,255,0.85)', fontSize: 11, width: 36 },
  historyPassText:    { color: 'rgba(255,150,150,0.9)', fontSize: 11, flex: 1 },
  historyComboLabel:  { color: 'rgba(241,196,15,0.9)', fontSize: 10, width: 44 },
  historyEntryCards:  { color: '#fff', fontSize: 11, flex: 1 },

  // ── Human section ─────────────────────────────────────────────────────────
  humanSection: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingTop: 2,
    paddingBottom: 2,
  },
  humanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 2,
    gap: 6,
  },
  roleBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  landlordBadge: { backgroundColor: '#c0392b' },
  farmerBadge:   { backgroundColor: '#27ae60' },
  roleText:  { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  handCount: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  // Status messages (pass badge / error) near human area
  humanStatusBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 2,
  },
  humanPassText: { color: '#ff9999', fontSize: 12, fontWeight: 'bold' },
  errorMsg:      { color: '#ff6b6b', fontSize: 12 },

  // ── Deal animation ─────────────────────────────────────────────────────────
  dealOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  dealCard: {
    position: 'absolute',
    width: 30,
    height: 45,
    borderRadius: 4,
    backgroundColor: '#1a4e8a',
    borderWidth: 1.5,
    borderColor: '#0d2f5a',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
});
