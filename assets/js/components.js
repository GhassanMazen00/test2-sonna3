// Header component
function headerHTML() {
  var isHome = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
  
  return '<header>' +
    '<div class="container header-inner">' +
      '<a href="index.html" class="logo' + (isHome ? ' home-hidden' : '') + '">' +
        '<span class="logo-text-brand">' + t('brand') + '</span><span class="logo-ain">ع</span>' +
      '</a>' +
      '<a href="index.html" class="mobile-home-btn" aria-label="Home" style="display:none">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
          '<polyline points="9 22 9 12 15 12 15 22"/>' +
        '</svg>' +
      '</a>' +
      '<nav class="main-nav' + (isHome ? ' home-nav' : '') + '">' +
        '<a href="index.html" class="nav-link' + (isHome ? ' active' : '') + '">' + t('nav_home') + '</a>' +
        '<a href="factories.html" class="nav-link' + (CURRENT_PAGE === 'factories' ? ' active' : '') + '">' + t('nav_factories') + '</a>' +
        '<a href="requests.html" class="nav-link' + (CURRENT_PAGE === 'requests' ? ' active' : '') + '">' + t('nav_requests') + '</a>' +
        '<button class="nav-link" onclick="openRequestForm()">📣 ' + t('post_request') + '</button>' +
      '</nav>' +
      '<div class="header-actions">' +
        '<a href="factories.html" class="header-quick-btn desktop-only-flex">🏭</a>' +
        '<a href="requests.html" class="header-quick-btn desktop-only-flex">📋</a>' +
        '<div class="lang-toggle desktop-only-flex">' +
          '<button class="' + (LANG === 'en' ? 'on' : '') + '" onclick="setLang(\'en\')">EN</button>' +
          '<button class="' + (LANG === 'ar' ? 'on' : '') + '" onclick="setLang(\'ar\')">عربي</button>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm desktop-only">' + t('login') + '</button>' +
        '<button class="mobile-menu-btn" onclick="openMobileMenu()" aria-label="Menu">☰</button>' +
      '</div>' +
    '</div>' +
  '</header>';
}

// Mobile menu
function mobileMenuHTML() {
  return '<div class="mobile-menu-overlay" id="mobileOverlay" onclick="closeMobileMenu()"></div>' +
    '<div class="mobile-menu-panel" id="mobilePanel">' +
      '<button class="mobile-menu-close" onclick="closeMobileMenu()">✕</button>' +
      '<div style="font-family:var(--font-brand);font-weight:800;font-size:20px;margin-bottom:16px">' +
        t('brand') + '<span style="color:var(--teal)">ع</span>' +
      '</div>' +
      '<div class="mobile-lang-toggle">' +
        '<button class="' + (LANG === 'en' ? 'on' : '') + '" onclick="setLang(\'en\');closeMobileMenu()">English</button>' +
        '<button class="' + (LANG === 'ar' ? 'on' : '') + '" onclick="setLang(\'ar\');closeMobileMenu()">العربية</button>' +
      '</div>' +
      '<a href="index.html" class="mobile-menu-link" onclick="closeMobileMenu()">🏠 ' + t('nav_home') + '</a>' +
      '<a href="factories.html" class="mobile-menu-link" onclick="closeMobileMenu()">🏭 ' + t('nav_factories') + '</a>' +
      '<a href="requests.html" class="mobile-menu-link" onclick="closeMobileMenu()">📋 ' + t('nav_requests') + '</a>' +
      '<div class="mobile-menu-divider"></div>' +
      '<button class="btn btn-ghost mobile-menu-btn-full">' + t('login') + '</button>' +
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
  
  return '<footer>' +
    '<div class="container">' +
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
    '</div>' +
  '</footer>';
}

// Factory card
function factoryCardHTML(f) {
  var i = ind(f.industry);
  return '<a href="factory-detail.html?id=' + f.id + '" class="factory-card">' +
    '<div class="cover" style="background:' + grad(i.g) + '">' +
      '<span class="fcode">' + factoryCode(f) + '</span>' +
      '<span class="cover-ic">' + i.icon + '</span>' +
      '<div class="flogo">' + L(f.name).charAt(0) + '</div>' +
    '</div>' +
    '<div class="body">' +
      '<h3>' + esc(L(f.name)) + '</h3>' +
      '<div class="meta">' +
        '<span>' + i.icon + ' ' + L({en: i.en, ar: i.ar}) + '</span> · ' +
        '<span>📍 ' + L(f.gov) + '</span>' +
      '</div>' +
      '<div class="desc">' + esc(L(f.desc)) + '</div>' +
      '<div class="chip-row">' +
        '<span class="chip teal">' + t('moq') + ': ' + num(f.moq) + '</span>' +
        (f.exp ? '<span class="chip amber">🌍 ' + t('exports') + '</span>' : '') +
        f.certs.slice(0, 1).map(function(c) { return '<span class="chip">' + c + '</span>'; }).join('') +
        '<span class="chip" style="background:var(--amber-soft);color:#8A5A12">⭐ ' + f.rating + '</span>' +
      '</div>' +
    '</div>' +
  '</a>';
}
