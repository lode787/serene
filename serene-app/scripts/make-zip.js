const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const pkg = require('../package.json');

const root = path.join(__dirname, '..');
const version = pkg.version;
const dist = path.join(root, 'dist');
const releaseRoot = path.join(root, 'release');
const setupName = 'SereneSetup.exe';
const setupPath = path.join(dist, setupName);
const bundleName = `Serene-Windows-v${version}`;
const zipPath = path.join(releaseRoot, `${bundleName}.zip`);
const latestZipPath = path.join(releaseRoot, 'Serene-Windows.zip');

if (!fs.existsSync(setupPath)) {
  // electron-builder sometimes names with version; fall back to first SereneSetup*.exe
  const candidates = fs.existsSync(dist)
    ? fs.readdirSync(dist).filter((n) => /^SereneSetup.*\.exe$/i.test(n) && !/unblock/i.test(n))
    : [];
  if (!candidates.length) {
    console.error(`Missing installer at:\n  ${setupPath}\nRun "npm run package" first.`);
    process.exit(1);
  }
  const found = path.join(dist, candidates[0]);
  console.log('Using installer:', found);
  fs.copyFileSync(found, setupPath);
}

fs.rmSync(releaseRoot, { recursive: true, force: true });
fs.mkdirSync(releaseRoot, { recursive: true });

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const ps = `
$ErrorActionPreference = 'Stop'
Compress-Archive -Path '${setupPath.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force
`;

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
  { stdio: 'inherit', windowsHide: true }
);

if (result.status !== 0) {
  console.error('Failed to create zip.');
  process.exit(result.status || 1);
}

fs.copyFileSync(zipPath, latestZipPath);

const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
console.log(`\nRelease ready:\n  ${zipPath}\n  ${latestZipPath}\n  (${sizeMb} MB)`);
console.log(`\nContents:\n  ${setupName}`);
