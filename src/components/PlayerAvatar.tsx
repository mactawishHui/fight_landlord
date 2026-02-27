import React from 'react';
import { View, Text, Image, ImageSourcePropType } from 'react-native';
import Svg, { Circle, Rect, Path } from 'react-native-svg';

// ── Static avatar image map (Metro requires static literals) ──────────────

const AVATAR_IMAGES: Record<string, ImageSourcePropType> = {
  player_you:        require('../../assets/avatars/player_you.png'),
  player_ai1:        require('../../assets/avatars/player_ai1.png'),
  player_ai2:        require('../../assets/avatars/player_ai2.png'),
  landlord_crown:    require('../../assets/avatars/landlord_crown.png'),
  farmer_hat:        require('../../assets/avatars/farmer_hat.png'),
};

interface Props {
  name: string;
  isLandlord: boolean;
  size?: number;
  isCurrentTurn?: boolean;
  /** Which avatar image key to use ('player_you' | 'player_ai1' | 'player_ai2') */
  avatarKey?: string;
}

/** Player avatar: shows PNG image when available, falls back to SVG. */
export function PlayerAvatar({
  name,
  isLandlord,
  size = 50,
  isCurrentTurn = false,
  avatarKey,
}: Props) {
  const rimColor = isCurrentTurn ? '#f1c40f' : '#bdc3c7';
  const avatarSrc = avatarKey ? AVATAR_IMAGES[avatarKey] : null;
  const roleSrc = isLandlord ? AVATAR_IMAGES['landlord_crown'] : AVATAR_IMAGES['farmer_hat'];

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        {avatarSrc ? (
          /* PNG avatar with highlight ring */
          <View style={{
            width: size, height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: rimColor,
            overflow: 'hidden',
          }}>
            <Image
              source={avatarSrc}
              style={{ width: size, height: size }}
              resizeMode="cover"
            />
          </View>
        ) : (
          /* Fallback SVG avatar */
          <SvgAvatar size={size} isLandlord={isLandlord} isCurrentTurn={isCurrentTurn} />
        )}

        {/* Role badge (crown/hat) — small overlay at bottom-right */}
        {avatarSrc && (
          <View style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: size * 0.38,
            height: size * 0.38,
            borderRadius: size * 0.19,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.4)',
          }}>
            <Image
              source={roleSrc}
              style={{ width: size * 0.38, height: size * 0.38 }}
              resizeMode="cover"
            />
          </View>
        )}
      </View>

      {/* Name label — rendered as React Native Text outside SVG */}
      <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold', textAlign: 'center', marginTop: 2 }}>
        {name}
      </Text>
    </View>
  );
}

/** Original SVG fallback avatar. */
function SvgAvatar({ size, isLandlord, isCurrentTurn }: {
  size: number; isLandlord: boolean; isCurrentTurn: boolean;
}) {
  const bodyColor = isLandlord ? '#c0392b' : '#2980b9';
  const headColor = '#f5cba7';
  const rimColor  = isCurrentTurn ? '#f1c40f' : '#bdc3c7';
  const cx    = size / 2;
  const headR = size * 0.22;
  const headY = size * 0.30;

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={headY} r={headR + 4} fill="none" stroke={rimColor} strokeWidth={2} />
      <Circle cx={cx} cy={headY} r={headR} fill={headColor} stroke="#c39a6b" strokeWidth={1} />
      <Circle cx={cx - 5} cy={headY - 3} r={2} fill="#555" />
      <Circle cx={cx + 5} cy={headY - 3} r={2} fill="#555" />
      <Path
        d={`M ${cx - 5} ${headY + 5} Q ${cx} ${headY + 10} ${cx + 5} ${headY + 5}`}
        fill="none" stroke="#555" strokeWidth={1.5}
      />
      {isLandlord && (
        <Path
          d={`M ${cx - 10} ${headY - headR - 1} L ${cx - 14} ${headY - headR - 12} L ${cx - 5} ${headY - headR - 7} L ${cx} ${headY - headR - 14} L ${cx + 5} ${headY - headR - 7} L ${cx + 14} ${headY - headR - 12} L ${cx + 10} ${headY - headR - 1} Z`}
          fill="#f1c40f" stroke="#d4ac0d" strokeWidth={1}
        />
      )}
      <Rect
        x={cx - 12} y={size * 0.55}
        width={24} height={size * 0.32}
        rx={4} fill={bodyColor} stroke="#1a5276" strokeWidth={1}
      />
    </Svg>
  );
}
