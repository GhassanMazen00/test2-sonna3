// Language state
var LANG = 'ar';

// Load saved language preference
(function() {
  var saved = localStorage.getItem('sonnaLang');
  if (saved === 'en') LANG = 'en';
})();

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

// Consultant booking (prototype) — confirms a match based on the chosen sector
function bookConsultation() {
  var sel = document.getElementById('consultSector');
  if (!sel) return;
  var industry = ind(sel.value);
  var name = L({ en: industry.en, ar: industry.ar });
  toast(t('consult_toast_pre') + name + t('consult_toast_post'));
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
function openRequestForm() {
  if (window.Auth && Auth.ready && Auth.ready() && !Auth.isLoggedIn()) {
    if (window.openAuthModal) openAuthModal('login');
    return;
  }
  var bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('click', function(e) {
    if (e.target === bd) bd.remove();
  });

  bd.innerHTML =
    '<div class="modal">' +
      '<h2>' + t('new_req') + '</h2>' +
      '<p class="sub">' + t('new_req_sub') + '</p>' +
      '<div class="au-err" id="fq_err" style="display:none"></div>' +
      '<div class="form-grid">' +
        '<div class="form-field full">' +
          '<label>' + t('fr_title') + ' *</label>' +
          '<input id="fq_title" placeholder="' + t('fr_title_ph') + '">' +
        '</div>' +
        '<div class="form-field full">' +
          '<label>' + t('fr_desc') + ' *</label>' +
          '<textarea id="fq_desc" placeholder="' + t('fr_desc_ph') + '"></textarea>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_qty') + ' *</label>' +
          '<input id="fq_qty" type="number" min="1" placeholder="1000">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_material') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<input id="fq_mat" placeholder="' + t('fr_material_ph') + '">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_budget') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<input id="fq_budget" type="number" min="0" placeholder="' + t('fr_budget_ph') + '">' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_gov') + ' *</label>' +
          '<select id="fq_gov">' + GOVS.map(function(g, ix) { return '<option value="' + ix + '">' + L(g) + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<div class="form-field">' +
          '<label>' + t('fr_sector') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<select id="fq_sector"><option value="">' + t('all') + '</option>' + INDUSTRIES.map(function(s) { return '<option value="' + esc(s.id) + '">' + L({en: s.en, ar: s.ar}) + '</option>'; }).join('') + '</select>' +
        '</div>' +
        '<div class="form-field full">' +
          '<label>' + t('fr_contact') + ' *</label>' +
          '<input id="fq_contact" placeholder="' + t('fr_contact_ph') + '">' +
        '</div>' +
        '<div class="form-field full">' +
          '<label>' + t('fr_files') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<input id="fq_files" type="file" accept="image/*,video/*" multiple>' +
          '<div class="muted" id="fq_files_list" style="font-size:12.5px;margin-top:6px">' + t('fr_files_note') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" id="fq_cancel">' + t('cancel') + '</button>' +
        '<button class="btn btn-primary" id="fq_submit">' + t('publish') + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(bd);

  var filesInput = bd.querySelector('#fq_files');
  var filesList = bd.querySelector('#fq_files_list');
  filesInput.onchange = function () {
    var names = Array.prototype.map.call(filesInput.files, function (f) { return f.name; });
    filesList.textContent = names.length ? names.join(', ') : t('fr_files_note');
  };

  var showErr = function (m) { var e = bd.querySelector('#fq_err'); e.textContent = m; e.style.display = 'block'; };

  bd.querySelector('#fq_cancel').onclick = function() { bd.remove(); };
  bd.querySelector('#fq_submit').onclick = function() {
    var v = function(id) { return bd.querySelector(id).value.trim(); };
    var title = v('#fq_title'), desc = v('#fq_desc'), qty = v('#fq_qty'), contact = v('#fq_contact');
    if (!title || !desc || !qty || !contact) { showErr(t('fill_required')); return; }
    if (!(window.Auth && Auth.isLoggedIn())) { if (window.openAuthModal) openAuthModal('login'); return; }

    var btn = bd.querySelector('#fq_submit'); btn.disabled = true; btn.textContent = '…';

    // Upload any chosen sample media first, then create the request row.
    var files = Array.prototype.slice.call(filesInput.files || []);
    var uploads = files.map(function (f) {
      return Auth.uploadRequestMedia(f).then(function (url) {
        return { url: url, type: (f.type && f.type.indexOf('video') === 0) ? 'video' : 'image' };
      });
    });

    Promise.all(uploads).then(function (media) {
      return Auth.createRequest({
        title: title, description: desc, qty: qty,
        budget: v('#fq_budget') || null, material: v('#fq_mat') || null,
        gov: Number(bd.querySelector('#fq_gov').value), sector: bd.querySelector('#fq_sector').value || null,
        contact: contact, media: media
      });
    }).then(function () {
      bd.remove();
      toast(t('published'));
      setTimeout(function() { window.location.href = 'requests.html'; }, 500);
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = t('publish');
      showErr((t('req_post_fail') || 'Could not post request') + ': ' + (e.message || e));
    });
  };
}
