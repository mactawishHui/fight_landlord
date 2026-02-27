import React from 'react';
import { Text, TextStyle } from 'react-native';

interface Props {
  text: string;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}

/**
 * Renders a card display string with ♥ and ♦ symbols colored red (#cc0000).
 * All other characters use the default/inherited color from `style`.
 */
export function ColoredCardText({ text, style, numberOfLines }: Props) {
  const segs: Array<{ t: string; red: boolean }> = [];
  for (const ch of text) {
    const red = ch === '♥' || ch === '♦';
    if (segs.length > 0 && segs[segs.length - 1].red === red) {
      segs[segs.length - 1].t += ch;
    } else {
      segs.push({ t: ch, red });
    }
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segs.map((s, i) =>
        s.red
          ? <Text key={i} style={{ color: '#cc0000' }}>{s.t}</Text>
          : <Text key={i}>{s.t}</Text>
      )}
    </Text>
  );
}
