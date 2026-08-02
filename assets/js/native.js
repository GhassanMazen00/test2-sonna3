// Native-app bridge (Capacitor). Loaded on every page but a complete no-op in
// a normal browser — everything is gated behind Capacitor.isNativePlatform().
// Data and auth still flow through the same Supabase code as the website; this
// only adds the shell behaviours a real app needs: splash, status bar, the
// Android hardware back button, and notch-safe spacing.
(function () {
  var Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return;

  var P = Cap.Plugins || {};
  document.documentElement.classList.add('native-app');

  // Let content extend under the notch/rounded corners so our safe-area CSS
  // (env(safe-area-inset-*)) actually returns non-zero values.
  var vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';

  // Hide the launch splash once the shell is on screen.
  function hideSplash() { if (P.SplashScreen) { try { P.SplashScreen.hide(); } catch (e) {} } }
  if (document.readyState === 'complete') setTimeout(hideSplash, 150);
  else window.addEventListener('load', function () { setTimeout(hideSplash, 150); });

  // Dark text on our light header.
  if (P.StatusBar) { try { P.StatusBar.setStyle({ style: 'LIGHT' }); } catch (e) {} }

  // Android hardware back button: step back through history, exit at the root.
  if (P.App && P.App.addListener) {
    P.App.addListener('backButton', function () {
      // If a modal/backdrop is open, close it instead of navigating away.
      var bd = document.querySelector('.modal-backdrop, .lightbox-backdrop');
      if (bd) { bd.remove(); return; }
      if (window.history.length > 1) window.history.back();
      else if (P.App.exitApp) P.App.exitApp();
    });
  }
})();
