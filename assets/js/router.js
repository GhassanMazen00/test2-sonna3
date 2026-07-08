// Page initialization based on which HTML file we're on.
// We wait for the latest data (from Supabase, with a safe fallback) first.
(function() {
  var path = window.location.pathname.split('/').pop() || 'index.html';
  var start = function() {
    if (path === '' || path === 'index.html' || path === '/') {
      CURRENT_PAGE = 'home';
      renderHomePage();
    } else if (path === 'factories.html') {
      CURRENT_PAGE = 'factories';
      // factories.html handles its own rendering
    } else if (path === 'requests.html') {
      CURRENT_PAGE = 'requests';
      // requests.html handles its own rendering
    }
  };
  if (window.AdminStore && AdminStore.bootstrap) AdminStore.bootstrap().then(start);
  else start();
})();

function renderHomePage() {
  var featured = FACTORIES.filter(function(f) { return f.featured; });
  var app = document.getElementById('app');
  
  // Set language direction
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  
  var html = headerHTML() + mobileMenuHTML() + '<main>' +
    // Hero section
    '<div class="hero">' +
      '<div class="float-chips-container">' + floatChipsHTML() + '</div>' +
      '<span class="hero-node n1"></span><span class="hero-node n2"></span><span class="hero-node n3"></span>' +
      '<div class="container hero-inner">' +
        '<div class="brand-display">' +
          '<div class="orbit-ring r1"></div><div class="orbit-ring r2"></div>' +
          '<div class="brand-word">' + t('brand') + '<span class="ain">ع</span></div>' +
        '</div>' +
        '<p class="mast-line"><span class="eyebrow"><span class="dot"></span>' + t('eyebrow') + '</span></p>' +
        '<h1>' + t('hero_title') + '</h1>' +
        '<p class="sub">' + t('hero_sub') + '</p>' +
        '<form class="search-bar" onsubmit="event.preventDefault();FILTERS.q=this.q.value;window.location.href=\'factories.html\'">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>' +
          '<input name="q" placeholder="' + t('search_ph') + '">' +
          '<button class="btn btn-primary" type="submit">' + (LANG === 'ar' ? 'بحث' : 'Search') + '</button>' +
        '</form>' +
        '<div class="hero-ctas">' +
          '<a href="factories.html" class="btn btn-ghost">' + ICONS.factory + ' ' + t('browse_factories') + '</a>' +
          '<button class="btn btn-primary" onclick="openRequestForm()">' + ICONS.megaphone + ' ' + t('post_request') + '</button>' +
        '</div>' +
        // Hero slider
        '<div class="hero-slider" id="heroSlider">' +
          '<div class="hs-track" id="hsTrack">' + 
            t('slides').map(function(s) { return '<div class="hs-slide"><span class="ic">' + s[0] + '</span><h3>' + s[1] + '</h3><p>' + s[2] + '</p></div>'; }).join('') +
          '</div>' +
          '<button class="hs-arrow hs-prev" id="hsPrev">‹</button>' +
          '<button class="hs-arrow hs-next" id="hsNext">›</button>' +
          '<div class="hs-dots" id="hsDots">' +
            t('slides').map(function(_, ix) { return '<button class="hs-dot' + (ix === 0 ? ' on' : '') + '" data-ix="' + ix + '"></button>'; }).join('') +
          '</div>' +
        '</div>' +
        '<div class="hero-stats">' +
          '<div class="hero-stat"><b>' + num(50) + '+</b><span>' + t('stat_factories') + '</span></div>' +
          '<div class="hero-stat"><b>' + num(14) + '</b><span>' + t('stat_industries') + '</span></div>' +
          '<div class="hero-stat"><b>' + num(16) + '</b><span>' + t('stat_governorates') + '</span></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    // Featured section (moved up — appears right after the hero/search)
    '<section class="featured-section">' +
      '<div class="container">' +
        '<div class="featured-header">' +
          '<div class="featured-badge"><span class="star">' + ICONS.sparkle + '</span>' + t('featured_badge') + '</div>' +
          '<h2>' + t('featured_title') + '</h2>' +
          '<p>' + t('featured_desc') + '</p>' +
        '</div>' +
        '<div class="featured-showcase" id="featuredShowcase">' +
          featured.map(function(f, i) {
            var indData = ind(f.industry);
            return '<div class="featured-card-large' + (i !== 0 ? ' fade-out' : '') + '" data-fi="' + i + '" style="' + (i !== 0 ? 'display:none' : '') + '">' +
              '<div class="fc-visual" style="background:' + grad(indData.g) + '">' +
                '<div class="fc-pattern"></div>' +
                '<span class="fc-badge">' + factoryCode(f) + '</span>' +
                '<span class="fc-icon">' + indData.icon + '</span>' +
                '<div class="fc-logo" style="color:' + indData.g[0] + '">' + L(f.name).charAt(0) + '</div>' +
              '</div>' +
              '<div class="fc-content">' +
                '<span class="fc-industry">' + indData.icon + ' ' + L({en: indData.en, ar: indData.ar}) + '</span>' +
                '<h3>' + esc(L(f.name)) + '</h3>' +
                '<p>' + esc(L(f.desc)) + '</p>' +
                '<div class="fc-stats">' +
                  '<div class="fc-stat"><span class="stat-value">' + num(f.moq) + '+</span><span class="stat-label">' + t('moq') + ' (' + t('units') + ')</span></div>' +
                  '<div class="fc-stat"><span class="stat-value">' + f.emp + '</span><span class="stat-label">' + t('employees') + '</span></div>' +
                  '<div class="fc-stat"><span class="stat-value">' + num(f.yr) + '</span><span class="stat-label">' + t('established') + '</span></div>' +
                  (f.exp ? '<div class="fc-stat"><span class="stat-value">' + ICONS.globe + '</span><span class="stat-label">' + t('exports') + '</span></div>' : '') +
                '</div>' +
                '<a href="factory-detail.html?id=' + f.id + '" class="btn btn-primary">' + t('featured_view') + ' ' + (LANG === 'ar' ? '←' : '→') + '</a>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="featured-controls">' +
          '<div class="featured-thumbs">' +
            featured.map(function(f, i) {
              var indData = ind(f.industry);
              return '<button class="featured-thumb' + (i === 0 ? ' active' : '') + '" style="background:linear-gradient(135deg,' + indData.g[0] + '15,' + indData.g[1] + '25)" data-fi="' + i + '" onclick="showFeatured(' + i + ')">' + indData.icon + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +
    // Industries section
    '<section class="industries-section">' +
      '<div class="industries-grid-overlay"></div>' +
      '<span class="industries-orb o1"></span><span class="industries-orb o2"></span><span class="industries-orb o3"></span>' +
      '<div class="container">' +
        '<div class="industries-intro">' +
          '<div class="section-badge"><span class="badge-dot"></span>' + t('industries_badge') + '</div>' +
          '<h2>' + t('industries_title') + '</h2>' +
          '<p>' + t('industries_desc') + '</p>' +
        '</div>' +
        '<div class="industries-grid-new">' +
          INDUSTRIES.map(function(i) {
            var c = FACTORIES.filter(function(f) { return f.industry === i.id; }).length;
            return '<a href="factories.html" class="industry-card-new" onclick="FILTERS.industry=\'' + i.id + '\'">' +
              '<div class="ind-icon" style="background:linear-gradient(135deg,' + i.g[0] + '15,' + i.g[1] + '25);color:' + i.g[0] + '">' + i.icon + '</div>' +
              '<div class="ind-name">' + L({en: i.en, ar: i.ar}) + '</div>' +
              '<div class="ind-count">' + num(c) + ' ' + t('factories_count') + '</div>' +
            '</a>';
          }).join('') +
        '</div>' +
        '<div class="industries-cta">' +
          '<a href="factories.html" class="btn btn-primary">' + t('industries_cta') + ' ' + (LANG === 'ar' ? '←' : '→') + '</a>' +
        '</div>' +
      '</div>' +
    '</section>' +
    // Requests section
    '<section class="requests-section">' +
      '<div class="container">' +
        '<div class="requests-header">' +
          '<div>' +
            '<div class="section-label">' + t('requests_label') + '</div>' +
            '<h2>' + t('requests_title') + '</h2>' +
            '<p>' + t('requests_sub') + '</p>' +
          '</div>' +
          '<a href="requests.html" class="btn btn-ghost btn-sm">' + t('requests_view_all') + ' ' + (LANG === 'ar' ? '←' : '→') + '</a>' +
        '</div>' +
        '<div class="requests-carousel" id="reqCarousel">' +
          '<div class="requests-track" id="reqTrack">' +
            REQUESTS.map(function(r) {
              return '<a href="request-detail.html?id=' + r.id + '" class="request-card-new">' +
                '<div class="req-meta">' +
                  '<span class="req-badge"><span class="pulse"></span>' + t('requests_new') + '</span>' +
                  '<span class="req-time">' + STR[LANG].days_ago(r.days) + '</span>' +
                '</div>' +
                '<div class="req-icon" style="background:radial-gradient(rgba(14,107,94,.08) 1.2px,transparent 1.2px) 0 0/18px 18px,linear-gradient(135deg,#EFF6F4,#E2EFEC)">' + r.icon + '</div>' +
                '<h3>' + esc(L(r.title)) + '</h3>' +
                '<p>' + esc(L(r.desc)) + '</p>' +
                '<div class="req-footer">' +
                  '<span>' + ICONS.box + ' ' + t('requests_qty') + ': <strong>' + num(r.qty) + '</strong></span>' +
                  '<span>' + ICONS.pin + ' ' + t('requests_location') + ': ' + L(GOVS[r.gov]) + '</span>' +
                '</div>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="carousel-controls">' +
          '<button class="carousel-arrow" id="reqPrev">‹</button>' +
          Array.from({length: Math.ceil(REQUESTS.length / 3)}, function(_, i) {
            return '<button class="carousel-dot' + (i === 0 ? ' active' : '') + '" data-page="' + i + '"></button>';
          }).join('') +
          '<button class="carousel-arrow" id="reqNext">›</button>' +
        '</div>' +
      '</div>' +
    '</section>' +
    // Consultant section (paid feature — matched to the sector you choose)
    '<section class="consultant-section" id="consultant">' +
      '<div class="container">' +
        '<div class="consultant-wrap">' +
          '<div class="consultant-info">' +
            '<div class="consult-badge">' + ICONS.sparkle + ' ' + t('consult_badge') + '</div>' +
            '<h2>' + t('consult_title') + '</h2>' +
            '<p class="consult-sub">' + t('consult_sub') + '</p>' +
            '<ul class="consult-points">' +
              t('consult_points').map(function(p) {
                return '<li><span class="cpt-ic">' + p[0] + '</span><div><b>' + p[1] + '</b><span>' + p[2] + '</span></div></li>';
              }).join('') +
            '</ul>' +
          '</div>' +
          '<div class="consultant-card">' +
            '<div class="cc-price">' + ICONS.tag + ' ' + t('consult_price') + '</div>' +
            '<h3>' + t('consult_card_title') + '</h3>' +
            '<label class="cc-label" for="consultSector">' + t('consult_choose') + '</label>' +
            '<select id="consultSector" class="cc-select">' +
              INDUSTRIES.map(function(i) { return '<option value="' + i.id + '">' + L({en: i.en, ar: i.ar}) + '</option>'; }).join('') +
            '</select>' +
            '<button class="btn btn-primary cc-btn" onclick="bookConsultation()">' + t('consult_cta') + ' ' + (LANG === 'ar' ? '←' : '→') + '</button>' +
            '<p class="cc-note">' + ICONS.handshake + ' ' + t('consult_note') + '</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +
    // Ticker (moved down — the scrolling industries strip)
    '<div class="ticker"><div class="ticker-track">' + tickerItemsHTML() + tickerItemsHTML() + '</div></div>' +
    // Why section
    '<section class="block alt">' +
      '<div class="container">' +
        '<div class="section-head"><div><h2>' + t('why_title') + '</h2></div></div>' +
        '<div class="why-grid">' +
          t('why').map(function(w) { return '<div class="why-card"><div class="icon">' + w[0] + '</div><h3>' + w[1] + '</h3><p>' + w[2] + '</p></div>'; }).join('') +
        '</div>' +
      '</div>' +
    '</section>' +
    // CTA section
    '<section class="block">' +
      '<div class="container">' +
        '<div class="cta-band">' +
          '<div><h2>' + t('cta_title') + '</h2><p>' + t('cta_sub') + '</p></div>' +
          '<button class="btn btn-primary">' + t('cta_btn') + '</button>' +
        '</div>' +
      '</div>' +
    '</section>' +
  '</main>' +
  '<div class="container" style="padding:0 24px 28px"><p style="font-size:12px;color:var(--ink-soft);text-align:center">' + t('demo_note') + '</p></div>' +
  footerHTML();
  
  app.innerHTML = html;
  
  // Initialize homepage features
  initHeroSlider();
  initFeaturedRotation();
  initRequestsCarousel();
  initFloatRotation();

  // If arriving via a #consultant link (e.g. from another page), scroll to the
  // section once it has been built.
  if (window.location.hash === '#consultant') {
    setTimeout(function() {
      var el = document.getElementById('consultant');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
}

// Ticker items
function tickerItemsHTML() {
  return INDUSTRIES.map(function(i) {
    return '<span class="tk">' + i.icon + ' ' + L({en: i.en, ar: i.ar}) + '<span class="sep"></span></span>';
  }).join('');
}

// Float chips
function floatChipsHTML() {
  var sets = t('float_sets');
  return sets.map(function(set, si) {
    return '<div class="float-chip-set set' + (si + 1) + (si === 0 ? ' visible' : ' hidden') + '" data-set="' + si + '">' +
      set.map(function(chip, fi) {
        return '<div class="float-chip fc' + (fi + 1) + '">' + chip[0] + '<span>' + chip[1] + '<small>' + chip[2] + '</small></span></div>';
      }).join('') +
    '</div>';
  }).join('');
}

// Hero slider
var rotTimer = null;
var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initHeroSlider() {
  clearInterval(rotTimer);
  var track = document.getElementById('hsTrack');
  var slider = document.getElementById('heroSlider');
  if (!track || !slider) return;
  
  var n = t('slides').length;
  var dots = Array.from(slider.querySelectorAll('.hs-dot'));
  var ix = 0;
  var sign = LANG === 'ar' ? 1 : -1;
  
  function show(i) {
    ix = ((i % n) + n) % n;
    track.style.transform = 'translateX(' + (sign * ix * 100) + '%)';
    dots.forEach(function(d, k) { d.classList.toggle('on', k === ix); });
  }
  
  function play() {
    if (REDUCED) return;
    clearInterval(rotTimer);
    rotTimer = setInterval(function() { show(ix + 1); }, 4200);
  }
  
  slider.querySelector('#hsPrev').addEventListener('click', function() { show(ix - 1); play(); });
  slider.querySelector('#hsNext').addEventListener('click', function() { show(ix + 1); play(); });
  dots.forEach(function(d) {
    d.addEventListener('click', function() { show(Number(d.dataset.ix)); play(); });
  });
  slider.addEventListener('mouseenter', function() { clearInterval(rotTimer); });
  slider.addEventListener('mouseleave', play);
  
  var tx = null;
  slider.addEventListener('touchstart', function(e) { tx = e.touches[0].clientX; }, {passive: true});
  slider.addEventListener('touchend', function(e) {
    if (tx == null) return;
    var dx = e.changedTouches[0].clientX - tx;
    tx = null;
    if (Math.abs(dx) < 40) return;
    var fwd = LANG === 'ar' ? dx > 0 : dx < 0;
    show(ix + (fwd ? 1 : -1));
    play();
  }, {passive: true});
  
  show(0);
  play();
}

// Float rotation
var floatInterval = null;

function initFloatRotation() {
  clearInterval(floatInterval);
  var container = document.querySelector('.float-chips-container');
  if (!container) return;
  var sets = container.querySelectorAll('.float-chip-set');
  if (sets.length < 2) return;
  
  var floatSetIndex = 0;
  floatInterval = setInterval(function() {
    sets[floatSetIndex].classList.remove('visible');
    sets[floatSetIndex].classList.add('hidden');
    floatSetIndex = (floatSetIndex + 1) % sets.length;
    sets[floatSetIndex].classList.remove('hidden');
    sets[floatSetIndex].classList.add('visible');
  }, 3500);
}

// Featured rotation
var featuredIndex = 0;
var featuredInterval = null;

function showFeatured(index) {
  var cards = document.querySelectorAll('#featuredShowcase .featured-card-large');
  var thumbs = document.querySelectorAll('.featured-thumb');
  
  cards.forEach(function(c) { c.style.display = 'none'; c.classList.add('fade-out'); });
  thumbs.forEach(function(t) { t.classList.remove('active'); });
  
  if (cards[index]) {
    cards[index].style.display = '';
    setTimeout(function() { cards[index].classList.remove('fade-out'); }, 50);
  }
  if (thumbs[index]) thumbs[index].classList.add('active');
  
  featuredIndex = index;
}

function initFeaturedRotation() {
  clearInterval(featuredInterval);
  var cards = document.querySelectorAll('#featuredShowcase .featured-card-large');
  if (cards.length < 2) return;
  
  featuredInterval = setInterval(function() {
    featuredIndex = (featuredIndex + 1) % cards.length;
    showFeatured(featuredIndex);
  }, 5000);
}

// Requests carousel
var requestsCarouselPage = 0;

function initRequestsCarousel() {
  var track = document.getElementById('reqTrack');
  var carousel = document.getElementById('reqCarousel');
  if (!track || !carousel) return;
  
  var cards = track.querySelectorAll('.request-card-new');
  var dots = carousel.parentElement.querySelectorAll('.carousel-dot');
  var totalPages = Math.ceil(cards.length / 3);
  var sign = LANG === 'ar' ? 1 : -1;
  
  function goToPage(page) {
    requestsCarouselPage = Math.max(0, Math.min(page, totalPages - 1));
    track.style.transform = 'translateX(' + (sign * requestsCarouselPage * 100) + '%)';
    dots.forEach(function(d, i) { d.classList.toggle('active', i === requestsCarouselPage); });
  }
  
  document.getElementById('reqPrev').addEventListener('click', function() { goToPage(requestsCarouselPage - 1); });
  document.getElementById('reqNext').addEventListener('click', function() { goToPage(requestsCarouselPage + 1); });
  dots.forEach(function(d) {
    d.addEventListener('click', function() { goToPage(Number(d.dataset.page)); });
  });
  goToPage(0);
}
