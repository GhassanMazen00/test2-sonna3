// Header component
function headerHTML() {
  var path = window.location.pathname.split('/').pop();
  var isHome = (path === '' || path === 'index.html' || path === '/');
  // Consultant feature lives on the home page; from other pages, go home + anchor
  var consultHref = isHome ? '#consultant' : 'index.html#consultant';

  var html = '<header><div class="container header-inner">' +
    '<a href="index.html" class="logo' + (isHome ? ' home-hidden' : '') + '">' +
      '<span class="logo-text-brand">' + t('brand') + '</span><span class="logo-ain">ع</span>' +
    '</a>' +
    '<a href="index.html" class="mobile-home-btn" aria-label="Home" style="display:none">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' +
      '</svg>' +
    '</a>' +
    '<nav class="main-nav' + (isHome ? ' home-nav' : '') + '">' +
      '<a href="index.html" class="nav-link' + (isHome ? ' active' : '') + '">' + t('nav_home') + '</a>' +
      '<a href="factories.html" class="nav-link' + (path === 'factories.html' ? ' active' : '') + '">' + t('nav_factories') + '</a>' +
      '<a href="requests.html" class="nav-link' + (path === 'requests.html' ? ' active' : '') + '">' + t('nav_requests') + '</a>' +
      '<a href="' + consultHref + '" class="nav-link nav-consult">' + ICONS.compass + ' ' + t('nav_consult') + '</a>' +
      '<button class="nav-link" onclick="openRequestForm()">' + ICONS.megaphone + ' ' + t('post_request') + '</button>' +
    '</nav>' +
    '<div class="header-actions">' +
      '<a href="factories.html" class="header-quick-btn desktop-only-flex">' + ICONS.factory + '</a>' +
      '<a href="requests.html" class="header-quick-btn desktop-only-flex">' + ICONS.clipboard + '</a>' +
      '<div class="lang-toggle desktop-only-flex">' +
        '<button class="' + (LANG === 'en' ? 'on' : '') + '" onclick="setLang(\'en\')">EN</button>' +
        '<button class="' + (LANG === 'ar' ? 'on' : '') + '" onclick="setLang(\'ar\')">عربي</button>' +
      '</div>' +
      (window.Auth && Auth.isLoggedIn()
        ? '<a href="messages.html" class="header-quick-btn desktop-only-flex nav-messages" aria-label="' + t('nav_messages') + '" style="position:relative">' + ICONS.chat + '<span class="msg-badge" style="display:none"></span></a>' +
          '<a href="account.html" class="btn btn-ghost btn-sm desktop-only nav-account">' + ICONS.user + ' ' + t('my_account') + '</a>'
        : '<button class="btn btn-ghost btn-sm desktop-only" onclick="openAuthModal(\'login\')">' + t('login') + '</button>' +
          '<button class="btn btn-primary btn-sm desktop-only" onclick="openAuthModal(\'signup\')">' + t('signup') + '</button>') +
      '<button class="mobile-menu-btn" onclick="openMobileMenu()" aria-label="Menu">' + ICONS.menu + '</button>' +
    '</div></div></header>';
  
  return html;
}

// Mobile menu
function mobileMenuHTML() {
  var path = window.location.pathname.split('/').pop();
  var isHome = (path === '' || path === 'index.html' || path === '/');
  var consultHref = isHome ? '#consultant' : 'index.html#consultant';
  return '<div class="mobile-menu-overlay" id="mobileOverlay" onclick="closeMobileMenu()"></div>' +
    '<div class="mobile-menu-panel" id="mobilePanel">' +
      '<button class="mobile-menu-close" onclick="closeMobileMenu()">' + ICONS.close + '</button>' +
      '<div style="font-family:var(--font-brand);font-weight:800;font-size:20px;margin-bottom:16px">' +
        t('brand') + '<span style="color:var(--teal)">ع</span>' +
      '</div>' +
      '<div class="mobile-lang-toggle">' +
        '<button class="' + (LANG === 'en' ? 'on' : '') + '" onclick="setLang(\'en\');closeMobileMenu()">English</button>' +
        '<button class="' + (LANG === 'ar' ? 'on' : '') + '" onclick="setLang(\'ar\');closeMobileMenu()">العربية</button>' +
      '</div>' +
      '<a href="index.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.home + ' ' + t('nav_home') + '</a>' +
      '<a href="factories.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.factory + ' ' + t('nav_factories') + '</a>' +
      '<a href="requests.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.clipboard + ' ' + t('nav_requests') + '</a>' +
      '<a href="' + consultHref + '" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.compass + ' ' + t('nav_consult') + '</a>' +
      (window.Auth && Auth.isLoggedIn()
        ? '<a href="messages.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.chat + ' ' + t('nav_messages') + ' <span class="msg-badge" style="display:none"></span></a>' +
          '<a href="account.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.user + ' ' + t('my_account') + '</a>'
        : '') +
      '<div class="mobile-menu-divider"></div>' +
      (window.Auth && Auth.isLoggedIn()
        ? '<button class="btn btn-ghost mobile-menu-btn-full" onclick="Auth.logout()">' + t('logout') + '</button>'
        : '<button class="btn btn-ghost mobile-menu-btn-full" onclick="openAuthModal(\'login\');closeMobileMenu()">' + t('login') + '</button>' +
          '<button class="btn btn-primary mobile-menu-btn-full" onclick="openAuthModal(\'signup\');closeMobileMenu()">' + t('signup') + '</button>') +
      '<button class="btn btn-primary mobile-menu-btn-full" onclick="openRequestForm();closeMobileMenu()">' + t('post_request') + '</button>' +
    '</div>';
}

// Footer
function footerHTML() {
  function col(title, items) {
    return '<div><h4>' + title + '</h4><ul>' + 
      items.map(function(x) { return '<li><button>' + x + '</button></li>'; }).join('') + 
    '</ul></div>';
  }
  
  return '<footer><div class="container">' +
    '<div class="footer-grid">' +
      '<div>' +
        '<div class="logo-text">' + t('brand') + '<span class="logo-ain">ع</span></div>' +
        '<p>' + t('footer_about') + '</p>' +
      '</div>' +
      col(t('f_platform'), t('f_links1')) +
      col(t('f_company'), t('f_links2')) +
      col(t('f_support'), t('f_links3')) +
    '</div>' +
    '<div class="footer-bottom">' +
      '<span>' + t('rights') + '</span>' +
      '<span>' + t('made') + '</span>' +
    '</div>' +
  '</div></footer>';
}

// Is a site visitor signed in? Location, contact channels and messaging are
// gated behind this — logged-out visitors can browse but not act.
function signedIn() { return !!(window.Auth && Auth.isLoggedIn()); }

// Branded animated loading placeholder (not a skeleton) — a pulsing dot trio in
// the platform's teal. Use where data is being fetched.
function loadingHTML(label) {
  return '<div class="loading-wrap">' +
    '<span class="loading-dots"><i></i><i></i><i></i></span>' +
    (label ? '<span class="loading-label">' + esc(label) + '</span>' : '') +
  '</div>';
}

// Slim call-to-join banner shown to logged-out visitors on browse pages.
function signupNudge(msg) {
  if (signedIn()) return '';
  return '<div class="signup-nudge">' +
    '<span>' + ICONS.user + ' ' + esc(msg) + '</span>' +
    '<span class="nudge-actions">' +
      '<button class="btn btn-primary btn-sm" onclick="openAuthModal(\'signup\')">' + t('signup') + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="openAuthModal(\'login\')">' + t('login') + '</button>' +
    '</span>' +
  '</div>';
}

// Verified / unverified badge (unverified shows a hover tooltip explaining why)
function verifyBadge(f) {
  if (f.verified === false) {
    return '<span class="vbadge v-no" title="' + esc(t('badge_unverified_tip')) + '">' + ICONS.clock + ' ' + t('badge_unverified') + '</span>';
  }
  return '<span class="vbadge v-yes">' + ICONS.check + ' ' + t('badge_verified') + '</span>';
}

// Factory card
function factoryCardHTML(f) {
  var i = ind(f.industry);
  // Unverified user submissions are teased with name + sector only; everything
  // else stays hidden until an admin verifies the factory.
  if (f.verified === false) {
    return '<a href="factory-detail.html?id=' + f.id + '" class="factory-card">' +
      '<div class="cover" style="background:' + grad(i.g) + '">' +
        '<span class="cover-badge">' + verifyBadge(f) + '</span>' +
        '<span class="cover-ic">' + i.icon + '</span>' +
        '<div class="flogo">' + esc(L(f.name).charAt(0)) + '</div>' +
      '</div>' +
      '<div class="body">' +
        '<h3>' + esc(L(f.name)) + '</h3>' +
        '<div class="meta"><span>' + i.icon + ' ' + L({en: i.en, ar: i.ar}) + '</span></div>' +
        '<div class="lock-note" style="margin-top:10px">' + ICONS.clock + ' ' + t('mf_locked') + '</div>' +
      '</div>' +
    '</a>';
  }
  return '<a href="factory-detail.html?id=' + f.id + '" class="factory-card">' +
    '<div class="cover" style="' + (f.cover ? 'background-image:url(\'' + safeUrl(f.cover) + '\');background-size:cover;background-position:center' : 'background:' + grad(i.g)) + '">' +
      '<span class="fcode">' + factoryCode(f) + '</span>' +
      '<span class="cover-badge">' + verifyBadge(f) + '</span>' +
      (f.cover ? '' : '<span class="cover-ic">' + i.icon + '</span>') +
      (f.logo
        ? '<div class="flogo" style="background-image:url(\'' + safeUrl(f.logo) + '\');background-size:cover;background-position:center"></div>'
        : '<div class="flogo">' + esc(L(f.name).charAt(0)) + '</div>') +
    '</div>' +
    '<div class="body">' +
      '<h3>' + esc(L(f.name)) + '</h3>' +
      '<div class="meta">' +
        '<span>' + i.icon + ' ' + L({en: i.en, ar: i.ar}) + '</span>' +
        (signedIn() && f.gov ? ' · <span>' + ICONS.pin + ' ' + L(f.gov) + '</span>' : '') +
      '</div>' +
      '<div class="desc">' + esc(L(f.desc)) + '</div>' +
      '<div class="chip-row">' +
        '<span class="chip teal">' + t('moq') + ': ' + num(f.moq) + '</span>' +
        (f.exp ? '<span class="chip amber">' + ICONS.globe + ' ' + t('exports') + '</span>' : '') +
        f.certs.slice(0, 1).map(function(c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') +
        '<span class="chip" style="background:var(--amber-soft);color:#8A5A12">' + ICONS.star + ' ' + num(f.rating) + '</span>' +
      '</div>' +
    '</div>' +
  '</a>';
}
