// ============================================
// AUTH — public user accounts (Supabase Auth)
// ============================================
//
// Handles visitor sign-up / log-in / log-out and their profile. Two account
// types: "user" (buyer/trader) and "factory" (factory owner; starts unverified).
// Admin login is separate (admin.html) — this is for site visitors.
//
// The session is cached in localStorage so the nav can show "My Account"
// instantly. All secure reads/writes go to Supabase with the user's token.

(function () {
  var KEY = 'sonnaUser';
  window.AUTH = { session: null, profile: null };

  function readCache() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function writeCache() { try { localStorage.setItem(KEY, JSON.stringify({ session: AUTH.session, profile: AUTH.profile })); } catch (e) {} }
  function clearCache() { try { localStorage.removeItem(KEY); } catch (e) {} AUTH.session = null; AUTH.profile = null; }

  var cached = readCache();
  if (cached) { AUTH.session = cached.session; AUTH.profile = cached.profile; }

  function remoteReady() { return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY); }
  function AL(en, ar) { return (window.LANG === 'ar') ? ar : en; }
  function sessionFrom(j, email) {
    var user = j.user || j;
    var exp = j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600));
    return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: exp,
             user: { id: user.id, email: user.email || email, user_metadata: user.user_metadata || {} } };
  }

  // Valid access token, refreshing via the refresh token if it has (nearly) expired
  function freshToken() {
    var s = AUTH.session;
    if (!s || !s.access_token) return Promise.reject(new Error('not logged in'));
    if (s.expires_at && (Date.now() / 1000) < s.expires_at - 60) return Promise.resolve(s.access_token);
    if (!s.refresh_token) return Promise.reject(new Error('session expired'));
    return fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.access_token) throw new Error('session expired');
        AUTH.session = sessionFrom(res.j, s.user.email); writeCache(); return AUTH.session.access_token;
      });
  }

  function restHeaders(tok, extra) {
    return Object.assign({ apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, extra || {});
  }
  function fetchProfile() {
    return freshToken().then(function (tok) {
      return fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + AUTH.session.user.id + '&select=*', { headers: restHeaders(tok) })
        .then(function (r) { return r.json(); }).then(function (rows) { return (rows && rows[0]) || null; });
    });
  }
  function createProfile(type, fields, email) {
    return freshToken().then(function (tok) {
      var row = Object.assign({ id: AUTH.session.user.id, email: email, account_type: type }, fields || {});
      return fetch(SUPABASE_URL + '/rest/v1/profiles', {
        method: 'POST', headers: restHeaders(tok, { Prefer: 'return=representation' }), body: JSON.stringify(row)
      }).then(function (r) { return r.json(); }).then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
    });
  }
  function ensureProfile() {
    return fetchProfile().then(function (p) {
      if (p) { AUTH.profile = p; writeCache(); return p; }
      var meta = (AUTH.session.user && AUTH.session.user.user_metadata) || {};
      var fields = {};
      ['full_name', 'phone', 'company', 'city', 'website', 'bio'].forEach(function (k) { if (meta[k] != null) fields[k] = meta[k]; });
      return createProfile(meta.account_type || 'user', fields, AUTH.session.user.email).then(function (np) { AUTH.profile = np; writeCache(); return np; });
    });
  }

  window.Auth = {
    ready: remoteReady,
    isLoggedIn: function () { return !!(AUTH.session && AUTH.session.access_token); },
    user: function () { return AUTH.session ? AUTH.session.user : null; },
    profile: function () { return AUTH.profile; },
    token: freshToken,
    logout: function () { clearCache(); window.location.href = 'index.html'; },

    login: function (email, password) {
      return fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.access_token) throw new Error(res.j.error_description || res.j.msg || AL('Wrong email or password.', 'بريد إلكتروني أو كلمة مرور غير صحيحة.'));
          AUTH.session = sessionFrom(res.j, email); writeCache();
          return ensureProfile();
        });
    },

    signup: function (email, password, accountType, fields) {
      return fetch(SUPABASE_URL + '/auth/v1/signup', {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, data: Object.assign({ account_type: accountType }, fields || {}) })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.msg || res.j.error_description || res.j.error || AL('Sign up failed', 'فشل إنشاء الحساب'));
          if (res.j.access_token) {  // email confirmation disabled → logged in now
            AUTH.session = sessionFrom(res.j, email); writeCache();
            return createProfile(accountType, fields, email).then(function (p) { AUTH.profile = p; writeCache(); return { needConfirm: false }; });
          }
          return { needConfirm: true };  // must confirm email, then log in
        });
    },

    updateProfile: function (fields) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + AUTH.session.user.id, {
          method: 'PATCH', headers: restHeaders(tok, { Prefer: 'return=representation' }), body: JSON.stringify(fields)
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.json(); })
          .then(function (rows) { AUTH.profile = Array.isArray(rows) ? rows[0] : rows; writeCache(); return AUTH.profile; });
      });
    },
    refreshProfile: function () { return ensureProfile(); }
  };

  // ---------- Login / Sign-up modal ----------
  window.openAuthModal = function (mode) {
    if (!Auth.ready()) { alert('Accounts are not configured yet.'); return; }
    mode = mode || 'login';
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.addEventListener('click', function (e) { if (e.target === bd) bd.remove(); });
    document.body.appendChild(bd);
    renderAuth(bd, mode);
  };

  function field(label, inputHTML) { return '<div class="form-field full"><label>' + label + '</label>' + inputHTML + '</div>'; }

  function renderAuth(bd, mode) {
    var isSignup = mode === 'signup';
    bd.innerHTML =
      '<div class="modal">' +
        '<h2>' + (isSignup ? t('au_signup_title') : t('au_login_title')) + '</h2>' +
        (isSignup ? '<p class="sub">' + t('au_signup_sub') + '</p>' : '') +
        '<div class="au-err" id="auErr" style="display:none"></div>' +
        '<div class="form-grid">' +
          (isSignup ? field(t('au_name'), '<input id="au_name" type="text">') : '') +
          field(t('au_email'), '<input id="au_email" type="email">') +
          field(t('au_password'), '<input id="au_password" type="password">') +
          (isSignup ? field(t('au_phone') + ' <span class="opt">(' + t('optional') + ')</span>', '<input id="au_phone" type="text">') : '') +
        '</div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-ghost" id="auSwitch">' + (isSignup ? t('au_have') : t('au_no')) + '</button>' +
          '<button class="btn btn-primary" id="auSubmit">' + (isSignup ? t('au_submit_signup') : t('au_submit_login')) + '</button>' +
        '</div>' +
      '</div>';
    bd.querySelector('#auSwitch').onclick = function () { renderAuth(bd, isSignup ? 'login' : 'signup'); };
    bd.querySelector('#auSubmit').onclick = function () { submitAuth(bd, mode); };
  }

  function submitAuth(bd, mode) {
    var err = bd.querySelector('#auErr');
    var show = function (m) { err.textContent = m; err.style.display = 'block'; };
    var v = function (id) { var el = bd.querySelector('#' + id); return el ? el.value.trim() : ''; };
    var email = v('au_email'), pw = v('au_password');
    if (!email || !pw) { show(AL('Enter your email and password.', 'أدخل البريد الإلكتروني وكلمة المرور.')); return; }
    var btn = bd.querySelector('#auSubmit'); btn.textContent = '…'; btn.disabled = true;
    var done = function (e) { btn.disabled = false; show(e.message || String(e)); };

    if (mode === 'login') {
      Auth.login(email, pw).then(function () { window.location.reload(); }).catch(done);
    } else {
      var fields = { full_name: v('au_name'), phone: v('au_phone') };
      Auth.signup(email, pw, 'user', fields).then(function (r) {
        if (r.needConfirm) { bd.querySelector('.modal').innerHTML = '<h2>' + t('au_signup_title') + '</h2><p class="sub">' + t('au_confirm') + '</p><div class="modal-actions"><button class="btn btn-primary" onclick="this.closest(\'.modal-backdrop\').remove()">OK</button></div>'; }
        else { window.location.href = 'account.html'; }   // land in the dashboard
      }).catch(done);
    }
  }

  // Gate body for members-only pages (factories / requests)
  window.Auth.gateHTML = function () {
    return '<div class="container" style="padding:64px 24px;text-align:center;max-width:520px">' +
      '<span class="ci" style="width:56px;height:56px;background:var(--teal-tint);color:var(--teal);border-radius:16px;display:inline-grid;place-items:center;margin-bottom:14px">' + ICONS.user + '</span>' +
      '<h1 style="margin-bottom:10px">' + t('gate_title') + '</h1>' +
      '<p class="muted">' + t('gate_msg') + '</p>' +
      '<div style="margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
        '<button class="btn btn-primary" onclick="openAuthModal(\'signup\')">' + t('signup') + '</button>' +
        '<button class="btn btn-ghost" onclick="openAuthModal(\'login\')">' + t('login') + '</button>' +
      '</div>' +
    '</div>';
  };
})();
