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

  // ---- Push notifications ----
  var Push = P.PushNotifications;
  if (Push && Push.addListener) {
    var platform = (typeof Cap.getPlatform === 'function') ? Cap.getPlatform() : 'unknown';

    // FCM/APNs handed us a device token — store it against the signed-in user.
    Push.addListener('registration', function (t) {
      if (window.Auth && Auth.registerPushToken) Auth.registerPushToken(t && t.value, platform);
    });
    Push.addListener('registrationError', function () { /* offline / no play services — ignore */ });

    // Tapped a notification while the app was backgrounded → open its link.
    Push.addListener('pushNotificationActionPerformed', function (action) {
      var data = action && action.notification && action.notification.data;
      var link = data && data.link;
      if (link) window.location.href = link;
    });

    // Ask permission (first launch), then register with FCM/APNs.
    Push.checkPermissions().then(function (res) {
      if (res.receive === 'prompt' || res.receive === 'prompt-with-rationale') return Push.requestPermissions();
      return res;
    }).then(function (res) {
      if (res && res.receive === 'granted') return Push.register();
    }).catch(function () { /* permission denied — nothing to do */ });
  }
})();
