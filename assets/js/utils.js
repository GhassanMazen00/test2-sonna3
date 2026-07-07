// Language state
var LANG = 'ar';

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
  return INDUSTRIES.find(function(x) { return x.id === id; });
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

// Number formatting
function num(n) {
  var clean = Number(String(n).replace(/,/g, ''));
  return LANG === 'ar' ? clean.toLocaleString('ar-EG') : clean.toLocaleString('en-US');
}

// Factory code generator
function factoryCode(f) {
  return IND_CODE[f.industry] + '-' + String(Number(f.id.slice(1)) + 1).padStart(3, '0');
}

// Set language and refresh
function setLang(l) {
  LANG = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  
  // Reload current page to apply language
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  if (currentPage === '' || currentPage === '/') currentPage = 'index.html';
  window.location.reload();
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
  document.getElementById('mobileOverlay').classList.add('open');
  document.getElementById('mobilePanel').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  document.getElementById('mobileOverlay').classList.remove('open');
  document.getElementById('mobilePanel').classList.remove('open');
  document.body.style.overflow = '';
}

// Request form modal
function openRequestForm() {
  var bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('click', function(e) {
    if (e.target === bd) bd.remove();
  });
  
  bd.innerHTML = 
    '<div class="modal">' +
      '<h2>' + t('new_req') + '</h2>' +
      '<p class="sub">' + t('new_req_sub') + '</p>' +
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
        '<div class="form-field full">' +
          '<label>' + t('fr_contact') + ' *</label>' +
          '<input id="fq_contact" placeholder="' + t('fr_contact_ph') + '">' +
        '</div>' +
        '<div class="form-field full">' +
          '<label>' + t('fr_files') + ' <span class="opt">(' + t('optional') + ')</span></label>' +
          '<div class="upload-box">' + t('fr_files_note') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" id="fq_cancel">' + t('cancel') + '</button>' +
        '<button class="btn btn-primary" id="fq_submit">' + t('publish') + '</button>' +
      '</div>' +
    '</div>';
  
  document.body.appendChild(bd);
  
  bd.querySelector('#fq_cancel').onclick = function() { bd.remove(); };
  bd.querySelector('#fq_submit').onclick = function() {
    function v(id) { return bd.querySelector(id).value.trim(); }
    var title = v('#fq_title'), desc = v('#fq_desc'), qty = v('#fq_qty'), contact = v('#fq_contact');
    
    if (!title || !desc || !qty || !contact) {
      toast(t('fill_required'));
      return;
    }
    
    var mat = v('#fq_mat') || '—';
    var budget = v('#fq_budget') || null;
    var gov = Number(bd.querySelector('#fq_gov').value);
    
    REQUESTS.unshift({
      id: 'r' + Date.now(),
      icon: '📝',
      days: 0,
      qty: qty,
      budget: budget,
      title: { en: title, ar: title },
      desc: { en: desc, ar: desc },
      material: { en: mat, ar: mat },
      gov: gov,
      by: { en: 'Sonnaع user', ar: 'مستخدم صُنّاع' },
      contact: contact
    });
    
    bd.remove();
    toast(t('published'));
    window.location.href = 'requests.html';
  };
}
