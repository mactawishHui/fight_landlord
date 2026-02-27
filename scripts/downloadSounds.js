/**
 * Downloads sound effects for the game, with WAV generation fallback.
 * Target: assets/sounds/
 *
 * Sources tried (in order):
 * 1. freesound.org public domain sounds (various CC0)
 * 2. Generated WAV tones as fallback
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

// ── WAV generation fallback ───────────────────────────────────────────────────

function writeWavHeader(buf, dataLength, sampleRate, numChannels, bitsPerSample) {
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  let offset = 0;
  // RIFF chunk
  buf.write('RIFF', offset); offset += 4;
  buf.writeUInt32LE(36 + dataLength, offset); offset += 4;
  buf.write('WAVE', offset); offset += 4;
  // fmt chunk
  buf.write('fmt ', offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4;           // chunk size
  buf.writeUInt16LE(1, offset); offset += 2;            // PCM = 1
  buf.writeUInt16LE(numChannels, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(byteRate, offset); offset += 4;
  buf.writeUInt16LE(blockAlign, offset); offset += 2;
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;
  // data chunk
  buf.write('data', offset); offset += 4;
  buf.writeUInt32LE(dataLength, offset);
}

/**
 * Generate a simple synthesized WAV tone.
 * @param {number[]} freqs - array of {freq, duration} segments
 * @param {number} totalDuration - seconds
 * @param {number} sampleRate
 */
function generateTone(segments, totalDuration, sampleRate = 22050) {
  const numSamples = Math.floor(sampleRate * totalDuration);
  const dataLength = numSamples * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataLength);
  writeWavHeader(buf, dataLength, sampleRate, 1, 16);

  let offset = 44;
  let sampleIdx = 0;

  for (const seg of segments) {
    const segSamples = Math.floor(sampleRate * seg.duration);
    const freq = seg.freq;
    const amp = (seg.amp ?? 0.5) * 32767;
    const fadeOut = seg.fadeOut ?? true;

    for (let i = 0; i < segSamples && sampleIdx < numSamples; i++, sampleIdx++) {
      const t = i / sampleRate;
      let envelope = 1.0;
      if (fadeOut) {
        envelope = Math.max(0, 1 - i / segSamples);
      }
      // Attack
      if (i < sampleRate * 0.01) {
        envelope *= i / (sampleRate * 0.01);
      }

      let sample = 0;
      if (freq > 0) {
        sample = Math.sin(2 * Math.PI * freq * t) * amp * envelope;
        // Add slight harmonic
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * amp * 0.3 * envelope;
      }
      // Clamp
      sample = Math.max(-32767, Math.min(32767, Math.round(sample)));
      buf.writeInt16LE(sample, offset);
      offset += 2;
    }
  }

  return buf;
}

// Sound definitions: each is an array of tone segments
const SOUND_DEFS = {
  'deal.wav': [
    { freq: 800, duration: 0.08, amp: 0.6 },
    { freq: 600, duration: 0.06, amp: 0.4 },
  ],
  'play_card.wav': [
    { freq: 500, duration: 0.1, amp: 0.5 },
    { freq: 700, duration: 0.05, amp: 0.3 },
  ],
  'pass.wav': [
    { freq: 300, duration: 0.15, amp: 0.4, fadeOut: true },
  ],
  'straight.wav': [
    { freq: 400, duration: 0.06, amp: 0.5 },
    { freq: 500, duration: 0.06, amp: 0.5 },
    { freq: 600, duration: 0.06, amp: 0.5 },
    { freq: 700, duration: 0.08, amp: 0.6 },
  ],
  'pair_straight.wav': [
    { freq: 450, duration: 0.07, amp: 0.5 },
    { freq: 550, duration: 0.07, amp: 0.5 },
    { freq: 650, duration: 0.07, amp: 0.5 },
    { freq: 750, duration: 0.10, amp: 0.6 },
  ],
  'plane.wav': [
    { freq: 300, duration: 0.05, amp: 0.5 },
    { freq: 400, duration: 0.05, amp: 0.55 },
    { freq: 500, duration: 0.05, amp: 0.6 },
    { freq: 600, duration: 0.05, amp: 0.65 },
    { freq: 700, duration: 0.08, amp: 0.7 },
    { freq: 800, duration: 0.12, amp: 0.7 },
  ],
  'bomb.wav': [
    { freq: 200, duration: 0.05, amp: 0.8, fadeOut: false },
    { freq: 150, duration: 0.08, amp: 0.9, fadeOut: false },
    { freq: 100, duration: 0.15, amp: 1.0, fadeOut: true },
    { freq: 80,  duration: 0.20, amp: 0.6, fadeOut: true },
  ],
  'rocket.wav': [
    { freq: 180, duration: 0.04, amp: 0.9, fadeOut: false },
    { freq: 140, duration: 0.06, amp: 1.0, fadeOut: false },
    { freq: 100, duration: 0.08, amp: 1.0, fadeOut: false },
    { freq: 80,  duration: 0.10, amp: 1.0, fadeOut: false },
    { freq: 60,  duration: 0.20, amp: 0.8, fadeOut: true },
    { freq: 900, duration: 0.15, amp: 0.7, fadeOut: true },
  ],
  'win.wav': [
    { freq: 523, duration: 0.12, amp: 0.6 },
    { freq: 659, duration: 0.12, amp: 0.6 },
    { freq: 784, duration: 0.12, amp: 0.65 },
    { freq: 1047, duration: 0.25, amp: 0.7 },
  ],
  'lose.wav': [
    { freq: 523, duration: 0.15, amp: 0.5 },
    { freq: 440, duration: 0.15, amp: 0.5 },
    { freq: 349, duration: 0.25, amp: 0.55 },
  ],
  'bid.wav': [
    { freq: 880, duration: 0.08, amp: 0.5 },
    { freq: 1100, duration: 0.06, amp: 0.4 },
  ],
  'trick_win.wav': [
    { freq: 600, duration: 0.08, amp: 0.55 },
    { freq: 800, duration: 0.08, amp: 0.6 },
    { freq: 1000, duration: 0.12, amp: 0.65 },
  ],
};

function generateAllSounds() {
  console.log('Generating synthesized WAV sound effects...');
  let count = 0;
  for (const [filename, segments] of Object.entries(SOUND_DEFS)) {
    const dest = path.join(OUT_DIR, filename);
    const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
    const buf = generateTone(segments, totalDuration + 0.1);
    fs.writeFileSync(dest, buf);
    console.log(`  Generated ${filename} (${totalDuration.toFixed(2)}s)`);
    count++;
  }
  console.log(`Generated ${count} WAV files.`);
}

generateAllSounds();
