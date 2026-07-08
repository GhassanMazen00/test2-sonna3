// ============================================
// STORE — saves/loads the admin-editable data
// ============================================
//
// The public site normally uses the built-in data in data.js. When you use the
// admin panel (admin.html) and save, your changes are stored in this browser
// (localStorage key "sonnaAdminData"). This file reads that saved data on every
// page and applies it, so the site shows YOUR factories, sectors, and settings.
//
// Nothing here talks to a server — edits live in the browser. Use the admin
// panel's Export button to download your data and publish it for everyone.

var STORAGE_KEY = 'sonnaAdminData';

// Which icon each default sector uses (icon keys live in icons.js)
var DEFAULT_INDUSTRY_ICON = {
  textile: 'textile', packaging: 'box', furniture: 'furniture', food: 'food',
  plastics: 'plastics', metal: 'gear', chemicals: 'chemicals', cosmetics: 'cosmetics',
  construction: 'construction', medical: 'medical', promo: 'promo',
  electronics: 'electronics', agriculture: 'agriculture', automotive: 'automotive'
};

var DEFAULT_SEARCH_FIELDS = ['name', 'sector', 'governorate', 'products', 'capabilities', 'keywords'];
var DEFAULT_FILTER_CONFIG = { industry: true, gov: true, moq: true, exp: true, cert: true, capacity: true };

// Runtime config the public pages read (may be overridden by saved data)
window.SEARCH_CONFIG = { fields: DEFAULT_SEARCH_FIELDS.slice() };
window.FILTER_CONFIG = Object.assign({}, DEFAULT_FILTER_CONFIG);

function iconKeyFor(id) { return DEFAULT_INDUSTRY_ICON[id] || 'factory'; }
function resolveIcon(key) { return (window.ICONS && ICONS[key]) || (window.ICONS && ICONS.factory) || ''; }
function govIndexOf(govObj) {
  var i = GOVS.indexOf(govObj);
  if (i >= 0) return i;
  for (var j = 0; j < GOVS.length; j++) { if (govObj && GOVS[j].en === govObj.en) return j; }
  return 0;
}

var AdminStore = {
  // Build the editable dataset from whatever the site currently has loaded
  seedFromDefaults: function () {
    return {
      industries: INDUSTRIES.map(function (i) {
        return {
          id: i.id, en: i.en, ar: i.ar,
          iconKey: iconKeyFor(i.id), c1: i.g[0], c2: i.g[1],
          code: IND_CODE[i.id] || i.id.slice(0, 3).toUpperCase(),
          products: IND_PRODUCTS[i.id] || { en: [], ar: [] },
          caps: IND_CAPS[i.id] || { en: [], ar: [] },
          services: IND_SERVICES[i.id] || { en: [], ar: [] }
        };
      }),
      govs: GOVS.map(function (g) { return { en: g.en, ar: g.ar }; }),
      certs: CERTS.slice(),
      factories: FACTORIES.map(function (f) {
        return {
          id: f.id, industry: f.industry, govIndex: govIndexOf(f.gov),
          name: { en: f.name.en, ar: f.name.ar },
          desc: { en: f.desc.en, ar: f.desc.ar },
          yr: f.yr, moq: f.moq, emp: f.emp, phone: f.phone,
          exp: !!f.exp, featured: !!f.featured, certs: (f.certs || []).slice(),
          dailyCapacity: f.dailyCapacity, monthlyCapacity: f.monthlyCapacity,
          rating: f.rating, reviewCount: f.reviewCount,
          services: (f.services || []).map(function (s) { return { icon: s.icon, name: s.name }; }),
          keywords: f.keywords || ''
        };
      }),
      search: { fields: DEFAULT_SEARCH_FIELDS.slice() },
      filters: Object.assign({}, DEFAULT_FILTER_CONFIG)
    };
  },

  // Read saved data (or null if the admin hasn't saved anything yet)
  read: function () {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  },

  // Load the dataset the admin panel should edit (saved, or a fresh seed)
  load: function () {
    return this.read() || this.seedFromDefaults();
  },

  save: function (data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  },

  clear: function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
  },

  // Apply an admin dataset onto the live globals the pages read
  apply: function (data) {
    if (!data) return;

    if (Array.isArray(data.govs)) {
      GOVS.length = 0;
      data.govs.forEach(function (g) { GOVS.push({ en: g.en, ar: g.ar }); });
    }
    if (Array.isArray(data.certs)) {
      CERTS.length = 0;
      data.certs.forEach(function (c) { CERTS.push(c); });
    }
    if (Array.isArray(data.industries)) {
      INDUSTRIES.length = 0;
      data.industries.forEach(function (a) {
        INDUSTRIES.push({ id: a.id, en: a.en, ar: a.ar, icon: resolveIcon(a.iconKey), g: [a.c1, a.c2] });
        IND_CODE[a.id] = a.code || a.id.slice(0, 3).toUpperCase();
        IND_PRODUCTS[a.id] = a.products || { en: [], ar: [] };
        IND_CAPS[a.id] = a.caps || { en: [], ar: [] };
        IND_SERVICES[a.id] = a.services || { en: [], ar: [] };
      });
    }
    if (Array.isArray(data.factories)) {
      FACTORIES.length = 0;
      data.factories.forEach(function (a) {
        var g = GOVS[a.govIndex] || GOVS[0];
        FACTORIES.push({
          id: a.id, industry: a.industry, gov: g, govIndex: a.govIndex,
          name: a.name, desc: a.desc, yr: Number(a.yr) || 0, moq: Number(a.moq) || 0,
          emp: a.emp, phone: a.phone, exp: !!a.exp, featured: !!a.featured,
          certs: a.certs || [], dailyCapacity: Number(a.dailyCapacity) || 0,
          monthlyCapacity: Number(a.monthlyCapacity) || 0,
          rating: Number(a.rating) || 0, reviewCount: Number(a.reviewCount) || 0,
          services: a.services || [], keywords: a.keywords || ''
        });
      });
    }
    if (data.search && Array.isArray(data.search.fields)) {
      window.SEARCH_CONFIG = { fields: data.search.fields.slice() };
    }
    if (data.filters) {
      window.FILTER_CONFIG = Object.assign({}, DEFAULT_FILTER_CONFIG, data.filters);
    }
  }
};

// On every public page: apply saved data if it exists; otherwise make sure the
// default factories carry a govIndex so the governorate filter works.
(function () {
  var saved = AdminStore.read();
  if (saved) {
    AdminStore.apply(saved);
  } else {
    FACTORIES.forEach(function (f) { if (f.govIndex == null) f.govIndex = govIndexOf(f.gov); });
  }
})();
