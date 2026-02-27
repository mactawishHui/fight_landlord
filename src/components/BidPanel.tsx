import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

interface Props {
  isHumanTurn: boolean;
  currentMaxBid: number;
  onBid: (amount: 0 | 1 | 2 | 3) => void;
  waitingPlayerName?: string;
}

export function BidPanel({ isHumanTurn, currentMaxBid, onBid, waitingPlayerName }: Props) {
  if (!isHumanTurn) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color="#f1c40f" />
        <Text style={styles.waitText}>
          {waitingPlayerName ?? 'AI'} 正在考虑…
        </Text>
      </View>
    );
  }

  const bids: Array<{ label: string; value: 0 | 1 | 2 | 3 }> = [
    { label: '不叫', value: 0 },
    { label: '叫一分', value: 1 },
    { label: '叫二分', value: 2 },
    { label: '叫三分', value: 3 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {currentMaxBid > 0 ? `当前最高叫分：${currentMaxBid}` : '是否叫地主？'}
      </Text>
      <View style={styles.row}>
        {bids.map(({ label, value }) => {
          const disabled = value !== 0 && value <= currentMaxBid;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.btn, value === 0 ? styles.passBtn : styles.bidBtn, disabled && styles.disabled]}
              onPress={() => !disabled && onBid(value)}
              disabled={disabled}
            >
              <Text style={[styles.btnText, disabled && styles.disabledText]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  passBtn: { backgroundColor: '#7f8c8d' },
  bidBtn:  { backgroundColor: '#e74c3c' },
  disabled: { backgroundColor: '#444', opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  disabledText: { color: '#aaa' },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  waitText: { color: '#f1c40f', fontSize: 14 },
});
