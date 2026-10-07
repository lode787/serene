# Serene (desktop app)

Electron app for mood and habit tracking. Data stays on your device.

## Develop (local testing)

```bash
cd serene-app
npm install
npm start
```

Use `npm start` to try features before tagging a release. No push/tag needed for local testing.

## Ship a release

1. Bump `version` in `package.json` (and `APP_VERSION` in `renderer/app.js`)
2. Build Windows NSIS installer + Windows zip + Chromebook zip:

```bash
npm run release
```

Chromebook zip only (no Windows installer):

```bash
npm run zip:chromebook
```

Output:

- `dist/SereneSetup.exe` — installer (choose folder + desktop shortcut)
- `release/Serene-Windows-vX.Y.Z.zip` — versioned zip containing the setup exe
- `release/Serene-Windows.zip` — stable name used by the website
- `release/Serene-Chromebook-vX.Y.Z.zip` — offline Chrome / Chromebook web app
- `release/Serene-Chromebook.zip` — stable Chromebook name used by the website
- `../downloads/Serene-Chromebook.zip` — site mirror for the marketing page

Tag `vX.Y.Z` and push it to publish the Windows and Chromebook zip files to GitHub Releases automatically.
