# 斗地主 (Fight the Landlord)

React Native (Expo) implementation of the classic Chinese card game Dou Di Zhu.

## Tech Stack

- **React Native + Expo** (TypeScript) — cross-platform mobile
- **react-native-svg** — SVG card faces and player avatars
- **EAS Build** — generates Android APK

## Features

| Feature | Status |
|---|---|
| 发牌 (Deal 54 cards: 17+17+17+3) | ✅ |
| 抢地主 (Bid for landlord: 0-3 points) | ✅ |
| 出牌 / 不出 (Play or pass) | ✅ |
| 出牌记录 (Play history) | ✅ |
| 胜利计算 + 积分 (Score with multiplier) | ✅ |
| 炸弹/火箭翻倍 (Bomb doubles score) | ✅ |
| 智能AI (Heuristic AI for 2 opponents) | ✅ |
| SVG 牌面 + 玩家头像 | ✅ |
| 提示功能 (Hint button) | ✅ |
| 多局积分记录 | ✅ |

## Supported Card Combinations (牌型)

单张 · 对子 · 三张 · 三带一 · 三带二 · 顺子 · 双顺 · 飞机 · 飞机带单 · 飞机带对 · 四带两单 · 四带两对 · 炸弹 · 火箭

## Development Setup

```bash
cd fight_landlord
npm install
npx expo start
# Press 'a' to open on Android emulator
```

## Build APK

### Method 1: EAS Cloud Build (recommended)

```bash
npm install -g eas-cli
eas login          # create account at expo.dev if needed
eas build --platform android --profile preview
# Download APK link printed at end
```

### Method 2: Local build (requires Android SDK)

```bash
npx expo run:android
```

## Project Structure

```
src/
├── types/index.ts          # All TypeScript types (Card, Combination, GameState…)
├── constants/cards.ts      # Suit symbols, rank labels, combo labels
├── logic/
│   ├── deck.ts             # createDeck, shuffle, deal, sortHand
│   ├── combinations.ts     # detectCombination, beats, generateCombinations, getHint
│   ├── ai.ts               # aiBidDecision, aiChoosePlay
│   ├── scoring.ts          # computeScore
│   └── gameEngine.ts       # Pure reducer: GameState + Action → GameState
├── state/
│   └── GameContext.tsx     # React Context + AI turn automation via useEffect
└── components/
    ├── CardSvg.tsx          # Single card (face-up or back) as SVG
    ├── CardHand.tsx         # Selectable overlapping hand for human player
    ├── PlayerAvatar.tsx     # SVG person avatar with optional crown
    ├── OpponentArea.tsx     # AI player zone (card backs + avatar)
    ├── LastPlayDisplay.tsx  # Center table: shows last played combo
    ├── BidPanel.tsx         # Bid buttons during bidding phase
    └── ActionBar.tsx        # 出牌 / 不出 / 提示 buttons
```

## Game Rules Summary

1. 54 cards dealt: 17 to each of 3 players, 3 as bottom cards
2. Players bid 1-3 (or pass 0) to become Landlord; highest bid wins
3. Landlord takes the 3 bottom cards (20 total) and plays first
4. Each turn: play a valid combo that beats the previous, or pass
5. After 2 consecutive passes, the last player to play leads freely
6. First player to empty hand wins
7. Each bomb/rocket doubles the score multiplier
8. **Landlord wins**: gets 2× score from each farmer; **Farmers win**: each gets 1× from landlord
