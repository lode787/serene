const { app, BrowserWindow, Menu, Notification, shell, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const pkg = require('./package.json');

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;
let settingsCache = { minimizeToTray: false };

if (process.platform === 'win32') app.setAppUserModelId('com.serene.app');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 340,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    backgroundColor: '#00000000',
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splashWindow.setMenu(null);
  splashWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'));
  splashWindow.on('closed', () => { splashWindow = null; });
}

function getTrayIcon() {
  try {
    const p = path.join(__dirname, 'assets', 'tray.png');
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) return img;
  } catch (e) {}
  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVQ4jWNgGAWjYBSMglEwCkYBIwMDw38GBgYGJgYyABMDGWDUgFEDRg0YNWDUgFEDRg0YNWDUgFEwCoYCAJ2yAwXm3o5vAAAAAElFTkSuQmCC',
    'base64'
  );
  return nativeImage.createFromBuffer(buf);
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open Serene', click: () => showWindow() },
    { type: 'separator' },
    { label: 'Quit Serene', click: () => { isQuitting = true; app.quit(); } },
  ]);
}

function ensureTray() {
  if (tray) return tray;
  tray = new Tray(getTrayIcon());
  tray.setToolTip('Serene');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => showWindow());
  tray.on('double-click', () => showWindow());
  return tray;
}

function destroyTray() {
  if (tray) { tray.destroy(); tray = null; }
}

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b1020',
    title: 'Serene',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const reveal = () => {
    setTimeout(() => {
      if (splashWindow) { try { splashWindow.close(); } catch(e){} }
      if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); }
    }, 1400);
  };
  mainWindow.once('ready-to-show', reveal);
  setTimeout(() => { if (mainWindow && !mainWindow.isVisible()) reveal(); }, 6000);

  mainWindow.on('close', (e) => {
    if (!isQuitting && settingsCache.minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
      ensureTray();
    }
  });
  mainWindow.on('minimize', (e) => {
    if (settingsCache.minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
      ensureTray();
    }
  });
}

ipcMain.handle('serene:version', () => pkg.version);
ipcMain.handle('serene:notify', (_e, { title, body }) => {
  try {
    if (Notification.isSupported()) {
      new Notification({ title: title || 'Serene', body: body || '' }).show();
      return true;
    }
  } catch (e) {}
  return false;
});
ipcMain.handle('serene:open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});
ipcMain.handle('serene:set-tray', (_e, enabled) => {
  settingsCache.minimizeToTray = !!enabled;
  if (settingsCache.minimizeToTray) ensureTray(); else destroyTray();
  return true;
});
ipcMain.handle('serene:quit', () => { isQuitting = true; app.quit(); });

// ============== NOW PLAYING (Windows SMTC via PowerShell) ==============
// Reads the currently playing media session from any app that reports to
// Windows System Media Transport Controls (Spotify, YouTube in Edge, Groove,
// Media Player, VLC with SMTC plugin, etc.). Cached for 2s.
let _npCache = { at: 0, data: null };
let _npInflight = null;

const NP_PS = `
$ErrorActionPreference = 'SilentlyContinue'
try {
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] > $null
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
  Function Await($t, $rt) {
    $task = $asTaskGeneric.MakeGenericMethod($rt).Invoke($null, @($t))
    $task.Wait(-1) | Out-Null
    $task.Result
  }
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  $s = $mgr.GetCurrentSession()
  if ($s -eq $null) { '{}'; return }
  $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
  $info = $s.GetPlaybackInfo()
  $status = $info.PlaybackStatus.ToString()
  $obj = [ordered]@{
    title  = [string]$props.Title
    artist = [string]$props.Artist
    album  = [string]$props.AlbumTitle
    app    = [string]$s.SourceAppUserModelId
    status = $status
  }
  $obj | ConvertTo-Json -Compress
} catch { '{}' }
`;

function runNowPlaying() {
  if (process.platform !== 'win32') return Promise.resolve({});
  if (_npInflight) return _npInflight;
  _npInflight = new Promise((resolve) => {
    let out = ''; let done = false;
    let proc;
    try {
      proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', NP_PS], { windowsHide: true });
    } catch (e) { resolve({}); _npInflight = null; return; }
    const finish = (val) => { if (done) return; done = true; _npInflight = null; resolve(val); };
    const to = setTimeout(() => { try { proc.kill(); } catch(e){} finish({}); }, 3500);
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', () => {});
    proc.on('error', () => { clearTimeout(to); finish({}); });
    proc.on('close', () => {
      clearTimeout(to);
      const line = out.trim();
      if (!line) return finish({});
      try { finish(JSON.parse(line)); } catch { finish({}); }
    });
  });
  return _npInflight;
}

ipcMain.handle('serene:nowplaying', async () => {
  const now = Date.now();
  if (_npCache.data && now - _npCache.at < 2000) return _npCache.data;
  const data = await runNowPlaying();
  _npCache = { at: Date.now(), data };
  return data;
});

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    createSplash();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) { createSplash(); createWindow(); }
    });
  });
}

app.on('before-quit', () => { isQuitting = true; });

app.on('window-all-closed', () => {
  if (settingsCache.minimizeToTray) return;
  if (process.platform !== 'darwin') app.quit();
});
