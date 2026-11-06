/**
 * Automated test suite for QR Code Right-Click Scanner
 * Verifies encoding and decoding across multiple data types:
 * - Web URLs
 * - UTF-8 / Chinese text
 * - WiFi configuration strings
 * - Long text payloads
 */

const assert = require('assert');
const jsQR = require('../lib/jsQR.js');
const qrcode = require('../lib/qrcode.js');

function createQrImageData(text, errorCorrection = 'M', cellSize = 6, margin = 16) {
  const qr = qrcode(0, errorCorrection);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const size = count * cellSize + margin * 2;
  const data = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let isDark = false;
      if (x >= margin && x < size - margin && y >= margin && y < size - margin) {
        const col = Math.floor((x - margin) / cellSize);
        const row = Math.floor((y - margin) / cellSize);
        if (qr.isDark(row, col)) {
          isDark = true;
        }
      }
      const val = isDark ? 0 : 255;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  return { data, width: size, height: size };
}

function runTests() {
  console.log('🧪 Starting automated test suite for QR scanner...\n');

  const testCases = [
    {
      name: 'Standard HTTPS URL',
      payload: 'https://github.com/my-user/qrcode-rightclick'
    },
    {
      name: 'Chinese / UTF-8 Text',
      payload: '右键扫描二维码 - 浏览器扩展测试通过！'
    },
    {
      name: 'WiFi Configuration Payload',
      payload: 'WIFI:S:MyHomeWiFi;T:WPA;P:SecretPass123;;'
    },
    {
      name: 'JSON / Structured Text',
      payload: JSON.stringify({ version: '1.0.0', type: 'extension', status: 'ok' })
    },
    {
      name: 'Long Payload',
      payload: 'https://example.com/search?q=' + encodeURIComponent('Antigravity Browser Extension Test Suite') + '&timestamp=' + Date.now()
    }
  ];

  let passed = 0;

  for (const tc of testCases) {
    try {
      const { data, width, height } = createQrImageData(tc.payload);
      const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });

      assert(result, `Failed to decode QR code for test case: "${tc.name}"`);
      assert.strictEqual(
        result.data,
        tc.payload,
        `Decoded payload mismatch! Expected "${tc.payload}", got "${result.data}"`
      );

      console.log(`✅ Passed: [${tc.name}] -> "${result.data.substring(0, 50)}${result.data.length > 50 ? '...' : ''}"`);
      passed++;
    } catch (err) {
      console.error(`❌ Failed: [${tc.name}]`);
      console.error(err);
      process.exit(1);
    }
  }

  console.log(`\n🎉 All ${passed}/${testCases.length} tests passed successfully!`);
}

runTests();
