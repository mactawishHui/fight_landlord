import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { useGame } from '../state/GameContext';
import { AudioManager } from '../utils/AudioManager';

/** Decorative card fan SVG for the home screen. */
function CardFan() {
  const cards = [
    { label: 'A',  suit: '\u2660', color: '#1a1a1a', angle: -20, x: 60,  y: 30 },
    { label: 'K',  suit: '\u2665', color: '#cc0000', angle: -10, x: 90,  y: 20 },
    { label: 'BJ', suit: '*',      color: '#cc0000', angle: 0,   x: 120, y: 16 },
    { label: '2',  suit: '\u2663', color: '#1a1a1a', angle: 10,  x: 150, y: 20 },
    { label: 'A',  suit: '\u2666', color: '#cc0000', angle: 20,  x: 180, y: 30 },
  ];
  return (
    <Svg width={260} height={120}>
      {cards.map((c, i) => (
        /* Use transform string for reliable SVG rotation across all platforms */
        <G key={i} transform={`rotate(${c.angle}, ${c.x + 22}, ${c.y + 33})`}>
          <Rect x={c.x} y={c.y} width={44} height={66} rx={5} fill="white" stroke="#ccc" strokeWidth={1} />
          <SvgText x={c.x + 5} y={c.y + 16} fontSize={13} fill={c.color} fontWeight="bold">{c.label}</SvgText>
          <SvgText x={c.x + 22} y={c.y + 44} fontSize={22} fill={c.color} textAnchor="middle">{c.suit}</SvgText>
        </G>
      ))}
    </Svg>
  );
}

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const { state } = useGame();
  const hasScores = Object.values(state.scores).some(s => s !== 0);

  // Home BGM
  useEffect(() => {
    AudioManager.playBgm('home').catch(() => {});
    return () => { AudioManager.stopBgm().catch(() => {}); };
  }, []);

  const handleStart = () => {
    AudioManager.stopBgm().catch(() => {});
    onStart();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>斗 地 主</Text>
      <Text style={styles.subtitle}>Fight the Landlord</Text>

      <View style={styles.fanWrapper}>
        <CardFan />
      </View>

      <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
        <Text style={styles.startText}>开始游戏</Text>
      </TouchableOpacity>

      {hasScores && (
        <View style={styles.scoreBoard}>
          <Text style={styles.scoreBoardTitle}>积分记录</Text>
          {(['human', 'ai1', 'ai2'] as const).map(id => (
            <Text key={id} style={styles.scoreRow}>
              {state.players[id].name}：{state.scores[id] > 0 ? '+' : ''}{state.scores[id]}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.rules}>
        54张牌 · 3人对战 · 智能AI · 炸弹翻倍
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a6b1a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#f1c40f',
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
    letterSpacing: 2,
  },
  fanWrapper: {
    marginBottom: 32,
  },
  startBtn: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 4,
    marginBottom: 24,
  },
  startText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  scoreBoard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 14,
    minWidth: 200,
    marginBottom: 16,
  },
  scoreBoardTitle: {
    color: '#f1c40f',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  scoreRow: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 2,
  },
  rules: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
  },
});
