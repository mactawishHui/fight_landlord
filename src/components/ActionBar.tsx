import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  isHumanTurn: boolean;
  canPlay: boolean;
  canPass: boolean;
  onPlay: () => void;
  onPass: () => void;
  onHint: () => void;
}

export function ActionBar({ isHumanTurn, canPlay, canPass, onPlay, onPass, onHint }: Props) {
  if (!isHumanTurn) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color="#f1c40f" size="small" />
        <Text style={styles.waitText}>AI 思考中…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, styles.hintBtn]}
        onPress={onHint}
      >
        <Text style={styles.btnText}>提示</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.passBtn, !canPass && styles.disabled]}
        onPress={onPass}
        disabled={!canPass}
      >
        <Text style={[styles.btnText, !canPass && styles.disabledText]}>不出</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.playBtn, !canPlay && styles.disabled]}
        onPress={onPlay}
        disabled={!canPlay}
      >
        <Text style={[styles.btnText, !canPlay && styles.disabledText]}>出牌</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  btn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    elevation: 2,
  },
  hintBtn:  { backgroundColor: '#8e44ad' },
  passBtn:  { backgroundColor: '#7f8c8d' },
  playBtn:  { backgroundColor: '#27ae60' },
  disabled: { opacity: 0.4 },
  btnText:  { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  disabledText: { color: '#ccc' },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  waitText: { color: '#f1c40f', fontSize: 14 },
});
