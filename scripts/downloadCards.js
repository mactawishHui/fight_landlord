/**
 * Downloads 52 card images from deckofcardsapi.com + card back.
 * File naming: S3.png, HA.png, H0.png (10), BJ.png, RJ.png
 *
 * API ranks: A, 2, 3, 4, 5, 6, 7, 8, 9, 0 (=10), J, Q, K
 * API suits: S, H, D, C
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'cards');

const SUITS = ['S', 'H', 'D', 'C'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'J', 'Q', 'K'];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  SKIP  ${path.basename(dest)} (exists)`);
      resolve();
      return;
    }
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Downloading card images to', OUT_DIR);

  // Download all 52 cards
  // API URL format: {RANK}{SUIT}.png  (e.g., AS.png, 2H.png, 0D.png for 10)
  // We store files as {SUIT}{RANK}.png to match our Card.id format
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const filename = `${suit}${rank}.png`;           // e.g., SA.png (our naming)
      const apiName = `${rank}${suit}.png`;             // e.g., AS.png (API naming)
      const url = `https://deckofcardsapi.com/static/img/${apiName}`;
      const dest = path.join(OUT_DIR, filename);
      try {
        process.stdout.write(`  DL    ${filename}...`);
        await downloadFile(url, dest);
        console.log(' OK');
      } catch (e) {
        console.log(` FAIL: ${e.message}`);
      }
      await sleep(50); // be polite to API
    }
  }

  // Download card back
  const backDest = path.join(OUT_DIR, 'back.png');
  console.log('Downloading card back...');
  try {
    await downloadFile('https://deckofcardsapi.com/static/img/back.png', backDest);
    console.log('  card back OK');
  } catch (e) {
    console.log(`  card back FAIL: ${e.message}`);
  }

  console.log('\nDone! Check assets/cards/ for results.');

  // List what we got
  const files = fs.readdirSync(OUT_DIR);
  console.log(`Downloaded ${files.length} files.`);
}

main().catch(console.error);
