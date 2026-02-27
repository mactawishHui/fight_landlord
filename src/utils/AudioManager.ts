/**
 * Singleton audio manager.
 * BGM sounds are pre-created in bgmPool during preloadAll() so playBgm()
 * is instant with no async creation lag.
 * SFX use instance pools for overlapping concurrent playback.
 */
import { Audio } from 'expo-av';

// ── Static asset maps (Metro requires static literals) ─────────────────────

const SFX_SOURCES = {
  deal:          require('../../assets/sounds/deal.wav'),
  card_select:   require('../../assets/sounds/card_select.wav'),
  play_card:     require('../../assets/sounds/play_card.wav'),
  pass:          require('../../assets/sounds/pass.wav'),
  straight:      require('../../assets/sounds/straight.wav'),
  pair_straight: require('../../assets/sounds/pair_straight.wav'),
  plane:         require('../../assets/sounds/plane.wav'),
  bomb:          require('../../assets/sounds/bomb.wav'),
  rocket:        require('../../assets/sounds/rocket.wav'),
  win:           require('../../assets/sounds/win.wav'),
  lose:          require('../../assets/sounds/lose.wav'),
  bid:           require('../../assets/sounds/bid.wav'),
  trick_win:     require('../../assets/sounds/trick_win.wav'),
} as const;

const BGM_SOURCES = {
  home: require('../../assets/sounds/bgm_home.wav'),
  game: require('../../assets/sounds/bgm_game.wav'),
} as const;

export type SfxName = keyof typeof SFX_SOURCES;
export type BgmType = keyof typeof BGM_SOURCES;

// ── Pool sizes ─────────────────────────────────────────────────────────────
const POOL_SIZE      = 2;
const POOL_SIZE_DEAL = 4; // deal needs more instances for per-card animation

type SfxPool = { sounds: Audio.Sound[]; nextIdx: number };

// ── AudioManager singleton ────────────────────────────────────────────────

class AudioManagerClass {
  private sfxPools: Partial<Record<SfxName, SfxPool>> = {};
  /** Pre-created BGM Sound objects — reused on every play to avoid createAsync lag */
  private bgmPool: Partial<Record<BgmType, Audio.Sound>> = {};
  private currentBgm: BgmType | null = null;
  private enabled = true;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.initialized = true;
    } catch (e) {
      console.warn('[AudioManager] init failed:', e);
    }
  }

  /**
   * Preload all SFX and BGM sounds with progress reporting.
   * Call this once at app startup (in LoadingScreen) before showing any game UI.
   */
  async preloadAll(onProgress: (pct: number) => void): Promise<void> {
    await this.init();
    onProgress(3);

    const sfxNames = Object.keys(SFX_SOURCES) as SfxName[];
    const bgmNames = Object.keys(BGM_SOURCES) as BgmType[];
    const total = sfxNames.length + bgmNames.length;
    let done = 0;

    // ── Preload SFX ─────────────────────────────────────────────────────────
    for (const name of sfxNames) {
      const poolSize = name === 'deal' ? POOL_SIZE_DEAL : POOL_SIZE;
      const pool: SfxPool = { sounds: [], nextIdx: 0 };
      try {
        for (let i = 0; i < poolSize; i++) {
          const { sound } = await Audio.Sound.createAsync(
            SFX_SOURCES[name],
            { shouldPlay: false, volume: 0.85 },
          );
          pool.sounds.push(sound);
        }
        this.sfxPools[name] = pool;
      } catch (e) {
        console.warn(`[AudioManager] preload sfx ${name}:`, e);
      }
      done++;
      onProgress(3 + Math.round((done / total) * 93));
    }

    // ── Preload BGM (pre-create so playBgm is instant) ──────────────────────
    for (const type of bgmNames) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          BGM_SOURCES[type],
          { shouldPlay: false, isLooping: true, volume: 0.4 },
        );
        this.bgmPool[type] = sound;
      } catch (e) {
        console.warn(`[AudioManager] preload bgm ${type}:`, e);
      }
      done++;
      onProgress(3 + Math.round((done / total) * 93));
    }

    onProgress(100);
  }

  /** Legacy alias kept for any callers that haven't been updated. */
  async preload(): Promise<void> {
    return this.preloadAll(() => {});
  }

  async playSfx(name: SfxName): Promise<void> {
    if (!this.enabled) return;
    try {
      const pool = this.sfxPools[name];
      if (!pool || pool.sounds.length === 0) {
        // Fallback: create on demand
        const { sound } = await Audio.Sound.createAsync(
          SFX_SOURCES[name],
          { shouldPlay: true, volume: 0.85 },
        );
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
        });
        return;
      }
      const sound = pool.sounds[pool.nextIdx % pool.sounds.length];
      pool.nextIdx = (pool.nextIdx + 1) % pool.sounds.length;
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch (_) { /* non-fatal */ }
  }

  /**
   * Play a BGM track. Uses pre-created Sound objects from bgmPool for instant
   * playback (no async creation delay).
   */
  async playBgm(type: BgmType): Promise<void> {
    if (!this.enabled) return;
    if (this.currentBgm === type) return; // already playing this track

    // Stop currently-playing BGM (but keep the Sound object in the pool)
    if (this.currentBgm) {
      const cur = this.bgmPool[this.currentBgm];
      if (cur) {
        try { await cur.stopAsync(); await cur.setPositionAsync(0); } catch (_) {}
      }
      this.currentBgm = null;
    }

    // Get or create the Sound for the requested track
    let sound = this.bgmPool[type];
    if (!sound) {
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          BGM_SOURCES[type],
          { shouldPlay: false, isLooping: true, volume: 0.4 },
        );
        this.bgmPool[type] = s;
        sound = s;
      } catch (e) {
        console.warn('[AudioManager] playBgm createAsync failed:', e);
        return;
      }
    }

    try {
      await sound.setPositionAsync(0);
      await sound.setVolumeAsync(0.4);
      await sound.setIsLoopingAsync(true);
      await sound.playAsync();
      this.currentBgm = type;
    } catch (e) {
      console.warn('[AudioManager] playBgm playAsync failed:', e);
    }
  }

  async stopBgm(): Promise<void> {
    if (!this.currentBgm) return;
    const sound = this.bgmPool[this.currentBgm];
    if (sound) {
      try { await sound.stopAsync(); await sound.setPositionAsync(0); } catch (_) {}
    }
    this.currentBgm = null;
  }

  setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) this.stopBgm();
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const AudioManager = new AudioManagerClass();
