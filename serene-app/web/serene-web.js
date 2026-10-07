/**
 * Browser / Chromebook bridge. Same window.serene surface as Electron preload,
 * with no-ops where ChromeOS has no native equivalent.
 */
(function () {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('is-web', 'is-chromebook');
  }

  window.serene = window.serene || {
    getVersion: async () => '1.1.15',
    openExternal: async (url) => {
      try {
        window.open(String(url), '_blank', 'noopener,noreferrer');
        return true;
      } catch (e) {
        return false;
      }
    },
    setTray: async () => false,
    quit: async () => {},
    nowPlaying: async () => null,
    exportFile: async () => false,
    isAndroid: () => false,
    isWeb: () => true,
  };

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
