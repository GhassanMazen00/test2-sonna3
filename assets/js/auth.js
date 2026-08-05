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
             user: { id: user.id, email: user.email || email,
                     email_confirmed_at: user.email_confirmed_at || null,
                     confirmed_at: user.confirmed_at || null,
                     user_metadata: user.user_metadata || {} } };
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

    login: function (email, password, captchaToken) {
      var body = { email: email, password: password };
      if (captchaToken) body.gotrue_meta_security = { captcha_token: captchaToken };
      return fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.access_token) throw new Error(res.j.error_description || res.j.msg || AL('Wrong email or password.', 'بريد إلكتروني أو كلمة مرور غير صحيحة.'));
          AUTH.session = sessionFrom(res.j, email); writeCache();
          return ensureProfile();
        });
    },

    signup: function (email, password, accountType, fields, captchaToken) {
      var body = { email: email, password: password, data: Object.assign({ account_type: accountType }, fields || {}) };
      if (captchaToken) body.gotrue_meta_security = { captcha_token: captchaToken };
      return fetch(SUPABASE_URL + '/auth/v1/signup', {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
    refreshProfile: function () { return ensureProfile(); },

    // ---- The signed-in user's factory (the 'factories' table) ----
    myFactory: function () {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/factories?owner=eq.' + AUTH.session.user.id + '&select=*&order=created_at.desc', { headers: restHeaders(tok) })
          .then(function (r) { if (!r.ok) throw new Error('factory ' + r.status); return r.json(); })
          .then(function (rows) { return (rows && rows[0]) || null; });
      });
    },
    // True only when the signed-in user owns a live VERIFIED factory (paid/
    // verified, whether the on-site visit is still pending or already done, and
    // NOT pending deletion). Used to gate who may contact buyers who post
    // requests. A factory the owner has asked to delete no longer counts.
    isVerifiedOwner: function () {
      if (!this.isLoggedIn()) return Promise.resolve(false);
      return this.myFactory().then(function (f) {
        return !!(f && f.verified && !f.deletion_requested);
      }).catch(function () { return false; });
    },
    // The subscription tier of the signed-in verified owner ('' if none). Used
    // to gate tier perks like how soon they can contact a new request.
    myVerifiedPlan: function () {
      if (!this.isLoggedIn()) return Promise.resolve('');
      return this.myFactory().then(function (f) {
        return (f && f.verified && !f.deletion_requested && f.plan && f.plan !== 'none') ? f.plan : '';
      }).catch(function () { return ''; });
    },
    createFactory: function (name, sector, gov) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/factories', {
          method: 'POST', headers: restHeaders(tok, { Prefer: 'return=representation' }),
          body: JSON.stringify({ owner: AUTH.session.user.id, name: name, sector: sector, gov: gov, data: {}, verified: false })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.json(); })
          .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      });
    },
    updateMyFactory: function (id, patch) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/factories?id=eq.' + id, {
          method: 'PATCH', headers: restHeaders(tok, { Prefer: 'return=representation' }), body: JSON.stringify(patch)
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.json(); })
          .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      });
    },

    // ---- Manufacturing requests (owned by the signed-in user) ----
    displayName: function () {
      var p = AUTH.profile || {};
      var email = AUTH.session && AUTH.session.user ? AUTH.session.user.email : '';
      return p.full_name || (email ? String(email).split('@')[0] : '') || 'User';
    },
    uploadRequestMedia: function (file) {
      return freshToken().then(function (tok) { return AdminStore.uploadPublic(file, tok, 'requests'); });
    },
    createRequest: function (fields) {
      return freshToken().then(function (tok) {
        var row = Object.assign({
          owner: AUTH.session.user.id,
          owner_name: window.Auth.displayName(),
          owner_company: (AUTH.profile && AUTH.profile.company) || null
        }, fields || {});
        return fetch(SUPABASE_URL + '/rest/v1/requests', {
          method: 'POST', headers: restHeaders(tok, { Prefer: 'return=representation' }), body: JSON.stringify(row)
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.json(); })
          .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      });
    },
    myRequests: function () {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/requests?owner=eq.' + AUTH.session.user.id + '&select=*&order=created_at.desc', { headers: restHeaders(tok) })
          .then(function (r) { if (!r.ok) throw new Error('requests ' + r.status); return r.json(); });
      });
    },
    updateRequest: function (id, fields) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/requests?id=eq.' + id, {
          method: 'PATCH', headers: restHeaders(tok, { Prefer: 'return=representation' }), body: JSON.stringify(fields || {})
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.json(); })
          .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      });
    },
    deleteRequest: function (id) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/requests?id=eq.' + id, { method: 'DELETE', headers: restHeaders(tok) })
          .then(function (r) { if (!r.ok) throw new Error('delete ' + r.status); return true; });
      });
    },

    // Submit a verification request: store the private info in the admin-only
    // factory_verifications table, then flag the factory as requested.
    submitVerification: function (factoryId, info) {
      var self = this;
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/factory_verifications', {
          method: 'POST',
          headers: restHeaders(tok, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({ factory_id: factoryId, name: info.name, number: info.number, location: info.location, submitted_at: info.submitted_at })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      }).then(function () { return self.updateMyFactory(factoryId, { verification_requested: true }); });
    },

    // Flag the user's factory page for deletion (an admin removes it).
    requestFactoryDeletion: function (id) {
      return this.updateMyFactory(id, { deletion_requested: true });
    },

    // ---- RFQ (request for quote) → quotes ----
    createRFQ: function (factory, fields) {
      // factory: { id, name, ownerId }
      return freshToken().then(function (tok) {
        var row = Object.assign({
          buyer: AUTH.session.user.id, buyer_name: window.Auth.displayName(),
          factory_id: factory.id, factory_name: factory.name, factory_owner: factory.ownerId
        }, fields || {});
        return fetch(SUPABASE_URL + '/rest/v1/rfqs', {
          method: 'POST', headers: restHeaders(tok, { Prefer: 'return=representation' }), body: JSON.stringify(row)
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.json(); })
          .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      });
    },
    myRFQs: function () {   // as a buyer
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rfqs?select=*&buyer=eq.' + AUTH.session.user.id + '&order=created_at.desc', { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; });
      }).catch(function () { return []; });
    },
    incomingRFQs: function () {   // as a factory owner
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rfqs?select=*&factory_owner=eq.' + AUTH.session.user.id + '&order=created_at.desc', { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; });
      }).catch(function () { return []; });
    },
    rfqQuotes: function (rfqId) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/quotes?select=*&rfq_id=eq.' + encodeURIComponent(rfqId) + '&order=created_at.desc', { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; });
      }).catch(function () { return []; });
    },
    // How many quotes the signed-in owner has sent since the 1st of this month
    // (used to enforce the Verified plan's monthly RFQ-reply cap).
    quotesThisMonth: function () {
      var now = new Date();
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/quotes?select=id&factory_owner=eq.' + AUTH.session.user.id + '&created_at=gte.' + encodeURIComponent(monthStart), { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) { return (rows || []).length; });
      }).catch(function () { return 0; });
    },
    sendQuote: function (rfqId, fields) {
      var self = this;
      return freshToken().then(function (tok) {
        var row = Object.assign({ rfq_id: rfqId, factory_owner: AUTH.session.user.id }, fields || {});
        return fetch(SUPABASE_URL + '/rest/v1/quotes', {
          method: 'POST', headers: restHeaders(tok, { Prefer: 'return=minimal' }), body: JSON.stringify(row)
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      }).then(function () { return self.setRFQStatus(rfqId, 'quoted'); });
    },
    // Buyer accepts or declines a quote (accepting closes the RFQ).
    setQuoteStatus: function (quoteId, status) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rpc/set_quote_status', {
          method: 'POST', headers: restHeaders(tok),
          body: JSON.stringify({ p_quote: quoteId, p_status: status })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      });
    },
    setRFQStatus: function (rfqId, status) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rfqs?id=eq.' + rfqId, {
          method: 'PATCH', headers: restHeaders(tok, { Prefer: 'return=minimal' }), body: JSON.stringify({ status: status })
        }).then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return true; });
      });
    },

    // ---- Reports ----
    submitReport: function (fields) {
      return freshToken().then(function (tok) {
        var row = Object.assign({ reporter: AUTH.session.user.id, reporter_name: window.Auth.displayName() }, fields || {});
        return fetch(SUPABASE_URL + '/rest/v1/reports', {
          method: 'POST', headers: restHeaders(tok, { Prefer: 'return=minimal' }), body: JSON.stringify(row)
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      });
    },

    // ---- Favorites / shortlist ----
    myFavorites: function () {
      if (!this.isLoggedIn()) return Promise.resolve([]);
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/favorites?select=factory_id&user_id=eq.' + AUTH.session.user.id, { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { return (rows || []).map(function (x) { return x.factory_id; }); });
      }).catch(function () { return []; });
    },
    addFavorite: function (factoryId) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/favorites', {
          method: 'POST', headers: restHeaders(tok, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({ user_id: AUTH.session.user.id, factory_id: factoryId })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      });
    },
    removeFavorite: function (factoryId) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/favorites?user_id=eq.' + AUTH.session.user.id + '&factory_id=eq.' + factoryId, { method: 'DELETE', headers: restHeaders(tok) })
          .then(function (r) { if (!r.ok) throw new Error('delete ' + r.status); return true; });
      });
    },

    // Can I review this factory? Requires a two-way conversation: I messaged the
    // owner AND the owner replied. (Mirrors the RLS rule.)
    canReview: function (ownerId) {
      if (!ownerId || !this.isLoggedIn()) return Promise.resolve(false);
      var me = AUTH.session.user.id;
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/messages?select=sender,recipient&or=(and(sender.eq.' + me + ',recipient.eq.' + ownerId + '),and(sender.eq.' + ownerId + ',recipient.eq.' + me + '))', { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) {
            var sent = false, replied = false;
            (rows || []).forEach(function (m) {
              if (String(m.sender) === String(me)) sent = true;
              if (String(m.sender) === String(ownerId)) replied = true;
            });
            return sent && replied;
          });
      }).catch(function () { return false; });
    },
    // Upload a CSV/PDF quote attachment; resolves to its public URL.
    uploadQuoteFile: function (file) {
      return freshToken().then(function (tok) { return AdminStore.uploadPublic(file, tok, 'quotes'); });
    },
    // Upload a factory logo/cover/gallery file; resolves to its public URL.
    uploadFactoryMedia: function (file) {
      return freshToken().then(function (tok) { return AdminStore.uploadPublic(file, tok, 'factory'); });
    },

    // My own review of a factory, if any.
    myReview: function (factoryId) {
      if (!this.isLoggedIn()) return Promise.resolve(null);
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/reviews?select=*&factory_id=eq.' + encodeURIComponent(factoryId) + '&reviewer=eq.' + AUTH.session.user.id, { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { return (rows && rows[0]) || null; });
      }).catch(function () { return null; });
    },

    // Create or update my review (upsert on the factory_id+reviewer unique key).
    submitReview: function (factoryId, rating, body) {
      return freshToken().then(function (tok) {
        var row = { factory_id: factoryId, reviewer: AUTH.session.user.id, reviewer_name: window.Auth.displayName(), rating: rating, body: body || '' };
        return fetch(SUPABASE_URL + '/rest/v1/reviews', {
          method: 'POST', headers: restHeaders(tok, { Prefer: 'resolution=merge-duplicates,return=representation' }), body: JSON.stringify(row)
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.json(); })
          .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
      });
    },

    // Permanently delete the signed-in user's account and all their data.
    deleteAccount: function () {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rpc/delete_own_account', {
          method: 'POST', headers: restHeaders(tok), body: '{}'
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      }).then(function () { clearCache(); return true; });
    },

    // ---- Push notifications (native app) ----
    // Store this device's FCM token against the signed-in user so the
    // send-push edge function can reach them. No-op when logged out (the RPC
    // itself also guards on auth.uid()).
    registerPushToken: function (token, platform) {
      if (!this.isLoggedIn() || !token) return Promise.resolve(false);
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rpc/register_device_token', {
          method: 'POST', headers: restHeaders(tok),
          body: JSON.stringify({ p_token: token, p_platform: platform || 'unknown' })
        }).then(function (r) { return r.ok; });
      }).catch(function () { return false; });
    },

    // ---- Buyer alerts (follow a sector for new-factory notifications) ----
    addBuyerAlert: function (sector) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rpc/add_buyer_alert', {
          method: 'POST', headers: restHeaders(tok), body: JSON.stringify({ p_sector: sector })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      });
    },
    removeBuyerAlert: function (sector) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/buyer_alerts?user_id=eq.' + AUTH.session.user.id + '&sector=eq.' + encodeURIComponent(sector), {
          method: 'DELETE', headers: restHeaders(tok, { Prefer: 'return=minimal' })
        }).then(function (r) { return r.ok; });
      });
    },
    myBuyerAlerts: function () {
      if (!this.isLoggedIn()) return Promise.resolve([]);
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/buyer_alerts?user_id=eq.' + AUTH.session.user.id + '&select=sector&order=created_at.desc', { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { return (rows || []).map(function (x) { return x.sector; }); });
      }).catch(function () { return []; });
    },

    // ---- Password reset ----
    // Send a recovery email. The link lands on reset-password.html with a
    // recovery token in the URL hash. Captcha token required when captcha is on.
    recover: function (email, captchaToken) {
      var body = { email: email };
      if (captchaToken) body.gotrue_meta_security = { captcha_token: captchaToken };
      return fetch(SUPABASE_URL + '/auth/v1/recover', {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.msg || res.j.error_description || res.j.error || AL('Could not send the reset email.', 'تعذّر إرسال بريد الاستعادة.'));
          return true;
        });
    },
    // Set a new password using the recovery access token from the email link.
    updatePassword: function (accessToken, newPassword) {
      return fetch(SUPABASE_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.msg || res.j.error_description || res.j.error || AL('Could not update the password.', 'تعذّر تحديث كلمة المرور.'));
          return true;
        });
    },

    // ---- Email verification ----
    // Re-send the confirmation email (used from the "check your inbox" screen).
    resendConfirmation: function (email, captchaToken) {
      var body = { type: 'signup', email: email };
      if (captchaToken) body.gotrue_meta_security = { captcha_token: captchaToken };
      return fetch(SUPABASE_URL + '/auth/v1/resend', {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.msg || res.j.error_description || res.j.error || AL('Could not resend. Try again shortly.', 'تعذر إعادة الإرسال. حاول بعد قليل.'));
          return true;
        });
    },
    // Once a user has a session, Supabase has already confirmed their email
    // (login is blocked until then when Confirm-email is on). So an explicit
    // confirmed timestamp OR simply holding a session both mean "verified".
    // The session fallback also covers sessions cached before we started
    // storing the timestamp.
    emailVerified: function () {
      var u = AUTH.session && AUTH.session.user;
      if (!u) return false;
      return !!(u.email_confirmed_at || u.confirmed_at || AUTH.session.access_token);
    },

    // ---- Optional phone verification (Twilio Verify via the phone-otp fn) ----
    startPhoneVerify: function (phone) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/functions/v1/phone-otp', {
          method: 'POST', headers: restHeaders(tok), body: JSON.stringify({ action: 'start', phone: phone })
        }).then(function (r) { return r.json(); })
          .then(function (j) { if (j.error) throw new Error(j.error); return j; });
      });
    },
    checkPhoneVerify: function (phone, code) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/functions/v1/phone-otp', {
          method: 'POST', headers: restHeaders(tok), body: JSON.stringify({ action: 'check', phone: phone, code: code })
        }).then(function (r) { return r.json(); })
          .then(function (j) { if (j.error) throw new Error(j.error); return j; });
      });
    },
    // The verified number (if any) for the signed-in user, else null.
    verifiedPhone: function () {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/verified_phones?select=phone,verified_at&user_id=eq.' + AUTH.session.user.id, { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (rows) { return (rows && rows[0]) || null; });
      });
    },

    // ---- Subscriptions / pay-to-verify (Paymob) ----
    // Starts checkout: returns { url } to redirect the owner to Paymob.
    startSubscription: function (plan, extra) {
      var fn = (window.PAYMENT_CHECKOUT_FN || 'kashier-checkout');
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/functions/v1/' + fn, {
          method: 'POST', headers: restHeaders(tok), body: JSON.stringify(Object.assign({ plan: plan || 'verified' }, extra || {}))
        }).then(function (r) {
          return r.text().then(function (txt) {
            var j = {}; try { j = JSON.parse(txt); } catch (e) {}
            if (r.status === 404) throw new Error('The "' + fn + '" function isn\'t deployed (404). Deploy it with that exact name.');
            if (!r.ok) throw new Error(j.error || j.message || j.msg || ('checkout HTTP ' + r.status));
            if (j.error) throw new Error(j.error);
            if (!j.url) throw new Error('Checkout returned no URL (HTTP ' + r.status + ') — check the ' + fn + ' function logs.');
            return j;
          });
        });
      });
    },
    // Upload one consultation sample (photo or PDF) → returns its public URL.
    uploadConsultSample: function (file) {
      return freshToken().then(function (tok) { return AdminStore.uploadPublic(file, tok, 'consultations'); });
    },
    // Book a consultation: posts the details to the consult checkout function and
    // returns { url } for the Kashier payment page.
    startConsultation: function (payload) {
      var fn = (window.PAYMENT_CONSULT_FN || 'kashier-consult-checkout');
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/functions/v1/' + fn, {
          method: 'POST', headers: restHeaders(tok), body: JSON.stringify(payload || {})
        }).then(function (r) {
          return r.text().then(function (txt) {
            var j = {}; try { j = JSON.parse(txt); } catch (e) {}
            if (r.status === 404) throw new Error('The "' + fn + '" function isn\'t deployed (404). Deploy it with that exact name.');
            if (!r.ok) throw new Error(j.error || j.message || ('checkout HTTP ' + r.status));
            if (j.error) throw new Error(j.error);
            if (!j.url) throw new Error('Checkout returned no URL — check the ' + fn + ' function logs.');
            return j;
          });
        });
      });
    },
    mySubscription: function () {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/subscriptions?select=*&owner=eq.' + AUTH.session.user.id + '&order=created_at.desc&limit=1', { headers: restHeaders(tok) })
          .then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) { return (rows && rows[0]) || null; });
      }).catch(function () { return null; });
    },
    // Admin: upgrade a paid factory to "visited" after the on-site visit.
    markFactoryVisited: function (factoryId) {
      return freshToken().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/rpc/mark_factory_visited', {
          method: 'POST', headers: restHeaders(tok), body: JSON.stringify({ p_factory: factoryId })
        }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return true; });
      });
    }
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

  // ---- Cloudflare Turnstile (bot protection on signup / login / resend) ----
  // The widget renders a token client-side; Supabase verifies it once
  // "Enable Captcha protection" (Turnstile) is switched on in the dashboard.
  // Until then the token is simply ignored, so this never blocks sign-in.
  var TURNSTILE_SITEKEY = '0x4AAAAAAEEHTneezpC_D8fO';

  function ensureTurnstile(cb, onFail) {
    if (window.turnstile && window.turnstile.render) { cb(); return; }
    if (!document.getElementById('cf-turnstile-js')) {
      var s = document.createElement('script');
      s.id = 'cf-turnstile-js';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true; s.defer = true;
      s.onerror = function () { if (onFail) onFail('script'); };
      document.head.appendChild(s);
    }
    var tries = 0;
    var iv = setInterval(function () {
      if (window.turnstile && window.turnstile.render) { clearInterval(iv); cb(); }
      else if (++tries > 100) { clearInterval(iv); if (onFail) onFail('timeout'); }   // give up after ~10s
    }, 100);
  }
  // A captcha failure must never be silent — it can block logins. Surface it in
  // analytics (so you see it before users complain) and tell the user.
  function capFail(holder, reason) {
    try { if (window.gtag) gtag('event', 'captcha_failed', { reason: reason || 'unknown' }); } catch (e) {}
    if (holder && !holder.dataset.failNoted && holder.parentNode) {
      holder.dataset.failNoted = '1';
      var note = document.createElement('div');
      note.className = 'cf-fail';
      note.textContent = AL('Verification could not load — please refresh the page or disable any ad-blocker.',
                            'تعذّر تحميل التحقق — يرجى تحديث الصفحة أو تعطيل مانع الإعلانات.');
      holder.parentNode.insertBefore(note, holder.nextSibling);
    }
  }
  function mountCaptcha(holder) {
    if (!holder) return;
    ensureTurnstile(function () {
      // Clear any stale widget so a re-open / mode-switch always re-renders.
      try { if (holder.dataset.wid) window.turnstile.remove(holder.dataset.wid); } catch (e) {}
      holder.innerHTML = '';
      holder.dataset.token = '';
      holder.dataset.failNoted = '';
      try {
        holder.dataset.wid = window.turnstile.render(holder, {
          sitekey: TURNSTILE_SITEKEY,
          theme: 'auto',
          callback: function (tok) { holder.dataset.token = tok; },
          'expired-callback': function () { holder.dataset.token = ''; },
          'error-callback': function () { holder.dataset.token = ''; capFail(holder, 'error-callback'); }
        });
      } catch (e) { capFail(holder, 'render-threw'); }
    }, function (reason) { capFail(holder, reason); });
  }
  function capToken(holder) { return holder ? (holder.dataset.token || '') : ''; }
  // Only enforce the captcha when a widget actually rendered (Turnstile injects
  // an iframe). If it failed to load — ad-blocker, network, domain not allow-
  // listed — never block the user; let the server decide.
  function capRequired(holder) { return !!(holder && holder.querySelector && holder.querySelector('iframe')); }
  function capReset(holder) {
    if (holder && holder.dataset.wid && window.turnstile) {
      try { window.turnstile.reset(holder.dataset.wid); } catch (e) {}
      holder.dataset.token = '';
    }
  }

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
        (isSignup
          ? '<label class="au-terms"><input type="checkbox" id="au_terms"><span>' + t('au_terms_agree') + '</span></label>'
          : '<div class="au-forgot-row"><button type="button" class="au-link" id="auForgot">' + t('au_forgot') + '</button></div>') +
        '<div class="cf-holder" id="auCaptcha"></div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-ghost" id="auSwitch">' + (isSignup ? t('au_have') : t('au_no')) + '</button>' +
          '<button class="btn btn-primary" id="auSubmit">' + (isSignup ? t('au_submit_signup') : t('au_submit_login')) + '</button>' +
        '</div>' +
      '</div>';
    bd.querySelector('#auSwitch').onclick = function () { renderAuth(bd, isSignup ? 'login' : 'signup'); };
    bd.querySelector('#auSubmit').onclick = function () { submitAuth(bd, mode); };
    var forgot = bd.querySelector('#auForgot');
    if (forgot) forgot.onclick = function () { renderRecover(bd); };
    mountCaptcha(bd.querySelector('#auCaptcha'));
  }

  // "Forgot password" view — email + captcha -> recovery email.
  function renderRecover(bd) {
    bd.innerHTML =
      '<div class="modal">' +
        '<h2>' + t('au_recover_title') + '</h2>' +
        '<p class="sub">' + t('au_recover_sub') + '</p>' +
        '<div class="au-err" id="auErr" style="display:none"></div>' +
        '<div class="cf-ok" id="rcOk" style="display:none;color:var(--teal);font-weight:600;margin:6px 0"></div>' +
        '<div class="form-grid">' + field(t('au_email'), '<input id="rc_email" type="email">') + '</div>' +
        '<div class="cf-holder" id="rcCaptcha"></div>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-ghost" id="rcBack">' + t('au_recover_back') + '</button>' +
          '<button class="btn btn-primary" id="rcSend">' + t('au_recover_send') + '</button>' +
        '</div>' +
      '</div>';
    var cap = bd.querySelector('#rcCaptcha');
    mountCaptcha(cap);
    bd.querySelector('#rcBack').onclick = function () { renderAuth(bd, 'login'); };
    bd.querySelector('#rcSend').onclick = function () {
      var err = bd.querySelector('#auErr'); var show = function (m) { err.textContent = m; err.style.display = 'block'; };
      var email = (bd.querySelector('#rc_email').value || '').trim();
      if (!email) { show(AL('Enter your email.', 'أدخل بريدك الإلكتروني.')); return; }
      var token = capToken(cap);
      if (capRequired(cap) && !token) { show(AL('Please complete the verification below.', 'يرجى إكمال التحقق بالأسفل.')); return; }
      var btn = bd.querySelector('#rcSend'); var label = btn.textContent; btn.textContent = '…'; btn.disabled = true;
      Auth.recover(email, token).then(function () {
        err.style.display = 'none';
        var ok = bd.querySelector('#rcOk'); ok.textContent = t('au_recover_sent'); ok.style.display = 'block';
        btn.textContent = label; btn.disabled = false;
      }).catch(function (e) { btn.textContent = label; btn.disabled = false; capReset(cap); show(e.message || String(e)); });
    };
  }

  function submitAuth(bd, mode) {
    var err = bd.querySelector('#auErr');
    var show = function (m) { err.textContent = m; err.style.display = 'block'; };
    var v = function (id) { var el = bd.querySelector('#' + id); return el ? el.value.trim() : ''; };
    var email = v('au_email'), pw = v('au_password');
    if (!email || !pw) { show(AL('Enter your email and password.', 'أدخل البريد الإلكتروني وكلمة المرور.')); return; }
    if (mode === 'signup') {
      var termsEl = bd.querySelector('#au_terms');
      if (termsEl && !termsEl.checked) { show(t('au_terms_required')); return; }
    }
    var cap = bd.querySelector('#auCaptcha');
    var token = capToken(cap);
    if (capRequired(cap) && !token) { show(AL('Please complete the verification below.', 'يرجى إكمال التحقق بالأسفل.')); return; }
    var btn = bd.querySelector('#auSubmit'); var label = btn.textContent; btn.textContent = '…'; btn.disabled = true;
    // Turnstile tokens are single-use — reset the widget so a retry gets a fresh one.
    var done = function (e) { btn.disabled = false; btn.textContent = label; capReset(cap); show(e.message || String(e)); };

    if (mode === 'login') {
      Auth.login(email, pw, token).then(function () { window.location.reload(); }).catch(done);
    } else {
      var fields = { full_name: v('au_name'), phone: v('au_phone') };
      Auth.signup(email, pw, 'user', fields, token).then(function (r) {
        if (r.needConfirm) { showConfirmScreen(bd, email); }
        else { window.location.href = 'account.html'; }   // land in the dashboard
      }).catch(done);
    }
  }

  // "Check your inbox" screen after sign-up, with a resend button.
  function showConfirmScreen(bd, email) {
    var m = bd.querySelector('.modal');
    m.innerHTML =
      '<div style="text-align:center">' +
        '<span class="ci" style="width:52px;height:52px;background:var(--teal-tint);color:var(--teal);border-radius:15px;display:inline-grid;place-items:center;margin-bottom:12px">' + (ICONS.mail || ICONS.bell || '') + '</span>' +
        '<h2>' + t('au_check_inbox') + '</h2>' +
        '<p class="sub">' + t('au_confirm_to') + ' <strong>' + email + '</strong>. ' + t('au_confirm_note') + '</p>' +
        '<div class="au-err" id="cfErr" style="display:none"></div>' +
        '<div class="cf-ok" id="cfOk" style="display:none;color:var(--teal);font-weight:600;margin:6px 0">' + t('au_resent') + '</div>' +
        '<div class="cf-holder" id="cfCaptcha" style="justify-content:center"></div>' +
      '</div>' +
      '<div class="modal-actions" style="justify-content:center">' +
        '<button class="btn btn-ghost" id="cfResend">' + t('au_resend') + '</button>' +
        '<button class="btn btn-primary" onclick="this.closest(\'.modal-backdrop\').remove()">' + t('au_done') + '</button>' +
      '</div>';
    var cap = m.querySelector('#cfCaptcha');
    mountCaptcha(cap);
    var rb = m.querySelector('#cfResend');
    rb.onclick = function () {
      var token = capToken(cap);
      if (capRequired(cap) && !token) { var e0 = m.querySelector('#cfErr'); e0.textContent = AL('Please complete the verification.', 'يرجى إكمال التحقق.'); e0.style.display = 'block'; return; }
      rb.disabled = true; rb.textContent = '…';
      m.querySelector('#cfErr').style.display = 'none';
      Auth.resendConfirmation(email, token).then(function () {
        m.querySelector('#cfOk').style.display = 'block'; rb.textContent = t('au_resend');
        setTimeout(function () { rb.disabled = false; }, 15000);
      }).catch(function (e) {
        var er = m.querySelector('#cfErr'); er.textContent = e.message || String(e); er.style.display = 'block';
        rb.disabled = false; rb.textContent = t('au_resend'); capReset(cap);
      });
    };
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

  // ---------- Email-confirmation callback ----------
  // Supabase's confirm link redirects back to the site with the session tokens
  // in the URL fragment (#access_token=…&refresh_token=…&type=signup). Catch
  // that here, establish the session so the user is logged in, and send them to
  // the home page — no second manual login.
  (function handleAuthCallback() {
    if (!remoteReady()) return;
    var hash = window.location.hash || '';
    if (hash.indexOf('access_token=') === -1) {
      // Surface an expired/used link cleanly rather than leaving #error in the URL.
      if (hash.indexOf('error=') !== -1) {
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
      }
      return;
    }
    var params = new URLSearchParams(hash.charAt(0) === '#' ? hash.slice(1) : hash);
    // Password-recovery links carry an access token too, but reset-password.html
    // must consume it (to set a new password) — don't log the user in here.
    if (params.get('type') === 'recovery') return;
    var at = params.get('access_token'), rt = params.get('refresh_token');
    var expIn = parseInt(params.get('expires_in') || '3600', 10);
    if (!at) return;
    // Clear the tokens from the address bar immediately (don't leave them in history).
    try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + at } })
      .then(function (r) { return r.json(); })
      .then(function (user) {
        AUTH.session = sessionFrom({ access_token: at, refresh_token: rt, expires_in: expIn, user: user }, user && user.email);
        writeCache();
        return ensureProfile().catch(function () {});
      })
      .then(function () { window.location.replace('index.html'); })   // land home, logged in
      .catch(function () { /* leave them on the page; cache already cleared */ });
  })();
})();
