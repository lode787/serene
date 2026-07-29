const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const pkg = require('../package.json');

const root = path.join(__dirname, '..');
const version = pkg.version;
const portableName = 'Serene-Portable-win32-x64';
const portableDir = path.join(root, 'dist', portableName);
const releaseRoot = path.join(root, 'release');
const bundleName = `Serene-Windows-v${version}`;
const bundleDir = path.join(releaseRoot, bundleName);
const zipPath = path.join(releaseRoot, `${bundleName}.zip`);
const latestZipPath = path.join(releaseRoot, 'Serene-Windows.zip');

if (!fs.existsSync(portableDir)) {
  console.error(`Missing packaged app at:\n  ${portableDir}\nRun "npm run package" first.`);
  process.exit(1);
}

fs.rmSync(releaseRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(bundleDir, portableName), { recursive: true });

copyDir(portableDir, path.join(bundleDir, portableName));

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const ps = `
$ErrorActionPreference = 'Stop'
Compress-Archive -Path '${bundleDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force
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
console.log(`\nContents:\n  ${bundleName}/\n    ${portableName}/`);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}
