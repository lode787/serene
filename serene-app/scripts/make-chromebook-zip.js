/**
 * Package the renderer as an offline Chrome / Chromebook web app zip.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const pkg = require('../package.json');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');
const version = pkg.version;
const src = path.join(root, 'renderer');
const webBridge = path.join(root, 'web', 'serene-web.js');
const iconSrc = path.join(root, 'assets', 'icon.png');
const releaseRoot = path.join(root, 'release');
const stageRoot = path.join(releaseRoot, 'staging-chromebook');
const bundleName = `Serene-Chromebook-v${version}`;
const stageDir = path.join(stageRoot, bundleName);
const zipPath = path.join(releaseRoot, `${bundleName}.zip`);
const latestZipPath = path.join(releaseRoot, 'Serene-Chromebook.zip');
const siteMirror = path.join(repoRoot, 'downloads', 'Serene-Chromebook.zip');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name);
    const b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

if (!fs.existsSync(src)) {
  console.error('Missing renderer at', src);
  process.exit(1);
}
if (!fs.existsSync(webBridge)) {
  console.error('Missing Chromebook bridge at', webBridge);
  process.exit(1);
}

fs.mkdirSync(releaseRoot, { recursive: true });
rmrf(stageRoot);
copyDir(src, stageDir);

fs.copyFileSync(webBridge, path.join(stageDir, 'serene-web.js'));

if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(stageDir, 'icon-192.png'));
  fs.copyFileSync(iconSrc, path.join(stageDir, 'icon-512.png'));
  const logoPath = path.join(stageDir, 'logo.png');
  if (!fs.existsSync(logoPath)) fs.copyFileSync(iconSrc, logoPath);
}

const manifest = {
  name: 'Serene',
  short_name: 'Serene',
  description: 'Private mood and habit tracker',
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  background_color: '#0a0812',
  theme_color: '#0a0812',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};
fs.writeFileSync(path.join(stageDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const sw = `const CACHE = 'serene-chromebook-${version}';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './i18n.js',
  './quotes.js',
  './styles.css',
  './serene-web.js',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
`;
fs.writeFileSync(path.join(stageDir, 'sw.js'), sw, 'utf8');

const installTxt = `Serene ${version} — Chromebook

This zip is the ChromeOS / Chromebook build. It is a self-contained web app
(not the Windows installer).

Install
1. Unzip this folder (Files app on your Chromebook).
2. Open index.html with Chrome (right-click → Open with → Chrome).
3. Optional: Chrome menu → Cast, save, and share → Install page as app
   (or "Install Serene") so it opens like a normal app.

Offline
Once opened (or installed), mood and habit data stay in this browser on
this device. Core tracking does not need an account or the internet.

Notes
- Reminders only fire while Serene is open.
- Export / import still work from Settings.
- Windows users should download Serene-Windows.zip instead.
`;
fs.writeFileSync(path.join(stageDir, 'INSTALL.txt'), installTxt, 'utf8');

const indexPath = path.join(stageDir, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
);
if (!html.includes('theme-color')) {
  html = html.replace(
    '<title>',
    '<meta name="theme-color" content="#0a0812" />\n    <title>'
  );
}
html = html.replace(
  /Content-Security-Policy" content="[^"]*"/,
  `Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob:; worker-src 'self'"`
);
if (!html.includes('manifest.webmanifest')) {
  html = html.replace(
    '<link rel="stylesheet" href="styles.css" />',
    `<link rel="manifest" href="manifest.webmanifest" />
    <link rel="icon" type="image/png" href="icon-192.png" />
    <link rel="apple-touch-icon" href="icon-192.png" />
    <link rel="stylesheet" href="styles.css" />`
  );
}
if (!html.includes('serene-web.js')) {
  html = html.replace(
    '<script src="i18n.js"></script>',
    `<script src="serene-web.js"></script>
    <script src="i18n.js"></script>`
  );
}
fs.writeFileSync(indexPath, html, 'utf8');

[zipPath, latestZipPath, siteMirror].forEach((p) => {
  if (fs.existsSync(p)) fs.unlinkSync(p);
});
fs.mkdirSync(path.dirname(siteMirror), { recursive: true });

const zipTarget = zipPath.replace(/'/g, "''");
const stageTarget = stageDir.replace(/'/g, "''");
const ps = `
$ErrorActionPreference = 'Stop'
Compress-Archive -Path '${stageTarget}' -DestinationPath '${zipTarget}' -Force
`;

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
  { stdio: 'inherit', windowsHide: true }
);

if (result.status !== 0) {
  console.error('Failed to create Chromebook zip.');
  process.exit(result.status || 1);
}

fs.copyFileSync(zipPath, latestZipPath);
fs.copyFileSync(zipPath, siteMirror);

const sizeKb = (fs.statSync(zipPath).size / 1024).toFixed(1);
console.log(`\nChromebook release ready:\n  ${zipPath}\n  ${latestZipPath}\n  ${siteMirror}\n  (${sizeKb} KB)`);
