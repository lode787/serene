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
- `release/Serene-Windows-vX.Y.Z.zip` — upload this to GitHub Releases

The original `SereneSetup.exe` installer is not rebuilt yet; releases from this workflow ship the portable folder inside the zip (same layout users already extract and run via `Serene.exe`).
