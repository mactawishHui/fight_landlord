import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GameProvider, useGame } from './src/state/GameContext';
import { LoadingScreen } from './src/screens/LoadingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';

type Screen = 'loading' | 'home' | 'game';

/** Catches JS render errors in release mode so the app shows a message instead of crashing. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, error: String(err) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>App Error</Text>
          <Text style={eb.msg}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title:     { color: '#e74c3c', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  msg:       { color: '#fff', fontSize: 13, textAlign: 'center' },
});

function AppContent() {
  const [screen, setScreen] = useState<Screen>('loading');
  const { startGame } = useGame();

  const handleStart = () => {
    startGame();
    setScreen('game');
  };

  const handleHome = () => setScreen('home');

  if (screen === 'loading') {
    return <LoadingScreen onLoaded={() => setScreen('home')} />;
  }
  if (screen === 'game') {
    return <GameScreen onHome={handleHome} />;
  }
  return <HomeScreen onStart={handleStart} />;
}

export default function App() {
  // All audio preloading is now done inside LoadingScreen via AudioManager.preloadAll()
  return (
    <ErrorBoundary>
      <GameProvider>
        <StatusBar style="light" />
        <AppContent />
      </GameProvider>
    </ErrorBoundary>
  );
}
