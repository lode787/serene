const { packager } = require('@electron/packager');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const packagedName = 'Serene-win32-x64';
const portableName = 'Serene-Portable-win32-x64';

async function main() {
  const appPaths = await packager({
    dir: root,
    name: 'Serene',
    platform: 'win32',
    arch: 'x64',
    out: dist,
    overwrite: true,
    asar: true,
    icon: path.join(root, 'assets', 'icon.ico'),
    appCopyright: 'Serene',
    win32metadata: {
      CompanyName: 'Serene',
      FileDescription: 'Serene',
      ProductName: 'Serene',
    },
    ignore: [
      /^\/dist($|\/)/,
      /^\/scripts($|\/)/,
      /^\/release($|\/)/,
      /(^|\/)\.gitignore$/,
      /(^|\/)README\.md$/,
      /(^|\/)package-lock\.json$/,
    ],
  });

  const from = appPaths[0] || path.join(dist, packagedName);
  const to = path.join(dist, portableName);
  if (path.resolve(from) !== path.resolve(to)) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
  }

  console.log('Packaged:', to);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
