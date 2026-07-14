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
// Reverse lookup: given a rendered SVG string, find its icon key (for seeding)
function iconKeyFromSvg(svg) {
  if (window.ICONS) { for (var k in ICONS) { if (ICONS[k] === svg) return k; } }
  return 'clipboard';
}
function cloneList(o) { return { en: (o && o.en ? o.en.slice() : []), ar: (o && o.ar ? o.ar.slice() : []) }; }
// Services stored per-factory as bilingual name lists. Seed from the factory's
// current services, translating each English name via the sector's list.
function seedServices(f) {
  var en = [], ar = [];
  var sset = (typeof IND_SERVICES !== 'undefined' && IND_SERVICES[f.industry]) ? IND_SERVICES[f.industry] : { en: [], ar: [] };
  (f.services || []).forEach(function (s) {
    en.push(s.name);
    var arName = s.name;
    for (var i = 0; i < (sset.en || []).length; i++) { if (sset.en[i].name === s.name) { arName = (sset.ar[i] || sset.en[i]).name; break; } }
    ar.push(arName);
  });
  return { en: en, ar: ar };
}
// Accept either the new {en:[],ar:[]} form or the old [{icon,name}] form
function normalizeServices(s) {
  if (Array.isArray(s)) { var n = s.map(function (x) { return x && x.name ? x.name : x; }); return { en: n, ar: n }; }
  if (s && (s.en || s.ar)) return { en: s.en || [], ar: s.ar || [] };
  return { en: [], ar: [] };
}
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
          services: seedServices(f),
          products: cloneList(IND_PRODUCTS[f.industry]),
          capabilities: cloneList(IND_CAPS[f.industry]),
          hours: { en: '', ar: '' },
          keywords: f.keywords || '',
          whatsapp: '', email: '', website: '', facebook: '', instagram: '', linkedin: '',
          logo: f.logo || '', cover: f.cover || '', media: (f.media || []).slice()
        };
      }),
      requests: (typeof REQUESTS !== 'undefined' ? REQUESTS : []).map(function (r) {
        return {
          id: r.id, iconKey: iconKeyFromSvg(r.icon), days: r.days, qty: r.qty, budget: r.budget || '',
          title: { en: r.title.en, ar: r.title.ar }, desc: { en: r.desc.en, ar: r.desc.ar },
          material: { en: (r.material || {}).en || '', ar: (r.material || {}).ar || '' },
          gov: r.gov, by: { en: (r.by || {}).en || '', ar: (r.by || {}).ar || '' }, contact: r.contact || ''
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
          services: normalizeServices(a.services), keywords: a.keywords || '',
          products: a.products || { en: [], ar: [] }, capabilities: a.capabilities || { en: [], ar: [] },
          hours: a.hours || { en: '', ar: '' },
          whatsapp: a.whatsapp || '', email: a.email || '', website: a.website || '',
          facebook: a.facebook || '', instagram: a.instagram || '', linkedin: a.linkedin || '',
          logo: a.logo || '', cover: a.cover || '', media: a.media || [],
          verified: true, userSubmitted: false   // admin-managed factories are verified
        });
      });
    }
    if (Array.isArray(data.requests)) {
      REQUESTS.length = 0;
      data.requests.forEach(function (a) {
        REQUESTS.push({
          id: a.id, icon: resolveIcon(a.iconKey), days: Number(a.days) || 0, qty: a.qty,
          budget: a.budget || null, title: a.title, desc: a.desc,
          material: a.material || { en: '', ar: '' }, gov: Number(a.gov) || 0,
          by: a.by || { en: '', ar: '' }, contact: a.contact || ''
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

// Make default factories carry a govIndex so the governorate filter works
function normalizeDefaults() {
  FACTORIES.forEach(function (f) { if (f.govIndex == null) f.govIndex = govIndexOf(f.gov); });
}

/* ---------- Supabase (live database) ---------- */
AdminStore.remoteEnabled = function () { return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY); };

// Read the single content row from Supabase (public — no login needed)
AdminStore.fetchRemote = function () {
  if (!this.remoteEnabled()) return Promise.reject(new Error('no config'));
  var url = SUPABASE_URL + '/rest/v1/' + (window.SUPABASE_TABLE || 'site_content') + '?id=eq.1&select=data';
  return fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } })
    .then(function (r) { if (!r.ok) throw new Error('fetch ' + r.status); return r.json(); })
    .then(function (rows) { return (rows && rows[0]) ? rows[0].data : null; });
};

// Write the content row (needs a logged-in admin's access token)
AdminStore.saveRemote = function (data, token) {
  if (!this.remoteEnabled()) return Promise.reject(new Error('no config'));
  var url = SUPABASE_URL + '/rest/v1/' + (window.SUPABASE_TABLE || 'site_content') + '?id=eq.1';
  return fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ data: data, updated_at: new Date().toISOString() })
  }).then(function (r) { if (!r.ok) throw new Error('save ' + r.status); return true; });
};

// Upload a file to Supabase Storage (admin only); resolves to its public URL
AdminStore.uploadFile = function (file, token) {
  if (!this.remoteEnabled()) return Promise.reject(new Error('no config'));
  var bucket = window.SUPABASE_BUCKET || 'media';
  var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var path = 'factory/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
  return fetch(SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
    body: file
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('upload ' + r.status)); });
    return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
  });
};

// Upload any file to Supabase Storage under a given path prefix, resolving to
// its public URL. Works for any logged-in user (see storage RLS in the SQL).
AdminStore.uploadPublic = function (file, token, prefix) {
  if (!this.remoteEnabled()) return Promise.reject(new Error('no config'));
  var bucket = window.SUPABASE_BUCKET || 'media';
  var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var path = (prefix || 'misc') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
  return fetch(SUPABASE_URL + '/storage/v1/object/' + bucket + '/' + path, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' },
    body: file
  }).then(function (r) {
    if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('upload ' + r.status)); });
    return SUPABASE_URL + '/storage/v1/object/public/' + bucket + '/' + path;
  });
};

// ---- Reviews & ratings ----
// All factory rating summaries (avg + count), keyed by factory id.
AdminStore.fetchRatings = function () {
  if (!this.remoteEnabled()) return Promise.resolve({});
  return fetch(SUPABASE_URL + '/rest/v1/factory_ratings?select=*', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (rows) { var m = {}; (rows || []).forEach(function (x) { m[x.factory_id] = { avg: Number(x.avg) || 0, cnt: Number(x.cnt) || 0 }; }); return m; })
    .catch(function () { return {}; });
};

// Overlay real review aggregates onto the live FACTORIES list.
AdminStore.applyRatings = function (map) {
  if (!map) return;
  FACTORIES.forEach(function (f) {
    var r = map[f.id];
    if (r) { f.rating = r.avg; f.reviewCount = r.cnt; }
    else { f.reviewCount = 0; }   // no reviews yet
  });
};

// Reviews for one factory (newest first).
AdminStore.fetchReviews = function (factoryId) {
  if (!this.remoteEnabled()) return Promise.resolve([]);
  return fetch(SUPABASE_URL + '/rest/v1/reviews?select=*&factory_id=eq.' + encodeURIComponent(factoryId) + '&order=created_at.desc', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } })
    .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
};

// Aggregate response stats for a factory owner (rate %, avg minutes, threads).
AdminStore.fetchResponseStats = function (ownerId) {
  if (!this.remoteEnabled() || !ownerId) return Promise.resolve(null);
  return fetch(SUPABASE_URL + '/rest/v1/rpc/factory_response_stats', {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_owner: ownerId })
  }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
};

// ---- Page view counts (once per account) ----
// Records a view (if logged in) and returns the item's total count. Pass the
// user's access token to have the view counted; anon calls just read the total.
AdminStore.recordView = function (type, id, token) {
  if (!this.remoteEnabled()) return Promise.resolve(null);
  return fetch(SUPABASE_URL + '/rest/v1/rpc/record_view', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (token || SUPABASE_ANON_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_type: type, p_id: String(id) })
  }).then(function (r) { if (!r.ok) throw new Error('view ' + r.status); return r.json(); })
    .then(function (n) { return (typeof n === 'number') ? n : Number(n) || 0; })
    .catch(function () { return null; });
};

// Read-only total view count (does not record a view).
AdminStore.fetchViewCount = function (type, id) {
  if (!this.remoteEnabled()) return Promise.resolve(0);
  return fetch(SUPABASE_URL + '/rest/v1/rpc/get_view_count', {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_type: type, p_id: String(id) })
  }).then(function (r) { return r.ok ? r.json() : 0; }).then(function (n) { return Number(n) || 0; }).catch(function () { return 0; });
};

// How many users shortlisted a factory (owner dashboard metric).
AdminStore.fetchSaveCount = function (factoryId, token) {
  if (!this.remoteEnabled()) return Promise.resolve(0);
  return fetch(SUPABASE_URL + '/rest/v1/rpc/factory_save_count', {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (token || SUPABASE_ANON_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_factory: factoryId })
  }).then(function (r) { return r.ok ? r.json() : 0; }).then(function (n) { return Number(n) || 0; }).catch(function () { return 0; });
};

// ---- Manufacturing requests (the public 'requests' table) ----
AdminStore.fetchRequests = function () {
  if (!this.remoteEnabled()) return Promise.resolve([]);
  return fetch(SUPABASE_URL + '/rest/v1/requests?select=*&order=created_at.desc', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } })
    .then(function (r) { if (!r.ok) throw new Error('requests ' + r.status); return r.json(); })
    .catch(function (e) { if (window.console) console.warn('fetchRequests failed:', e.message || e); return []; });
};
AdminStore.getRequest = function (id) {
  if (!this.remoteEnabled()) return Promise.resolve(null);
  return fetch(SUPABASE_URL + '/rest/v1/requests?select=*&id=eq.' + encodeURIComponent(id), { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } })
    .then(function (r) { if (!r.ok) throw new Error('request ' + r.status); return r.json(); })
    .then(function (rows) { return (rows && rows[0]) || null; })
    .catch(function () { return null; });
};

// Best-effort delete of a previously uploaded file (by its public URL)
AdminStore.deleteFile = function (publicUrl, token) {
  if (!this.remoteEnabled() || !publicUrl) return Promise.resolve();
  var marker = '/storage/v1/object/public/';
  var i = publicUrl.indexOf(marker);
  if (i < 0) return Promise.resolve();
  var rest = publicUrl.slice(i + marker.length); // bucket/path...
  return fetch(SUPABASE_URL + '/storage/v1/object/' + rest, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  }).catch(function () { });
};

// ---- User-submitted factories (the 'factories' table) ----
var FACTORIES_URL = function () { return SUPABASE_URL + '/rest/v1/factories'; };

// Convert a factories-table row into the runtime factory shape used by the site
AdminStore.rowToFactory = function (row) {
  var g = GOVS[row.gov] || GOVS[0];
  var d = row.data || {};
  return {
    id: row.id, industry: row.sector, gov: g, govIndex: row.gov,
    name: d.name || { en: row.name, ar: row.name },
    desc: d.desc || { en: '', ar: '' },
    yr: Number(d.yr) || 0, moq: Number(d.moq) || 0, emp: d.emp || '', phone: d.phone || '',
    exp: !!d.exp, featured: !!d.featured,
    certs: d.certs || [], dailyCapacity: Number(d.dailyCapacity) || 0, monthlyCapacity: Number(d.monthlyCapacity) || 0,
    rating: Number(d.rating) || 0, reviewCount: Number(d.reviewCount) || 0,
    services: normalizeServices(d.services), products: d.products || { en: [], ar: [] }, capabilities: d.capabilities || { en: [], ar: [] },
    hours: d.hours || { en: '', ar: '' }, keywords: d.keywords || '',
    whatsapp: d.whatsapp || '', email: d.email || '', website: d.website || '',
    facebook: d.facebook || '', instagram: d.instagram || '', linkedin: d.linkedin || '',
    logo: d.logo || '', cover: d.cover || '', media: d.media || [],
    verified: !!row.verified, verificationStatus: row.verification_status || (row.verified ? 'visited' : 'unverified'),
    userSubmitted: true, ownerId: row.owner
  };
};

// Public columns only — never request verification info here (it lives in a
// separate, admin-only table now). verification_status only exists once
// payments.sql has been run, so it's requested optionally (see below).
var FACTORY_PUBLIC_COLS = 'id,owner,name,sector,gov,data,verified,verification_requested,deletion_requested,created_at';
var FACTORY_PUBLIC_COLS_EXT = 'id,owner,name,sector,gov,data,verified,verification_status,verification_requested,deletion_requested,created_at';

// Fetch all rows from the factories table (public read). Tries the extended
// column set (with verification_status); if that column doesn't exist yet
// (payments.sql not run), it transparently falls back to the base set.
AdminStore.fetchFactoryRows = function () {
  if (!this.remoteEnabled()) return Promise.resolve([]);
  var hdrs = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY };
  var url = function (cols) { return FACTORIES_URL() + '?select=' + cols + '&order=created_at.desc'; };
  return fetch(url(FACTORY_PUBLIC_COLS_EXT), { headers: hdrs })
    .then(function (r) {
      if (r.ok) return r.json();
      // Missing column (or any 4xx) → retry with the guaranteed base columns.
      return fetch(url(FACTORY_PUBLIC_COLS), { headers: hdrs })
        .then(function (r2) { if (!r2.ok) throw new Error('factories ' + r2.status); return r2.json(); });
    })
    .catch(function (e) { if (window.console) console.warn('fetchFactoryRows failed:', e.message || e); return []; });
};

// Is the logged-in admin actually on the allowlist? (admin.html gate)
AdminStore.amIAdmin = function (token) {
  if (!this.remoteEnabled()) return Promise.resolve(false);
  return fetch(SUPABASE_URL + '/rest/v1/rpc/am_i_admin', {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}'
  }).then(function (r) { return r.ok ? r.json() : false; }).then(function (v) { return !!v; }).catch(function () { return false; });
};

// Admin-only: verification submissions (name/phone/location), keyed by factory id.
AdminStore.fetchVerifications = function (token) {
  if (!this.remoteEnabled()) return Promise.resolve({});
  return fetch(SUPABASE_URL + '/rest/v1/factory_verifications?select=*', {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
  }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
    var map = {}; (rows || []).forEach(function (v) { map[v.factory_id] = v; }); return map;
  }).catch(function () { return {}; });
};

// Append user factories into the live FACTORIES list (skip ids already present).
// Both verified and unverified submissions are listed in the directory, but each
// row carries its `verified` flag: unverified ones are shown locked (name +
// sector only) by the card/detail views, and unlock fully once verified.
AdminStore.appendUserFactories = function (rows) {
  var self = this;
  (rows || []).forEach(function (row) {
    if (!FACTORIES.some(function (f) { return String(f.id) === String(row.id); })) {
      FACTORIES.push(self.rowToFactory(row));
    }
  });
};

function withTimeout(p, ms, fallback) {
  return new Promise(function (resolve) {
    var done = false; var t = setTimeout(function () { if (!done) { done = true; resolve(fallback); } }, ms);
    p.then(function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } }).catch(function () { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
  });
}

// Apply remote data if usable, else fall back to the local cache, else defaults
AdminStore.applyDataOrFallback = function (remote) {
  if (remote && (remote.factories || remote.industries)) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)); } catch (e) { }
    this.apply(remote);
    return 'remote';
  }
  var cached = this.read();
  if (cached) { this.apply(cached); return 'cache'; }
  normalizeDefaults();
  return 'default';
};

// Public pages call this before rendering: get the latest data from Supabase,
// but never hang or break — fall back to cache/built-in data if it's slow/down.
AdminStore.bootstrap = function () {
  var self = this;
  if (!self.remoteEnabled()) { self.applyDataOrFallback(null); return Promise.resolve('default'); }
  var contentP = withTimeout(self.fetchRemote(), 3500, null);
  var facsP = withTimeout(self.fetchFactoryRows(), 3500, []);
  var ratingsP = withTimeout(self.fetchRatings(), 3500, {});
  return Promise.all([contentP, facsP, ratingsP]).then(function (res) {
    self.applyDataOrFallback(res[0]);
    self.appendUserFactories(res[1] || []);
    self.applyRatings(res[2] || {});
    return true;
  });
};

// Snapshot the pristine built-in data now, before any cache/remote data is
// applied, so "reset to defaults" can truly restore it.
AdminStore._defaultsSnapshot = JSON.stringify(AdminStore.seedFromDefaults());
AdminStore.defaults = function () { return JSON.parse(this._defaultsSnapshot); };

// Synchronous safety net so globals are never empty even if a page forgets to
// wait for bootstrap(): apply the local cache or normalize the defaults now.
(function () {
  var saved = AdminStore.read();
  if (saved) AdminStore.apply(saved); else normalizeDefaults();
})();
