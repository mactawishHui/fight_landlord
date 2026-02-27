import React from 'react';
import { View } from 'react-native';
import { CardImage } from './CardImage';

const ALL_CARD_IDS = [
  'C3','C4','C5','C6','C7','C8','C9','C10','C11','C12','C13','C14','C15',
  'D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15',
  'H3','H4','H5','H6','H7','H8','H9','H10','H11','H12','H13','H14','H15',
  'S3','S4','S5','S6','S7','S8','S9','S10','S11','S12','S13','S14','S15',
  'BJ','RJ',
];

/**
 * Renders all 54 card images off-screen so they are decoded and cached
 * by the OS image subsystem before gameplay begins.
 * Mount this in HomeScreen so images are ready when the game starts.
 */
export const CardPreloader = React.memo(function CardPreloader() {
  return (
    <View style={{ position: 'absolute', opacity: 0, left: -9999, top: -9999 }}>
      {ALL_CARD_IDS.map(id => (
        <CardImage key={id} cardId={id} width={52} height={78} />
      ))}
    </View>
  );
});
