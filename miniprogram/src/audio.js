/**
 * Audio manager for WeChat Mini Game.
 * Uses wx.createInnerAudioContext() for all audio playback.
 * BGM and SFX are loaded from assets/sounds/.
 */

const BGM_VOLUME = 0.4;
const SFX_VOLUME = 0.85;
const POOL_SIZE  = 2;
const POOL_DEAL  = 4;

const SFX_FILES = {
  deal:          'assets/sounds/deal.mp3',
  card_select:   'assets/sounds/card_select.mp3',
  play_card:     'assets/sounds/play_card.mp3',
  pass:          'assets/sounds/pass.mp3',
  straight:      'assets/sounds/straight.mp3',
  pair_straight: 'assets/sounds/pair_straight.mp3',
  plane:         'assets/sounds/plane.mp3',
  bomb:          'assets/sounds/bomb.mp3',
  rocket:        'assets/sounds/rocket.mp3',
  win:           'assets/sounds/win.mp3',
  lose:          'assets/sounds/lose.mp3',
  bid:           'assets/sounds/bid.mp3',
  trick_win:     'assets/sounds/trick_win.mp3',
};

const BGM_FILES = {
  home: 'assets/sounds/bgm_home.mp3',
  game: 'assets/sounds/bgm_game.mp3',
};

// ── State ─────────────────────────────────────────────────────────────────────

const sfxPools = {};       // name → { ctxs: [], nextIdx: 0 }
const bgmCtxs  = {};       // type → InnerAudioContext
let currentBgm = null;
let enabled = true;

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Preload all audio contexts. Call once at loading screen.
 * @param {(pct: number) => void} onProgress
 */
export async function preloadAll(onProgress) {
  const sfxNames = Object.keys(SFX_FILES);
  const bgmNames = Object.keys(BGM_FILES);
  const total = sfxNames.length + bgmNames.length;
  let done = 0;

  onProgress(3);

  // Preload SFX pools
  for (const name of sfxNames) {
    const poolSize = name === 'deal' ? POOL_DEAL : POOL_SIZE;
    const pool = { ctxs: [], nextIdx: 0 };
    for (let i = 0; i < poolSize; i++) {
      const ctx = wx.createInnerAudioContext();
      ctx.src = SFX_FILES[name];
      ctx.volume = SFX_VOLUME;
      ctx.autoplay = false;
      pool.ctxs.push(ctx);
    }
    sfxPools[name] = pool;
    done++;
    onProgress(3 + Math.round((done / total) * 93));
  }

  // Preload BGM contexts
  for (const type of bgmNames) {
    const ctx = wx.createInnerAudioContext();
    ctx.src = BGM_FILES[type];
    ctx.volume = BGM_VOLUME;
    ctx.loop = true;
    ctx.autoplay = false;
    bgmCtxs[type] = ctx;
    done++;
    onProgress(3 + Math.round((done / total) * 93));
  }

  onProgress(100);
}

// ── SFX ───────────────────────────────────────────────────────────────────────

export function playSfx(name) {
  if (!enabled) return;
  const pool = sfxPools[name];
  if (!pool || pool.ctxs.length === 0) return;
  const ctx = pool.ctxs[pool.nextIdx % pool.ctxs.length];
  pool.nextIdx = (pool.nextIdx + 1) % pool.ctxs.length;
  ctx.stop();
  ctx.seek(0);
  ctx.play();
}

// ── BGM ───────────────────────────────────────────────────────────────────────

export function playBgm(type) {
  if (!enabled) return;
  if (currentBgm === type) return;
  if (currentBgm) {
    const old = bgmCtxs[currentBgm];
    if (old) { old.stop(); }
    currentBgm = null;
  }
  const ctx = bgmCtxs[type];
  if (!ctx) return;
  ctx.seek(0);
  ctx.play();
  currentBgm = type;
}

export function stopBgm() {
  if (!currentBgm) return;
  const ctx = bgmCtxs[currentBgm];
  if (ctx) { ctx.stop(); }
  currentBgm = null;
}

export function setEnabled(val) {
  enabled = val;
  if (!val) stopBgm();
}

export function isEnabled() {
  return enabled;
}
