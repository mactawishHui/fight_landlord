/**
 * Generates background music WAV files using pentatonic scale synthesis.
 * - bgm_home.wav: light, slow-paced Chinese pentatonic melody (~30s loop)
 * - bgm_game.wav: faster, more intense pentatonic melody (~20s loop)
 *
 * Uses pure Node.js Buffer — no ffmpeg required.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');
const SAMPLE_RATE = 22050;
const CHANNELS = 1;
const BITS = 16;

function writeWavHeader(buf, dataLength) {
  const byteRate = SAMPLE_RATE * CHANNELS * BITS / 8;
  const blockAlign = CHANNELS * BITS / 8;
  let o = 0;
  buf.write('RIFF', o); o += 4;
  buf.writeUInt32LE(36 + dataLength, o); o += 4;
  buf.write('WAVE', o); o += 4;
  buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(16, o); o += 4;
  buf.writeUInt16LE(1, o); o += 2;
  buf.writeUInt16LE(CHANNELS, o); o += 2;
  buf.writeUInt32LE(SAMPLE_RATE, o); o += 4;
  buf.writeUInt32LE(byteRate, o); o += 4;
  buf.writeUInt16LE(blockAlign, o); o += 2;
  buf.writeUInt16LE(BITS, o); o += 2;
  buf.write('data', o); o += 4;
  buf.writeUInt32LE(dataLength, o);
}

// Chinese pentatonic scale frequencies (C4, D4, E4, G4, A4, C5, D5, E5, G5, A5)
const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.26, 784.00, 880.00];

// Instrument: plucked string (Karplus-Strong-inspired simple version)
function synthNote(freq, duration, amp = 0.5) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  const period = Math.round(SAMPLE_RATE / freq);
  const buf = new Float32Array(period);

  // Initialize with random noise
  for (let i = 0; i < period; i++) buf[i] = (Math.random() * 2 - 1) * amp;

  // Simple low-pass averaging (Karplus-Strong)
  let bufIdx = 0;
  for (let i = 0; i < n; i++) {
    const next = (bufIdx + 1) % period;
    const val = (buf[bufIdx] + buf[next]) * 0.496; // decay factor
    buf[bufIdx] = val;
    // Amplitude envelope: attack + exponential decay
    const attack = Math.min(1, i / (SAMPLE_RATE * 0.005));
    samples[i] = val * attack;
    bufIdx = (bufIdx + 1) % period;
  }
  return samples;
}

// Pads: sustained low notes for atmosphere
function synthPad(freq, duration, amp = 0.15) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(1, i / (SAMPLE_RATE * 0.3)) * Math.min(1, (n - i) / (SAMPLE_RATE * 0.5));
    samples[i] = (
      Math.sin(2 * Math.PI * freq * t) * 0.5 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.3 +
      Math.sin(2 * Math.PI * freq * 3 * t) * 0.15
    ) * amp * env;
  }
  return samples;
}

// Mix a list of {samples, startSample} into a single buffer
function mixTracks(tracks, totalSamples) {
  const out = new Float32Array(totalSamples);
  for (const { samples, startSample } of tracks) {
    for (let i = 0; i < samples.length; i++) {
      const idx = startSample + i;
      if (idx < totalSamples) out[idx] += samples[i];
    }
  }
  // Soft clip
  for (let i = 0; i < totalSamples; i++) {
    out[i] = Math.tanh(out[i]);
  }
  return out;
}

function floatToWav(samples) {
  const dataLength = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLength);
  writeWavHeader(buf, dataLength);
  for (let i = 0; i < samples.length; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }
  return buf;
}

// ── Home BGM — calm, slow pentatonic melody ────────────────────────────────
function generateHomeBGM() {
  console.log('Generating bgm_home.wav...');
  // 30 second loop: slow melody at ~80 BPM, quarter note = 0.75s
  const BPM = 80;
  const beat = 60 / BPM;
  const totalDuration = 30;
  const totalSamples = Math.floor(SAMPLE_RATE * totalDuration);

  // Melody pattern (pentatonic scale indices, duration in beats)
  const melody = [
    [4, 1], [5, 1], [7, 0.5], [6, 0.5], [5, 2],
    [3, 1], [4, 1], [5, 0.5], [4, 0.5], [3, 2],
    [2, 1], [3, 1], [4, 0.5], [5, 0.5], [4, 2],
    [0, 1], [2, 1], [3, 0.5], [2, 0.5], [0, 2],
    [5, 1], [7, 1], [8, 0.5], [7, 0.5], [5, 2],
    [4, 1], [5, 1], [6, 0.5], [5, 0.5], [4, 2],
    [3, 1.5], [4, 0.5], [5, 1], [3, 1], [2, 2],
    [0, 2], [2, 1], [3, 1], [0, 4],
  ];

  // Bass pattern (lower octave, sustained)
  const bass = [
    [0, 4], [3, 4], [2, 4], [0, 4],
    [3, 4], [4, 4], [3, 4], [0, 4],
  ];

  const tracks = [];
  let melodySample = 0;
  for (const [idx, dur] of melody) {
    const freq = PENTA[idx];
    const duration = dur * beat;
    const noteSamples = synthNote(freq, duration, 0.45);
    tracks.push({ samples: noteSamples, startSample: melodySample % totalSamples });
    melodySample += Math.floor(duration * SAMPLE_RATE);
  }

  let bassSample = 0;
  for (let rep = 0; rep < 4; rep++) {
    for (const [idx, dur] of bass) {
      const freq = PENTA[idx] / 2; // lower octave
      const duration = dur * beat;
      const padSamples = synthPad(freq, duration, 0.12);
      tracks.push({ samples: padSamples, startSample: bassSample % totalSamples });
      bassSample += Math.floor(duration * SAMPLE_RATE);
    }
  }

  const mixed = mixTracks(tracks, totalSamples);
  return floatToWav(mixed);
}

// ── Game BGM — faster, more intense pentatonic ─────────────────────────────
function generateGameBGM() {
  console.log('Generating bgm_game.wav...');
  const BPM = 130;
  const beat = 60 / BPM;
  const totalDuration = 24;
  const totalSamples = Math.floor(SAMPLE_RATE * totalDuration);

  // More energetic melody
  const melody = [
    [5, 0.5], [7, 0.5], [8, 0.5], [7, 0.5], [5, 1],
    [4, 0.5], [5, 0.5], [7, 0.5], [5, 0.5], [4, 1],
    [3, 0.5], [4, 0.5], [5, 0.5], [7, 0.5], [8, 1],
    [9, 0.5], [8, 0.5], [7, 0.5], [5, 0.5], [4, 1],
    [5, 0.5], [7, 0.5], [8, 1], [9, 0.5], [8, 0.5],
    [7, 0.5], [5, 0.5], [4, 1], [3, 0.5], [5, 0.5],
    [4, 0.5], [3, 0.5], [2, 0.5], [0, 0.5], [2, 1],
    [3, 0.5], [4, 0.5], [5, 1], [4, 0.5], [3, 0.5],
    [5, 0.5], [7, 0.5], [8, 0.5], [9, 0.5], [8, 2],
    [7, 0.5], [5, 0.5], [4, 0.5], [3, 0.5], [0, 2],
  ];

  // Rhythm bass (staccato quarter notes)
  const bassPattern = [0, 3, 5, 3];

  const tracks = [];
  let melodySample = 0;
  for (const [idx, dur] of melody) {
    const freq = PENTA[idx];
    const duration = dur * beat;
    const noteSamples = synthNote(freq, duration * 0.85, 0.5); // slightly detached
    tracks.push({ samples: noteSamples, startSample: melodySample % totalSamples });
    melodySample += Math.floor(duration * SAMPLE_RATE);
  }

  // Repeat bass pattern
  let bassPos = 0;
  const bassRepeatDuration = beat * 0.5;
  while (bassPos < totalSamples) {
    for (const idx of bassPattern) {
      const freq = PENTA[idx] / 2;
      const noteSamples = synthNote(freq, bassRepeatDuration * 0.8, 0.25);
      tracks.push({ samples: noteSamples, startSample: bassPos % totalSamples });
      bassPos += Math.floor(bassRepeatDuration * SAMPLE_RATE);
      if (bassPos >= totalSamples) break;
    }
  }

  const mixed = mixTracks(tracks, totalSamples);
  return floatToWav(mixed);
}

function main() {
  fs.writeFileSync(path.join(OUT_DIR, 'bgm_home.wav'), generateHomeBGM());
  console.log('  bgm_home.wav written');

  fs.writeFileSync(path.join(OUT_DIR, 'bgm_game.wav'), generateGameBGM());
  console.log('  bgm_game.wav written');

  console.log('BGM generation complete!');
}

main();
