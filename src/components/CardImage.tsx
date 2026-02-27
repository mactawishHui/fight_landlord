/**
 * Renders a playing card face using downloaded PNG images.
 * All 54 require() calls must be static literals (Metro bundler requirement).
 *
 * Card.id format in this game: `{SUIT_INITIAL}{NUMERIC_RANK}`
 *   Suit initials: C=clubs, D=diamonds, H=hearts, S=spades
 *   Ranks: 3–9 (face value), 10=Ten, 11=Jack, 12=Queen, 13=King, 14=Ace, 15=Two
 *   Jokers: 'BJ' (Black), 'RJ' (Red)
 *
 * Downloaded file naming (deckofcardsapi): {SUIT}{APIRANK}.png
 *   APIRANK: 3–9, 0=Ten, J=Jack, Q=Queen, K=King, A=Ace, 2=Two
 */
import React, { memo } from 'react';
import { Image, ImageSourcePropType, View } from 'react-native';

// ── Static require map (54 entries — Metro requires literals) ─────────────

const CARD_IMAGES: Record<string, ImageSourcePropType> = {
  // ── Clubs ──────────────────────────────────────────────────────────────
  'C3':  require('../../assets/cards/C3.png'),
  'C4':  require('../../assets/cards/C4.png'),
  'C5':  require('../../assets/cards/C5.png'),
  'C6':  require('../../assets/cards/C6.png'),
  'C7':  require('../../assets/cards/C7.png'),
  'C8':  require('../../assets/cards/C8.png'),
  'C9':  require('../../assets/cards/C9.png'),
  'C10': require('../../assets/cards/C0.png'),   // Ten → '0' in API
  'C11': require('../../assets/cards/CJ.png'),   // Jack
  'C12': require('../../assets/cards/CQ.png'),   // Queen
  'C13': require('../../assets/cards/CK.png'),   // King
  'C14': require('../../assets/cards/CA.png'),   // Ace
  'C15': require('../../assets/cards/C2.png'),   // Two
  // ── Diamonds ──────────────────────────────────────────────────────────
  'D3':  require('../../assets/cards/D3.png'),
  'D4':  require('../../assets/cards/D4.png'),
  'D5':  require('../../assets/cards/D5.png'),
  'D6':  require('../../assets/cards/D6.png'),
  'D7':  require('../../assets/cards/D7.png'),
  'D8':  require('../../assets/cards/D8.png'),
  'D9':  require('../../assets/cards/D9.png'),
  'D10': require('../../assets/cards/D0.png'),
  'D11': require('../../assets/cards/DJ.png'),
  'D12': require('../../assets/cards/DQ.png'),
  'D13': require('../../assets/cards/DK.png'),
  'D14': require('../../assets/cards/DA.png'),
  'D15': require('../../assets/cards/D2.png'),
  // ── Hearts ────────────────────────────────────────────────────────────
  'H3':  require('../../assets/cards/H3.png'),
  'H4':  require('../../assets/cards/H4.png'),
  'H5':  require('../../assets/cards/H5.png'),
  'H6':  require('../../assets/cards/H6.png'),
  'H7':  require('../../assets/cards/H7.png'),
  'H8':  require('../../assets/cards/H8.png'),
  'H9':  require('../../assets/cards/H9.png'),
  'H10': require('../../assets/cards/H0.png'),
  'H11': require('../../assets/cards/HJ.png'),
  'H12': require('../../assets/cards/HQ.png'),
  'H13': require('../../assets/cards/HK.png'),
  'H14': require('../../assets/cards/HA.png'),
  'H15': require('../../assets/cards/H2.png'),
  // ── Spades ────────────────────────────────────────────────────────────
  'S3':  require('../../assets/cards/S3.png'),
  'S4':  require('../../assets/cards/S4.png'),
  'S5':  require('../../assets/cards/S5.png'),
  'S6':  require('../../assets/cards/S6.png'),
  'S7':  require('../../assets/cards/S7.png'),
  'S8':  require('../../assets/cards/S8.png'),
  'S9':  require('../../assets/cards/S9.png'),
  'S10': require('../../assets/cards/S0.png'),
  'S11': require('../../assets/cards/SJ.png'),
  'S12': require('../../assets/cards/SQ.png'),
  'S13': require('../../assets/cards/SK.png'),
  'S14': require('../../assets/cards/SA.png'),
  'S15': require('../../assets/cards/S2.png'),
  // ── Jokers ────────────────────────────────────────────────────────────
  'BJ':  require('../../assets/cards/BJ.png'),
  'RJ':  require('../../assets/cards/RJ.png'),
};

interface Props {
  cardId: string;
  width: number;
  height: number;
  selected?: boolean;
}

function CardImageInner({ cardId, width, height, selected = false }: Props) {
  const source = CARD_IMAGES[cardId];
  const ty = selected ? -14 : 0;

  if (!source) return null;

  return (
    <View style={[{ width, height, transform: [{ translateY: ty }], borderRadius: 5, overflow: 'hidden' }]}>
      <Image
        source={source}
        style={{ width, height }}
        resizeMode="stretch"
        fadeDuration={0}
      />
    </View>
  );
}

export const CardImage = memo(CardImageInner);
