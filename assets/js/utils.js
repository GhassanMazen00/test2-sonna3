// Language state
var LANG = 'ar';

// Load saved language preference
(function() {
  var saved = localStorage.getItem('sonnaLang');
  if (saved === 'en') LANG = 'en';
})();

// Valid Egyptian mobile: 010/011/012/015 + 8 digits, with optional +20 / 0.
function isEgyptMobile(v) {
  var d = String(v || '').replace(/[^\d]/g, '').replace(/^0020/, '').replace(/^20/, '').replace(/^0/, '');
  return /^1[0125]\d{8}$/.test(d);
}

// Start a subscription: collect required name + Egyptian mobile, then checkout.
function startSubscribe(plan) {
  if (!(window.Auth && Auth.isLoggedIn())) { if (window.openAuthModal) openAuthModal('login'); return; }
  var p = (Auth.profile && Auth.profile()) || {};
  var bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('click', function (e) { if (e.target === bd) bd.remove(); });
  bd.innerHTML =
    '<div class="modal" style="max-width:460px">' +
      '<h2>' + t('sub_title') + '</h2>' +
      '<p class="sub">' + t('sub_sub') + '</p>' +
      '<div class="au-err" id="subErr" style="display:none"></div>' +
      '<div class="form-grid">' +
        '<div class="form-field full"><label>' + t('sub_name') + ' *</label><input id="sub_name" type="text" value="' + esc(p.full_name || '') + '"></div>' +
        '<div class="form-field full"><label>' + t('sub_phone') + ' *</label><input id="sub_phone" type="tel" dir="ltr" placeholder="01X XXXX XXXX" value="' + esc(p.phone || '') + '"></div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" id="sub_cancel">' + t('cancel') + '</button>' +
        '<button class="btn btn-primary" id="sub_go">' + t('sub_go') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(bd);
  var err = function (m) { var e = bd.querySelector('#subErr'); e.textContent = m; e.style.display = 'block'; };
  bd.querySelector('#sub_cancel').onclick = function () { bd.remove(); };
  bd.querySelector('#sub_go').onclick = function () {
    var name = (bd.querySelector('#sub_name').value || '').trim();
    var phone = (bd.querySelector('#sub_phone').value || '').trim();
    if (!name) { err(t('sub_need_name')); return; }
    if (!isEgyptMobile(phone)) { err(t('sub_bad_phone')); return; }
    var btn = bd.querySelector('#sub_go'); btn.disabled = true; btn.textContent = t('pay_starting');
    Auth.startSubscription(plan || 'verified', { name: name, phone: phone }).then(function (r) {
      if (r && r.url) { window.location.href = r.url; return; }
      throw new Error('no checkout url');
    }).catch(function (e) { btn.disabled = false; btn.textContent = t('sub_go'); err((t('pay_error') || 'Could not start checkout') + ': ' + (e.message || e)); });
  };
}

// Current page tracking
var CURRENT_PAGE = 'home';
var FILTERS = { q: '', industry: '', gov: '', moq: '', exp: false, cert: '', minCapacity: '', sort: 'name' };

// Translation helper
function t(k) {
  return STR[LANG][k];
}

// Bilingual object accessor
function L(obj) {
  return obj[LANG];
}

// Find industry by ID
function ind(id) {
  for (var i = 0; i < INDUSTRIES.length; i++) {
    if (INDUSTRIES[i].id === id) return INDUSTRIES[i];
  }
  return INDUSTRIES[0];
}

// HTML escape
function esc(s) {
  return String(s).replace(/[&<>"]/g, function(c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
  });
}

// Gradient helper
function grad(g) {
  return 'linear-gradient(135deg, ' + g[0] + ', ' + g[1] + ')';
}

// Make a user-supplied URL safe to drop inside url('...') in an inline style,
// so it can't break out of the quotes/parens and inject CSS. Percent-encodes
// the dangerous characters explicitly (encodeURIComponent leaves ' ( ) intact).
function safeUrl(u) {
  return String(u == null ? '' : u).replace(/[)"'(\\\s<>]/g, function (c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
  });
}

// Number formatting
function num(n) {
  var clean = Number(String(n).replace(/,/g, ''));
  return LANG === 'ar' ? clean.toLocaleString('ar-EG') : clean.toLocaleString('en-US');
}

// Factory code generator
function factoryCode(f) {
  var prefix = IND_CODE[f.industry] || 'FAC';
  var seq;
  if (/^f\d+$/.test(f.id)) { seq = String(Number(f.id.slice(1)) + 1).padStart(3, '0'); }
  else { var digits = String(f.id).replace(/[^0-9]/g, ''); seq = (digits ? digits.slice(0, 4) : '001').padStart(3, '0'); }
  return prefix + '-' + seq;
}

// Set language and reload.
// We intentionally do NOT change the current page's direction/text here — doing
// that mid-page causes a visible "flip" glitch. We just save the choice and
// reload; an inline script in each page's <head> applies the correct direction
// before the page paints, so the switch looks clean.
function setLang(l) {
  if (l === LANG) return;
  localStorage.setItem('sonnaLang', l);
  window.location.reload();
}

// Take the visitor to list their factory: sign up if needed, otherwise the
// profile page (which has the "create factory page" option).
function listYourFactory() {
  if (window.Auth && Auth.isLoggedIn()) { window.location.href = 'account.html'; }
  else if (window.openAuthModal) { openAuthModal('signup'); }
  else { window.location.href = 'account.html'; }
}

// Consultant booking — collects the client's details + sample files and sends
// them to a live Kashier payment. On success the return page shows the
// "a consultant will contact you soon" message and the booking is logged for
// admins. Requires the visitor to be logged in (so files upload + we can reach
// them afterwards).
function bookConsultation() {
  if (window.Auth && Auth.ready && Auth.ready() && !Auth.isLoggedIn()) {
    if (window.openAuthModal) openAuthModal('login');
    return;
  }
  var sel = document.getElementById('consultSector');
  var chosen = sel ? sel.value : ((typeof INDUSTRIES !== 'undefined' && INDUSTRIES[0]) ? INDUSTRIES[0].id : '');
  var p = (window.Auth && Auth.profile && Auth.profile()) || {};
  var sectorOpts = INDUSTRIES.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === chosen ? ' selected' : '') + '>' + L({ en: s.en, ar: s.ar }) + '</option>'; }).join('');
  var fee = t('cb_fee_val');
  var samples = [];   // File objects chosen for upload

  var bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('click', function (e) { if (e.target === bd) bd.remove(); });
  bd.innerHTML =
    '<div class="modal cb-modal">' +
      '<h2>' + t('cb_title') + '</h2>' +
      '<p class="sub">' + t('cb_sub') + '</p>' +
      '<div class="au-err" id="cbErr" style="display:none"></div>' +

      '<h3 class="cb-section">' + t('cb_details') + '</h3>' +
      '<div class="form-grid">' +
        '<div class="form-field"><label>' + t('cb_name') + ' *</label><input id="cb_name" value="' + esc(p.full_name || '') + '"></div>' +
        '<div class="form-field"><label>' + t('cb_company') + ' *</label><input id="cb_company" value="' + esc(p.company || '') + '"></div>' +
        '<div class="form-field"><label>' + t('cb_phone') + ' *</label><input id="cb_phone" dir="ltr" value="' + esc(p.phone || '') + '"></div>' +
        '<div class="form-field"><label>' + t('cb_whatsapp') + ' *</label><input id="cb_whatsapp" dir="ltr" placeholder="' + esc(t('cb_whatsapp_ph')) + '"></div>' +
        '<div class="form-field"><label>' + t('cb_email') + ' *</label><input id="cb_email" dir="ltr" value="' + esc(p.email || '') + '"></div>' +
        '<div class="form-field"><label>' + t('cb_city') + ' *</label><input id="cb_city" placeholder="' + esc(t('cb_city_ph')) + '"></div>' +
        '<div class="form-field"><label>' + t('cb_sector') + ' *</label><select id="cb_sector">' + sectorOpts + '</select></div>' +
        '<div class="form-field"><label>' + t('cb_date') + ' *</label><input id="cb_date" type="date"></div>' +
        '<div class="form-field full"><label>' + t('cb_needs') + ' *</label><textarea id="cb_needs" rows="3" placeholder="' + esc(t('cb_needs_ph')) + '"></textarea></div>' +
        '<div class="form-field full">' +
          '<label>' + t('cb_samples') + '</label>' +
          '<label class="cb-upload" for="cb_files">' + ICONS.image + ' <span>' + t('cb_samples_btn') + '</span></label>' +
          '<input id="cb_files" type="file" accept="image/*,application/pdf" multiple style="display:none">' +
          '<div class="cb-files" id="cb_files_list"></div>' +
          '<span class="cb-hint">' + t('cb_samples_hint') + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="cb-fee"><span>' + t('cb_fee_label') + '</span><b id="cb_total">' + fee + '</b></div>' +

      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="this.closest(\'.modal-backdrop\').remove()">' + t('cancel') + '</button>' +
        '<button class="btn btn-primary" id="cb_pay_btn">' + ICONS.shieldCheck + ' ' + t('cb_pay_btn') + ' · ' + fee + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(bd);

  // File picker → track selected files and show their names.
  var fileInput = bd.querySelector('#cb_files');
  var fileList = bd.querySelector('#cb_files_list');
  fileInput.addEventListener('change', function () {
    for (var i = 0; i < fileInput.files.length && samples.length < 12; i++) samples.push(fileInput.files[i]);
    fileInput.value = '';
    fileList.innerHTML = samples.map(function (f, ix) {
      return '<span class="cb-file">' + esc(f.name) + '<button type="button" aria-label="remove" data-ix="' + ix + '">×</button></span>';
    }).join('');
  });
  fileList.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-ix]'); if (!b) return;
    samples.splice(Number(b.dataset.ix), 1);
    fileList.innerHTML = samples.map(function (f, ix) {
      return '<span class="cb-file">' + esc(f.name) + '<button type="button" aria-label="remove" data-ix="' + ix + '">×</button></span>';
    }).join('');
  });

  var btn = bd.querySelector('#cb_pay_btn');
  btn.onclick = function () {
    var v = function (id) { var e = bd.querySelector('#' + id); return e ? e.value.trim() : ''; };
    var err = bd.querySelector('#cbErr');
    // Every field is required except the sample upload.
    var missing = ['cb_name','cb_company','cb_phone','cb_whatsapp','cb_email','cb_city','cb_sector','cb_date','cb_needs']
      .some(function (id) { return !v(id); });
    if (missing) {
      err.textContent = t('cb_required'); err.style.display = 'block';
      bd.querySelector('.cb-modal').scrollTop = 0; return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('cb_email'))) {
      err.textContent = t('cb_bad_email'); err.style.display = 'block';
      bd.querySelector('.cb-modal').scrollTop = 0; return;
    }
    err.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = samples.length ? t('cb_uploading') : t('cb_redirecting');

    // Upload any sample files first, then create the booking + payment.
    var uploads = samples.map(function (f) { return Auth.uploadConsultSample(f); });
    Promise.all(uploads).then(function (urls) {
      return Auth.startConsultation({
        name: v('cb_name'), company: v('cb_company'), phone: v('cb_phone'),
        whatsapp: v('cb_whatsapp'), email: v('cb_email'), sector: v('cb_sector'),
        city: v('cb_city'), needs: v('cb_needs'), preferred_at: v('cb_date'),
        sample_urls: urls
      });
    }).then(function (j) {
      btn.innerHTML = t('cb_redirecting');
      window.location.href = j.url;   // off to Kashier
    }).catch(function (e) {
      btn.disabled = false;
      btn.innerHTML = ICONS.shieldCheck + ' ' + t('cb_pay_btn') + ' · ' + fee;
      err.textContent = (t('cb_pay_fail') || 'Could not start payment') + ': ' + (e.message || e);
      err.style.display = 'block';
    });
  };
}

// Toast notification
function toast(msg) {
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 2600);
}

// Mobile menu
function openMobileMenu() {
  var overlay = document.getElementById('mobileOverlay');
  var panel = document.getElementById('mobilePanel');
  if (overlay) overlay.classList.add('open');
  if (panel) panel.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  var overlay = document.getElementById('mobileOverlay');
  var panel = document.getElementById('mobilePanel');
  if (overlay) overlay.classList.remove('open');
  if (panel) panel.classList.remove('open');
  document.body.style.overflow = '';
}

// Request form modal — posts a live manufacturing request to Supabase, with
// optional sample media uploads. Requires the user to be logged in.
function openRequestForm(existing) {
  if (window.Auth && Auth.ready && Auth.ready() && !Auth.isLoggedIn()) {
    if (window.openAuthModal) openAuthModal('login');
    return;
  }
  var ex = (existing && existing.id) ? existing : null;   // editing an existing post?
  var editing = !!ex;
  var exMedia = (ex && Array.isArray(ex.media)) ? ex.media : [];
  var bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('click', function(e) {
    if (e.target === bd) bd.remove();
  });
  var xa = function (val) { return esc(val == null ? '' : String(val)); };   // value attr

  bd.innerHTML =
    '<div class="modal">' +
      '<h2>' + (editing ? t('req_edit_title') : t('new_req')) + '</h2>' +
      '<p class="sub">' + (editing ? t('req_edit_sub') : t('new_req_sub')) + '</p>' +
      '<div class="au-err" id="fq_err" style="display:none"></div>' +
      '<div class="form-grid">' +
        '<div class="form-field full">' +
          '<label>' + t('fr_title') + ' *</label>' +
          '<input id="fq_title" value="' + xa(ex && ex.title) + '" placeholder="' + t('fr_title_ph') + '">' +
        '</div>' +
        '<div class="form-field full">' +
          '<label>' + t('fr_desc') + ' *</label>' +
          '<textarea id="fq_desc" placeholder="' + t('fr_desc_ph') + '">' + xa(ex && ex.description) + '</textarea>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_qty') + ' *</label>' +
          '<input id="fq_qty" type="number" min="1" value="' + xa(ex && ex.qty) + '" placeholder="1000">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_material') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<input id="fq_mat" value="' + xa(ex && ex.material) + '" placeholder="' + t('fr_material_ph') + '">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_budget') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<input id="fq_budget" type="number" min="0" value="' + xa(ex && ex.budget) + '" placeholder="' + t('fr_budget_ph') + '">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_gov') + ' *</label>' +
          '<select id="fq_gov">' + GOVS.map(function(g, ix) { return '<option value="' + ix + '"' + (ex && Number(ex.gov) === ix ? ' selected' : '') + '>' + L(g) + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_sector') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<select id="fq_sector"><option value="">' + t('all') + '</option>' + INDUSTRIES.map(function(s) { return '<option value="' + esc(s.id) + '"' + (ex && ex.sector === s.id ? ' selected' : '') + '>' + L({en: s.en, ar: s.ar}) + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<div class="form-field full">' +
          '<label>' + t('fr_contact') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<div class="muted" style="font-size:12.5px;margin:-2px 0 8px">' + t('fr_contact_note') + '</div>' +
          '<div class="contact-field"><span class="cf-ic">' + ICONS.phone + '</span><input id="fq_phone" dir="ltr" type="tel" value="' + xa(ex && ex.contact_phone) + '" placeholder="' + t('fr_phone_ph') + '"></div>' +
          '<div class="contact-field"><span class="cf-ic cf-wa">' + ICONS.whatsapp + '</span><input id="fq_whatsapp" dir="ltr" type="tel" value="' + xa(ex && ex.contact_whatsapp) + '" placeholder="' + t('fr_whatsapp_ph') + '"></div>' +
          '<div class="contact-field"><span class="cf-ic">' + ICONS.envelope + '</span><input id="fq_email" dir="ltr" type="email" value="' + xa(ex && ex.contact_email) + '" placeholder="' + t('fr_email_ph') + '"></div>' +
        '</div>' +
        '<div class="form-field full">' +
          '<label>' + t('fr_files') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<input id="fq_files" type="file" accept="image/*,video/*" multiple>' +
          '<div class="muted" id="fq_files_list" style="font-size:12.5px;margin-top:6px">' + (editing && exMedia.length ? t('fr_files_kept').replace('{n}', exMedia.length) : t('fr_files_note')) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" id="fq_cancel">' + t('cancel') + '</button>' +
        '<button class="btn btn-primary" id="fq_submit">' + (editing ? t('save') : t('publish')) + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(bd);

  var filesInput = bd.querySelector('#fq_files');
  var filesList = bd.querySelector('#fq_files_list');
  var defaultNote = (editing && exMedia.length) ? t('fr_files_kept').replace('{n}', exMedia.length) : t('fr_files_note');
  filesInput.onchange = function () {
    var names = Array.prototype.map.call(filesInput.files, function (f) { return f.name; });
    filesList.textContent = names.length ? names.join(', ') : defaultNote;
  };

  var showErr = function (m) { var e = bd.querySelector('#fq_err'); e.textContent = m; e.style.display = 'block'; };

  bd.querySelector('#fq_cancel').onclick = function() { bd.remove(); };
  bd.querySelector('#fq_submit').onclick = function() {
    var v = function(id) { return bd.querySelector(id).value.trim(); };
    var title = v('#fq_title'), desc = v('#fq_desc'), qty = v('#fq_qty');
    var phone = v('#fq_phone'), whatsapp = v('#fq_whatsapp'), email = v('#fq_email');
    if (!title || !desc || !qty) { showErr(t('fill_required')); return; }
    if (!(window.Auth && Auth.isLoggedIn())) { if (window.openAuthModal) openAuthModal('login'); return; }

    var btn = bd.querySelector('#fq_submit'); btn.disabled = true; btn.textContent = '…';

    // Upload any newly chosen sample media first, then save the request.
    var files = Array.prototype.slice.call(filesInput.files || []);
    var uploads = files.map(function (f) {
      return Auth.uploadRequestMedia(f).then(function (url) {
        return { url: url, type: (f.type && f.type.indexOf('video') === 0) ? 'video' : 'image' };
      });
    });

    Promise.all(uploads).then(function (media) {
      var fields = {
        title: title, description: desc, qty: qty,
        budget: v('#fq_budget') || null, material: v('#fq_mat') || null,
        gov: Number(bd.querySelector('#fq_gov').value), sector: bd.querySelector('#fq_sector').value || null,
        contact_phone: phone || null, contact_whatsapp: whatsapp || null, contact_email: email || null,
        media: editing ? exMedia.concat(media) : media   // editing keeps existing media, appends new
      };
      return editing ? Auth.updateRequest(ex.id, fields) : Auth.createRequest(fields);
    }).then(function () {
      bd.remove();
      toast(editing ? t('req_saved') : t('published'));
      setTimeout(function() {
        if (editing) window.location.reload();
        else window.location.href = 'requests.html';
      }, 500);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = editing ? t('save') : t('publish');
      showErr((t('req_post_fail') || 'Could not post request') + ': ' + (e.message || e));
    });
  };
}
