/**
 * Generates 5 cartoon avatar PNGs using jimp-compact.
 * Size: 128x128
 * - player_you.png:    blue theme
 * - player_ai1.png:    orange theme
 * - player_ai2.png:    purple theme
 * - landlord_crown.png: red bg + crown shape
 * - farmer_hat.png:    green bg + hat shape
 */
const Jimp = require('../node_modules/jimp-compact');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'avatars');
const SIZE = 128;

// Helper: draw a filled circle
function drawCircle(img, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
          img.setPixelColor(color, x, y);
        }
      }
    }
  }
}

// Helper: draw a filled rect
function drawRect(img, x1, y1, x2, y2, color) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
        img.setPixelColor(color, x, y);
      }
    }
  }
}

// Helper: draw a ring (outlined circle)
function drawRing(img, cx, cy, r, thickness, color) {
  for (let y = cy - r - thickness; y <= cy + r + thickness; y++) {
    for (let x = cx - r - thickness; x <= cx + r + thickness; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= r && dist <= r + thickness) {
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
          img.setPixelColor(color, x, y);
        }
      }
    }
  }
}

async function makeAvatar(filename, bgColor, faceColor, accentColor, eyeColor, label) {
  const img = new Jimp(SIZE, SIZE, 0x00000000); // transparent

  // Circular background
  drawCircle(img, SIZE / 2, SIZE / 2, SIZE / 2 - 2, bgColor);

  // Outer ring
  drawRing(img, SIZE / 2, SIZE / 2, SIZE / 2 - 4, 3, accentColor);

  // Face (circle)
  const faceR = 28;
  const faceCY = 52;
  drawCircle(img, SIZE / 2, faceCY, faceR, faceColor);

  // Eyes
  const eyeR = 4;
  drawCircle(img, SIZE / 2 - 10, faceCY - 6, eyeR, eyeColor);
  drawCircle(img, SIZE / 2 + 10, faceCY - 6, eyeR, eyeColor);

  // Smile (simple arc approximation using horizontal line + curves)
  for (let dx = -10; dx <= 10; dx++) {
    const dy = Math.round((dx * dx) / 20);
    const px = SIZE / 2 + dx;
    const py = faceCY + 8 + dy;
    if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
      img.setPixelColor(eyeColor, px, py);
      img.setPixelColor(eyeColor, px, py + 1);
    }
  }

  // Body (rounded rect below face)
  drawRect(img, SIZE / 2 - 20, faceCY + faceR + 4, SIZE / 2 + 20, faceCY + faceR + 28, accentColor);

  // Load font for label
  try {
    const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    img.print(font, 0, SIZE - 22, { text: label, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER }, SIZE, 20);
  } catch (e) {
    // font load may fail, that's ok
  }

  const dest = path.join(OUT_DIR, filename);
  await img.writeAsync(dest);
  console.log(`Generated ${filename}`);
}

async function makeBadge(filename, bgColor, symbol) {
  const img = new Jimp(SIZE, SIZE, 0x00000000);

  // Circular background
  drawCircle(img, SIZE / 2, SIZE / 2, SIZE / 2 - 2, bgColor);

  if (symbol === 'crown') {
    // Simple crown shape: base + 3 points
    const baseY = SIZE / 2 + 14;
    const baseX1 = SIZE / 2 - 24;
    const baseX2 = SIZE / 2 + 24;
    // Base bar
    drawRect(img, baseX1, baseY, baseX2, baseY + 10, 0xf1c40fff);
    // Left spike
    for (let y = SIZE / 2 - 16; y <= baseY; y++) {
      const ratio = (y - (SIZE / 2 - 16)) / (baseY - (SIZE / 2 - 16));
      const hw = Math.round(ratio * 6);
      for (let x = baseX1; x <= baseX1 + hw * 2; x++) {
        if (Math.abs(x - baseX1 - hw) <= hw) img.setPixelColor(0xf1c40fff, x, y);
      }
    }
    // Center spike (tallest)
    for (let y = SIZE / 2 - 28; y <= baseY; y++) {
      const ratio = (y - (SIZE / 2 - 28)) / (baseY - (SIZE / 2 - 28));
      const hw = Math.round(ratio * 6);
      const cx = SIZE / 2;
      for (let x = cx - hw; x <= cx + hw; x++) {
        img.setPixelColor(0xf1c40fff, x, y);
      }
    }
    // Right spike
    for (let y = SIZE / 2 - 16; y <= baseY; y++) {
      const ratio = (y - (SIZE / 2 - 16)) / (baseY - (SIZE / 2 - 16));
      const hw = Math.round(ratio * 6);
      for (let x = baseX2 - hw * 2; x <= baseX2; x++) {
        if (Math.abs(x - baseX2 + hw) <= hw) img.setPixelColor(0xf1c40fff, x, y);
      }
    }
  } else if (symbol === 'hat') {
    // Simple straw hat: brim + dome
    const brimY = SIZE / 2 + 10;
    // Brim
    drawRect(img, SIZE / 2 - 28, brimY, SIZE / 2 + 28, brimY + 8, 0xd4a017ff);
    // Dome
    drawCircle(img, SIZE / 2, brimY - 10, 20, 0xe8c547ff);
    // Dome top cut flat
    drawRect(img, SIZE / 2 - 20, SIZE / 2 - 30, SIZE / 2 + 20, brimY - 10, 0xe8c547ff);
    // Hat band
    drawRect(img, SIZE / 2 - 20, brimY - 12, SIZE / 2 + 20, brimY - 6, 0x8b4513ff);
  }

  const dest = path.join(OUT_DIR, filename);
  await img.writeAsync(dest);
  console.log(`Generated ${filename}`);
}

async function main() {
  console.log('Generating avatars...');

  // Player avatars
  await makeAvatar('player_you.png',  0x1a4e8aff, 0xf5cba7ff, 0x3498dbff, 0x2c3e50ff, 'YOU');
  await makeAvatar('player_ai1.png',  0x8b4000ff, 0xf5cba7ff, 0xe67e22ff, 0x2c3e50ff, 'AI1');
  await makeAvatar('player_ai2.png',  0x4a1080ff, 0xf5cba7ff, 0x9b59b6ff, 0x2c3e50ff, 'AI2');

  // Role badges
  await makeBadge('landlord_crown.png', 0xc0392bff, 'crown');
  await makeBadge('farmer_hat.png',     0x27ae60ff, 'hat');

  console.log('Avatar generation complete!');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
