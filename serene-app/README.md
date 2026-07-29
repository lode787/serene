# Serene (desktop app)

Electron app for mood and habit tracking. Data stays on your device.

Recovered from the Windows v1.1.13 release (`app.asar`) so we can edit and ship new builds from this repo.

## Develop

```bash
cd serene-app
npm install
npm start
```

## Ship a release

1. Bump `version` in `package.json`
2. Build portable Windows app + zip:

```bash
npm run release
```

Output:

- `dist/Serene-Portable-win32-x64/` — runnable portable build
- `release/Serene-Windows-vX.Y.Z.zip` — versioned zip
- `release/Serene-Windows.zip` — stable name used by the website (`/releases/latest/download/Serene-Windows.zip`)

Tag `vX.Y.Z` and push it to publish both files to GitHub Releases automatically.
