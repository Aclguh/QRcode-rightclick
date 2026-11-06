/**
 * Cross-platform packaging script for QR Code Right-Click Scanner
 * Packages extension files into a zip release archive for GitHub Releases / Chrome Web Store.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipFile = path.join(distDir, 'qrcode-scanner-v1.0.0.zip');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

const targetItems = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'icons',
  'lib',
  'popup',
  '_locales'
];

try {
  // Use PowerShell on Windows or zip on Unix
  if (process.platform === 'win32') {
    const fileList = targetItems.join(', ');
    execSync(`powershell -Command "Compress-Archive -Path ${fileList} -DestinationPath '${zipFile}' -Force"`, {
      cwd: rootDir,
      stdio: 'inherit'
    });
  } else {
    execSync(`zip -r "${zipFile}" ${targetItems.join(' ')}`, {
      cwd: rootDir,
      stdio: 'inherit'
    });
  }

  const stat = fs.statSync(zipFile);
  console.log(`📦 Successfully packaged extension:`);
  console.log(`   Path: ${zipFile}`);
  console.log(`   Size: ${(stat.size / 1024).toFixed(1)} KB`);
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
}
