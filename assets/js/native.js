// Native-app shell (Capacitor). Two things live here:
//   1. The APP CHROME (bottom tab bar, app-styled header/footer) — shown when
//      the page runs inside the native app OR in browser "app preview" mode
//      (?app=1, which sets a localStorage flag so it sticks across pages).
//      This is what makes it look like an app instead of the website.
//   2. The NATIVE-ONLY behaviours (splash, status bar, Android back button,
//      push notifications) — gated behind a real Capacitor native platform.
// The plain website (no flag, not native) is completely untouched.
(function () {
  var Cap = window.Capacitor;
  var isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());

  // Browser preview toggle: ?app=1 turns app chrome on, ?app=0 turns it off.
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('app') === '1') localStorage.setItem('sonnaAppPreview', '1');
    if (qs.get('app') === '0') localStorage.removeItem('sonnaAppPreview');
  } catch (e) {}
  var isPreview = false;
  try { isPreview = localStorage.getItem('sonnaAppPreview') === '1'; } catch (e) {}

  var appMode = isNative || isPreview;
  if (!appMode) return;                       // plain website — do nothing.

  var root = document.documentElement;
  root.classList.add('app-mode');
  if (isNative) root.classList.add('native-app');

  var vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';

  // ---- Bottom tab bar (the signature app element) ----
  function ic(name) { return (window.ICONS && ICONS[name]) || ''; }
  function lbl(key, fallback) { return (window.t ? t(key) : '') || fallback; }

  function buildTabBar() {
    if (document.querySelector('.app-tabbar')) return;
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var tabs = [
      { href: 'index.html',     icon: 'home',      label: lbl('nav_home', 'الرئيسية') },
      { href: 'factories.html', icon: 'factory',   label: lbl('nav_factories', 'المصانع') },
      { href: 'requests.html',  icon: 'clipboard', label: lbl('nav_requests', 'الطلبات') },
      { href: 'messages.html',  icon: 'chat',      label: lbl('nav_messages', 'الرسائل') },
      { href: 'account.html',   icon: 'user',      label: lbl('my_account', 'حسابي') }
    ];
    var nav = document.createElement('nav');
    nav.className = 'app-tabbar';
    nav.innerHTML = tabs.map(function (tb) {
      var active = (here === tb.href) ? ' active' : '';
      return '<a class="app-tab' + active + '" href="' + tb.href + '">' +
               '<span class="app-tab-ic">' + ic(tb.icon) + '</span>' +
               '<span class="app-tab-lb">' + tb.label + '</span>' +
             '</a>';
    }).join('');
    document.body.appendChild(nav);

    // Badge the Messages tab from the unread count the chat layer already tracks.
    try {
      var badge = document.querySelector('.msg-badge');
      var msgTab = nav.querySelector('a[href="messages.html"] .app-tab-ic');
      if (badge && msgTab && badge.textContent && badge.style.display !== 'none') {
        msgTab.insertAdjacentHTML('beforeend', '<i class="app-tab-dot"></i>');
      }
    } catch (e) {}
  }

  if (document.readyState !== 'loading') buildTabBar();
  else document.addEventListener('DOMContentLoaded', buildTabBar);
  // Header/footer render async after AdminStore.bootstrap — retry once they land.
  window.addEventListener('load', buildTabBar);

  if (!isNative) return;                       // preview mode stops here.

  // ================= NATIVE-ONLY =================
  var P = Cap.Plugins || {};

  function hideSplash() { if (P.SplashScreen) { try { P.SplashScreen.hide(); } catch (e) {} } }
  if (document.readyState === 'complete') setTimeout(hideSplash, 150);
  else window.addEventListener('load', function () { setTimeout(hideSplash, 150); });

  // Solid status bar that does NOT overlay the web view — otherwise the area
  // behind the app shows through at the top. Colour + icon style follow theme.
  if (P.StatusBar) {
    try {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      P.StatusBar.setOverlaysWebView({ overlay: false });
      P.StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' });     // LIGHT = dark icons on our light bar
      P.StatusBar.setBackgroundColor({ color: dark ? '#0F241E' : '#FFFFFF' });
    } catch (e) {}
  }

  // Android hardware back button: close a modal, else navigate back, else exit.
  if (P.App && P.App.addListener) {
    P.App.addListener('backButton', function () {
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
    Push.addListener('registration', function (tok) {
      if (window.Auth && Auth.registerPushToken) Auth.registerPushToken(tok && tok.value, platform);
    });
    Push.addListener('registrationError', function () {});
    Push.addListener('pushNotificationActionPerformed', function (action) {
      var data = action && action.notification && action.notification.data;
      if (data && data.link) window.location.href = data.link;
    });
    Push.checkPermissions().then(function (res) {
      if (res.receive === 'prompt' || res.receive === 'prompt-with-rationale') return Push.requestPermissions();
      return res;
    }).then(function (res) {
      if (res && res.receive === 'granted') return Push.register();
    }).catch(function () {});
  }
})();
