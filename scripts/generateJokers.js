/**
 * Generates BJ.png (Black Joker) and RJ.png (Red Joker) as pure PNG.
 * Uses Node.js zlib for deflate — no external deps needed.
 * Size: 226x314 (standard card 2:3 ratio)
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'cards');
const W = 226;
const H = 314;

// ── Minimal PNG encoder ────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xffffffff;
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  const crcData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(crcData));
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(pixels, width, height) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw image data (filter byte 0 = None per row)
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      row[1 + x * 3] = pixels[idx];
      row[1 + x * 3 + 1] = pixels[idx + 1];
      row[1 + x * 3 + 2] = pixels[idx + 2];
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData, { level: 6 });

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 5×7 bitmap font (subset: A–Z, 0–9, space) ─────────────────────────────
// Each letter: 5 columns × 7 rows, stored as 7-element array of 5-bit masks
const FONT5x7 = {
  'A': [0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'B': [0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
  'C': [0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110],
  'D': [0b11100,0b10010,0b10001,0b10001,0b10001,0b10010,0b11100],
  'E': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  'F': [0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
  'G': [0b01111,0b10000,0b10000,0b10111,0b10001,0b10001,0b01111],
  'H': [0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  'I': [0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
  'J': [0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
  'K': [0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  'L': [0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  'M': [0b10001,0b11011,0b10101,0b10001,0b10001,0b10001,0b10001],
  'N': [0b10001,0b11001,0b10101,0b10011,0b10001,0b10001,0b10001],
  'O': [0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'P': [0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  'Q': [0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
  'R': [0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  'S': [0b01111,0b10000,0b10000,0b01110,0b00001,0b00001,0b11110],
  'T': [0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  'U': [0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  'V': [0b10001,0b10001,0b10001,0b10001,0b01010,0b01010,0b00100],
  'W': [0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001],
  'X': [0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
  'Y': [0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
  'Z': [0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
  '0': [0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
  '1': [0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
  '2': [0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111],
  '3': [0b11111,0b00010,0b00100,0b00110,0b00001,0b10001,0b01110],
  '4': [0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
  '5': [0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110],
  '6': [0b00110,0b01000,0b10000,0b11110,0b10001,0b10001,0b01110],
  '7': [0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
  '8': [0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
  '9': [0b01110,0b10001,0b10001,0b01111,0b00001,0b00010,0b01100],
  ' ': [0,0,0,0,0,0,0],
};

function drawText(pixels, text, x, y, scale, r, g, b) {
  const charW = 5 * scale + scale; // with 1-pixel gap scaled
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT5x7[ch] || FONT5x7[' '];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row] & (1 << (4 - col))) {
          // Draw scale×scale block
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const px = cx + col * scale + dx;
              const py = y + row * scale + dy;
              if (px >= 0 && px < W && py >= 0 && py < H) {
                const idx = (py * W + px) * 3;
                pixels[idx] = r;
                pixels[idx + 1] = g;
                pixels[idx + 2] = b;
              }
            }
          }
        }
      }
    }
    cx += charW;
  }
  return cx;
}

// ── Draw helpers ──────────────────────────────────────────────────────────

function fill(pixels, r, g, b) {
  for (let i = 0; i < W * H * 3; i += 3) {
    pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b;
  }
}

function fillRect(pixels, x1, y1, x2, y2, r, g, b) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) {
        const idx = (y * W + x) * 3;
        pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b;
      }
    }
  }
}

function textWidth(text, scale) {
  return text.length * (5 * scale + scale);
}

function makeJoker(bgR, bgG, bgB, label, subLabel) {
  const pixels = new Uint8Array(W * H * 3);

  // White card background
  fill(pixels, 255, 255, 255);
  // Colored inner area
  fillRect(pixels, 4, 4, W - 5, H - 5, bgR, bgG, bgB);
  // Inner border
  for (let x = 6; x < W - 6; x++) {
    const rowTop = 6, rowBot = H - 7;
    let idx = (rowTop * W + x) * 3; pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255;
    idx = (rowBot * W + x) * 3;     pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255;
  }
  for (let y = 6; y < H - 6; y++) {
    const colLeft = 6, colRight = W - 7;
    let idx = (y * W + colLeft) * 3;  pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255;
    idx = (y * W + colRight) * 3;     pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255;
  }

  const scale = 4;
  const charW = 5 * scale + scale;

  // Center main label
  const mainW = textWidth(label, scale);
  const mainX = Math.floor((W - mainW) / 2);
  const mainY = Math.floor(H / 2) - 7 * scale - scale * 2;
  drawText(pixels, label, mainX, mainY, scale, 255, 255, 255);

  // Center sub label
  const subW = textWidth(subLabel, scale);
  const subX = Math.floor((W - subW) / 2);
  const subY = Math.floor(H / 2) + scale * 2;
  drawText(pixels, subLabel, subX, subY, scale, 255, 255, 255);

  // Corner labels (small scale 2)
  const scale2 = 2;
  drawText(pixels, label[0] + label[1], 8, 10, scale2, 255, 255, 255);
  // Bottom-right corner (rotated — just repeat label)
  const brLabel = label[0] + label[1];
  const brW = textWidth(brLabel, scale2);
  drawText(pixels, brLabel, W - 8 - brW, H - 10 - 7 * scale2, scale2, 255, 255, 255);

  return pixels;
}

function main() {
  console.log('Generating joker cards...');

  // BJ = Black Joker: dark navy background
  const bjPixels = makeJoker(26, 26, 26, 'SML', 'JKR');
  fs.writeFileSync(path.join(OUT_DIR, 'BJ.png'), encodePNG(bjPixels, W, H));
  console.log('Generated BJ.png');

  // RJ = Red Joker: red background
  const rjPixels = makeJoker(204, 0, 0, 'BIG', 'JKR');
  fs.writeFileSync(path.join(OUT_DIR, 'RJ.png'), encodePNG(rjPixels, W, H));
  console.log('Generated RJ.png');

  console.log('Joker generation complete!');
}

main();
