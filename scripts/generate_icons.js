const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, renderFn) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const scanlines = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = renderFn(x, y, width, height);
      const offset = 1 + x * 4;
      row[offset] = r;
      row[offset + 1] = g;
      row[offset + 2] = b;
      row[offset + 3] = a;
    }
    scanlines.push(row);
  }
  const rawData = Buffer.concat(scanlines);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

function renderIcon(x, y, size) {
  const nx = x / size;
  const ny = y / size;

  // Rounded rectangle background (radius ~ 22%)
  const r = 0.22;
  const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - r));
  const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - r));
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > r) {
    return [0, 0, 0, 0]; // Transparent outside rounded rect
  }

  // Antialiasing on edge
  const edgeAlpha = Math.min(1, Math.max(0, (r - dist) * size * 1.5));

  // Gradient background: Deep Royal Blue to Indigo
  // Top: #2563EB (37, 99, 235), Bottom: #1E1B4B (30, 27, 75)
  const gradT = ny;
  let bgR = Math.round(37 * (1 - gradT) + 15 * gradT);
  let bgG = Math.round(99 * (1 - gradT) + 23 * gradT);
  let bgB = Math.round(235 * (1 - gradT) + 62 * gradT);

  // Border outline
  if (dist > r - 0.04) {
    bgR = Math.min(255, bgR + 40);
    bgG = Math.min(255, bgG + 60);
    bgB = Math.min(255, bgB + 80);
  }

  // QR Code layout grid: normalize inside [0.18, 0.82]
  const qLeft = 0.18;
  const qRight = 0.82;
  const qTop = 0.18;
  const qBottom = 0.82;

  let qrPixel = false;
  let finderPattern = false;

  if (nx >= qLeft && nx <= qRight && ny >= qTop && ny <= qBottom) {
    const qx = (nx - qLeft) / (qRight - qLeft);
    const qy = (ny - qTop) / (qBottom - qTop);

    // 15x15 logical grid
    const gridDim = 15;
    const gx = Math.floor(qx * gridDim);
    const gy = Math.floor(qy * gridDim);

    // Finder patterns: 5x5 in top-left (0..4, 0..4), top-right (10..14, 0..4), bottom-left (0..4, 10..14)
    const isTL = (gx <= 4 && gy <= 4);
    const isTR = (gx >= 10 && gy <= 4);
    const isBL = (gx <= 4 && gy >= 10);

    if (isTL || isTR || isBL) {
      finderPattern = true;
      const lx = isTR ? (gx - 10) : gx;
      const ly = isBL ? (gy - 10) : gy;
      // Finder ring: outer 5x5 border, hollow 3x3, inner 1x1 dot at (2,2)
      if (lx === 0 || lx === 4 || ly === 0 || ly === 4) {
        qrPixel = true;
      } else if (lx === 2 && ly === 2) {
        qrPixel = true;
      }
    } else {
      // Some mock data modules for attractive QR look
      const modules = [
        [6, 1], [8, 1],
        [6, 3], [7, 3],
        [6, 5], [7, 5], [9, 5], [11, 5],
        [1, 6], [3, 6], [5, 6], [7, 6], [9, 6], [13, 6],
        [6, 7], [8, 7], [10, 7],
        [6, 9], [9, 9], [11, 9], [13, 9],
        [6, 11], [7, 11], [10, 11], [12, 11],
        [6, 13], [8, 13], [11, 13], [13, 13]
      ];
      for (const [mx, my] of modules) {
        if (gx === mx && gy === my) {
          qrPixel = true;
          break;
        }
      }
    }
  }

  // Laser scanner beam across horizontal center
  const beamY = 0.52;
  const beamDist = Math.abs(ny - beamY);
  const isBeam = beamDist < 0.05;

  let rCol = bgR;
  let gCol = bgG;
  let bCol = bgB;

  if (qrPixel) {
    if (finderPattern) {
      // Crisp white/cyan finder
      rCol = 255;
      gCol = 255;
      bCol = 255;
    } else {
      // Soft cyan-white data modules
      rCol = 224;
      gCol = 242;
      bCol = 254;
    }
  }

  // Overlay neon cyan laser beam
  if (isBeam) {
    const intensity = 1 - (beamDist / 0.05);
    rCol = Math.round(rCol * (1 - intensity * 0.7) + 6 * intensity * 0.7);
    gCol = Math.round(gCol * (1 - intensity * 0.8) + 240 * intensity * 0.8);
    bCol = Math.round(bCol * (1 - intensity * 0.9) + 255 * intensity * 0.9);
  }

  return [rCol, gCol, bCol, Math.round(255 * edgeAlpha)];
}

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

for (const size of sizes) {
  const pngData = createPng(size, size, (x, y, w, h) => renderIcon(x, y, size));
  const target = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(target, pngData);
  console.log(`Generated: icon${size}.png (${pngData.length} bytes)`);
}
