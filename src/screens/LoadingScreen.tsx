import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { AudioManager } from '../utils/AudioManager';
import { CardPreloader } from '../components/CardPreloader';

interface Props {
  onLoaded: () => void;
}

export function LoadingScreen({ onLoaded }: Props) {
  const [pct, setPct] = useState(0);
  const [statusText, setStatusText] = useState('初始化音频...');
  const animPct = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    const reportProgress = (p: number) => {
      if (!mounted) return;
      setPct(p);
      Animated.timing(animPct, {
        toValue: p,
        duration: 200,
        useNativeDriver: false,
      }).start();

      if (p < 20) setStatusText('初始化音频...');
      else if (p < 60) setStatusText('加载音效...');
      else if (p < 90) setStatusText('加载背景音乐...');
      else if (p < 100) setStatusText('准备牌面资源...');
      else setStatusText('加载完成！');
    };

    AudioManager.preloadAll(reportProgress)
      .catch(() => { if (mounted) reportProgress(100); })
      .finally(() => {
        if (!mounted) return;
        // Give CardPreloader an extra 400ms to finish decoding PNGs
        setTimeout(() => { if (mounted) onLoaded(); }, 400);
      });

    return () => { mounted = false; };
  }, []);

  const barWidth = animPct.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root}>
      {/* Silently pre-render all card PNGs off-screen so they're in GPU cache */}
      <CardPreloader />

      <Text style={styles.title}>斗 地 主</Text>
      <Text style={styles.subtitle}>Fight the Landlord</Text>

      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

      <Text style={styles.pctText}>{Math.round(pct)}%</Text>
      <Text style={styles.statusText}>{statusText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a6b1a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#f1c40f',
    letterSpacing: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2,
    marginBottom: 52,
  },
  barBg: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#f1c40f',
    borderRadius: 5,
  },
  pctText: {
    color: '#f1c40f',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },
});
