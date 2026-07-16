// ---- Theme (light / dark) ----
// The inline <head> script already applied data-theme before paint; these just
// power the toggle button and keep the choice in localStorage.
function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
function themeIconHTML() { return currentTheme() === 'dark' ? ICONS.sun : ICONS.moon; }
window.toggleTheme = function () {
  var next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('sonnaTheme', next); } catch (e) {}
  var ics = document.querySelectorAll('.theme-ic');
  for (var i = 0; i < ics.length; i++) ics[i].innerHTML = themeIconHTML();
};

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
      '<button class="nav-link nav-list-factory" onclick="listYourFactory()">' + ICONS.factory + ' ' + t('list_factory') + '</button>' +
      '<a href="' + consultHref + '" class="nav-link nav-consult">' + ICONS.compass + ' ' + t('nav_consult') + '</a>' +
      '<button class="nav-link" onclick="openRequestForm()">' + ICONS.megaphone + ' ' + t('post_request') + '</button>' +
    '</nav>' +
    '<div class="header-actions">' +
      '<a href="factories.html" class="header-quick-btn desktop-only-flex">' + ICONS.factory + '</a>' +
      '<a href="requests.html" class="header-quick-btn desktop-only-flex">' + ICONS.clipboard + '</a>' +
      '<button class="header-quick-btn desktop-only-flex theme-toggle" aria-label="' + t('theme_toggle') + '" onclick="toggleTheme()"><span class="theme-ic">' + themeIconHTML() + '</span></button>' +
      '<div class="lang-toggle desktop-only-flex">' +
        '<button class="' + (LANG === 'en' ? 'on' : '') + '" onclick="setLang(\'en\')">EN</button>' +
        '<button class="' + (LANG === 'ar' ? 'on' : '') + '" onclick="setLang(\'ar\')">عربي</button>' +
      '</div>' +
      (window.Auth && Auth.isLoggedIn()
        ? '<button class="header-quick-btn desktop-only-flex nav-bell" aria-label="' + t('nav_notifs') + '" style="position:relative" onclick="toggleNotifs(event)">' + ICONS.bell + '<span class="notif-badge" style="display:none"></span></button>' +
          '<a href="messages.html" class="header-quick-btn desktop-only-flex nav-messages" aria-label="' + t('nav_messages') + '" style="position:relative">' + ICONS.chat + '<span class="msg-badge" style="display:none"></span></a>' +
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
      '<button class="mobile-menu-link theme-toggle" style="width:100%;text-align:start;background:none;border:none;cursor:pointer" onclick="toggleTheme()"><span class="theme-ic">' + themeIconHTML() + '</span> <span>' + t('theme_toggle') + '</span></button>' +
      '<a href="index.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.home + ' ' + t('nav_home') + '</a>' +
      '<a href="factories.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.factory + ' ' + t('nav_factories') + '</a>' +
      '<a href="requests.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.clipboard + ' ' + t('nav_requests') + '</a>' +
      '<button class="mobile-menu-link" style="width:100%;text-align:start;background:none;border:none;cursor:pointer" onclick="closeMobileMenu();listYourFactory()">' + ICONS.factory + ' ' + t('list_factory') + '</button>' +
      '<a href="' + consultHref + '" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.compass + ' ' + t('nav_consult') + '</a>' +
      (window.Auth && Auth.isLoggedIn()
        ? '<button class="mobile-menu-link" style="width:100%;text-align:start;background:none;border:none;cursor:pointer" onclick="closeMobileMenu();toggleNotifs(event)">' + ICONS.bell + ' ' + t('nav_notifs') + ' <span class="notif-badge" style="display:none"></span></button>' +
          '<a href="messages.html" class="mobile-menu-link" onclick="closeMobileMenu()">' + ICONS.chat + ' ' + t('nav_messages') + ' <span class="msg-badge" style="display:none"></span></a>' +
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

// ---- Favorites / shortlist (client-side cache of the user's saved ids) ----
window.FAVORITES = window.FAVORITES || null;   // Set of factory ids, null until loaded
function isFav(id) { return !!(window.FAVORITES && FAVORITES.has(String(id))); }
function loadFavorites(cb) {
  if (!signedIn()) { window.FAVORITES = new Set(); if (cb) cb(); return; }
  Auth.myFavorites().then(function (ids) { window.FAVORITES = new Set(ids.map(String)); if (cb) cb(); })
    .catch(function () { window.FAVORITES = new Set(); if (cb) cb(); });
}
function favBtnHTML(id) {
  var on = isFav(id);
  return '<button class="fav-btn' + (on ? ' on' : '') + '" data-fid="' + esc(String(id)) + '" ' +
    'aria-label="' + t('fav_save') + '" title="' + t('fav_save') + '" onclick="toggleFavorite(event, \'' + esc(String(id)) + '\')">' +
    (on ? ICONS.heartFilled : ICONS.heart) + '</button>';
}
function toggleFavorite(ev, id) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  if (!signedIn()) { if (window.openAuthModal) openAuthModal('login'); return; }
  if (!window.FAVORITES) window.FAVORITES = new Set();
  id = String(id);
  var wasOn = FAVORITES.has(id);
  if (wasOn) FAVORITES.delete(id); else FAVORITES.add(id);
  (document.querySelectorAll('.fav-btn[data-fid="' + id + '"]') || []).forEach(function (b) {
    b.classList.toggle('on', !wasOn); b.innerHTML = !wasOn ? ICONS.heartFilled : ICONS.heart;
  });
  var p = wasOn ? Auth.removeFavorite(id) : Auth.addFavorite(id);
  p.then(function () { if (typeof window.onFavoritesChanged === 'function') window.onFavoritesChanged(); })
   .catch(function () { if (wasOn) FAVORITES.add(id); else FAVORITES.delete(id); });   // revert on failure
}

// ---- Media lightbox (photos + videos, viewed in-page) ----
function galleryItem(m) {
  if (m.type === 'video') {
    return '<button type="button" class="ph lb-ph" data-url="' + esc(m.url) + '" data-type="video" onclick="openLightbox(this)">' +
      '<video src="' + encodeURI(m.url) + '" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>' +
      '<span class="lb-play">' + ICONS.play + '</span></button>';
  }
  return '<button type="button" class="ph lb-ph" data-url="' + esc(m.url) + '" data-type="image" onclick="openLightbox(this)" ' +
    'style="background-image:url(\'' + safeUrl(m.url) + '\');background-size:cover;background-position:center"></button>';
}
function galleryHTML(media) { return (media || []).map(galleryItem).join(''); }

window.openLightbox = function (btn) {
  var group = btn.closest ? btn.closest('.gallery') : null;
  var items = group ? Array.prototype.slice.call(group.querySelectorAll('.lb-ph')) : [btn];
  var media = items.map(function (b) { return { url: b.getAttribute('data-url'), type: b.getAttribute('data-type') }; });
  var idx = items.indexOf(btn); if (idx < 0) idx = 0;

  var bd = document.createElement('div');
  bd.className = 'lightbox';
  function render() {
    var m = media[idx];
    var inner = m.type === 'video'
      ? '<video src="' + encodeURI(m.url) + '" controls autoplay playsinline class="lb-media"></video>'
      : '<img src="' + encodeURI(m.url) + '" class="lb-media" alt="">';
    bd.innerHTML = '<button class="lb-close" aria-label="close">' + ICONS.close + '</button>' +
      (media.length > 1 ? '<button class="lb-nav lb-prev" aria-label="previous">‹</button><button class="lb-nav lb-next" aria-label="next">›</button>' : '') +
      '<div class="lb-stage">' + inner + '</div>' +
      (media.length > 1 ? '<div class="lb-count">' + (idx + 1) + ' / ' + media.length + '</div>' : '');
    bd.querySelector('.lb-close').onclick = close;
    var p = bd.querySelector('.lb-prev'), n = bd.querySelector('.lb-next');
    if (p) p.onclick = function (e) { e.stopPropagation(); idx = (idx - 1 + media.length) % media.length; render(); };
    if (n) n.onclick = function (e) { e.stopPropagation(); idx = (idx + 1) % media.length; render(); };
  }
  function close() { document.body.style.overflow = ''; document.removeEventListener('keydown', key); bd.remove(); }
  function key(e) {
    if (e.key === 'Escape') close();
    else if (media.length > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { idx = (idx + (e.key === 'ArrowRight' ? 1 : media.length - 1)) % media.length; render(); }
  }
  bd.addEventListener('click', function (e) { if (e.target === bd || (e.target.closest && e.target.closest('.lb-stage') === e.target) ) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(bd);
  document.body.style.overflow = 'hidden';
  render();
};

// ---- Report modal (factories, requests, messages) ----
function reportBtnHTML(type, id, context, small) {
  return '<button class="report-btn' + (small ? ' small' : '') + '" onclick="openReportModal(\'' + esc(type) + '\',\'' + esc(String(id)) + '\',\'' + esc(String(context || '')).replace(/\x27/g, '&#39;') + '\')">' +
    ICONS.flag + ' ' + t('report') + '</button>';
}
window.openReportModal = function (type, id, context) {
  if (!(window.Auth && Auth.isLoggedIn())) { if (window.openAuthModal) openAuthModal('login'); return; }
  var reasons = (t('rep_reasons') && t('rep_reasons')[type]) || [t('rep_other')];
  var bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('click', function (e) { if (e.target === bd) bd.remove(); });
  bd.innerHTML =
    '<div class="modal">' +
      '<h2>' + t('report_title') + '</h2>' +
      '<p class="sub">' + t('report_sub') + '</p>' +
      '<div class="au-err" id="rpErr" style="display:none"></div>' +
      '<div class="form-field full"><label>' + t('report_reason') + '</label>' +
        '<select id="rp_reason">' + reasons.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-field full" style="margin-top:10px"><label>' + t('report_details') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
        '<textarea id="rp_details" rows="3" placeholder="' + esc(t('report_details_ph')) + '"></textarea></div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="this.closest(\'.modal-backdrop\').remove()">' + t('cancel') + '</button>' +
        '<button class="btn btn-danger" id="rp_submit">' + t('report_submit') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(bd);
  bd.querySelector('#rp_submit').onclick = function () {
    var reason = bd.querySelector('#rp_reason').value;
    var details = bd.querySelector('#rp_details').value.trim();
    var btn = bd.querySelector('#rp_submit'); btn.disabled = true; btn.textContent = '…';
    Auth.submitReport({ target_type: type, target_id: String(id), reason: reason, details: details, context: String(context || '').slice(0, 300) })
      .then(function () { bd.remove(); toast(t('report_thanks')); })
      .catch(function (e) { btn.disabled = false; btn.textContent = t('report_submit'); var er = bd.querySelector('#rpErr'); er.textContent = (e.message || e); er.style.display = 'block'; });
  };
};

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
  var status = f.verificationStatus || f.verification_status;
  if (status === 'active_pending_visit') {
    return '<span class="vbadge v-pending" title="' + esc(t('badge_pending_tip')) + '">' + ICONS.check + ' ' + t('badge_verified_pending') + '</span>';
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
        favBtnHTML(f.id) +
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
      favBtnHTML(f.id) +
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
        (f.reviewCount > 0
          ? '<span class="chip" style="background:var(--amber-soft);color:#8A5A12">' + ICONS.star + ' ' + num(f.rating) + ' (' + num(f.reviewCount) + ')</span>'
          : '<span class="chip">' + t('new_badge') + '</span>') +
      '</div>' +
    '</div>' +
  '</a>';
}
