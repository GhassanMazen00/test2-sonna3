// ============================================
// CHAT — 1:1 direct messages between users
// ============================================
//
// Talks to the Supabase 'messages' table (see supabase/chat_and_requests.sql).
// A conversation between two users is identified by a "thread_key": their two
// ids sorted and joined with ':'. A message may reference a request (tag) via
// request_id / request_title. Names are denormalised on each message so the
// chat never needs to read other users' profiles.
//
// UI: Chat.openWith(userId, displayName, { requestId, requestTitle }) opens a
// slide-in panel with the history and a composer, polling every few seconds.

(function () {
  function ready() { return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.Auth); }
  function myId() { var u = window.Auth && Auth.user(); return u ? u.id : null; }
  function myName() {
    var p = (window.Auth && Auth.profile()) || {};
    var u = (window.Auth && Auth.user()) || {};
    return p.full_name || (u.email ? String(u.email).split('@')[0] : '') || 'User';
  }
  function threadKey(a, b) { return [String(a), String(b)].sort().join(':'); }
  function headers(tok, extra) {
    return Object.assign({ apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, extra || {});
  }
  function rest(path, opts) {
    return Auth.token().then(function (tok) {
      return fetch(SUPABASE_URL + '/rest/v1/' + path, Object.assign({ headers: headers(tok, (opts && opts.prefer) ? { Prefer: opts.prefer } : {}) }, opts || {}))
        .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || r.status); }); return r.status === 204 ? null : r.json(); });
    });
  }

  window.Chat = {
    ready: ready,
    myId: myId,
    threadKey: threadKey,

    // All messages that involve me, newest first.
    all: function () {
      var me = myId(); if (!me) return Promise.resolve([]);
      return rest('messages?select=*&or=(sender.eq.' + me + ',recipient.eq.' + me + ')&order=created_at.desc')
        .catch(function () { return []; });
    },

    // Group my messages into one entry per conversation (latest message + unread count).
    threads: function () {
      var me = myId();
      return this.all().then(function (rows) {
        var byKey = {};
        (rows || []).forEach(function (m) {
          var other = String(m.sender) === String(me) ? m.recipient : m.sender;
          var otherName = String(m.sender) === String(me) ? m.recipient_name : m.sender_name;
          var k = m.thread_key;
          if (!byKey[k]) byKey[k] = { key: k, otherId: other, otherName: otherName || 'User', last: m, unread: 0 };
          // rows are newest-first, so the first seen is the latest
          if (String(m.recipient) === String(me) && !m.read_at) byKey[k].unread++;
          if (otherName && byKey[k].otherName === 'User') byKey[k].otherName = otherName;
        });
        return Object.keys(byKey).map(function (k) { return byKey[k]; })
          .sort(function (a, b) { return new Date(b.last.created_at) - new Date(a.last.created_at); });
      });
    },

    // Full message history for the conversation with `otherId`, oldest first.
    thread: function (otherId) {
      var me = myId(); if (!me) return Promise.resolve([]);
      return rest('messages?select=*&thread_key=eq.' + encodeURIComponent(threadKey(me, otherId)) + '&order=created_at.asc')
        .catch(function () { return []; });
    },

    send: function (recipient, recipientName, body, opts) {
      var me = myId();
      if (!me) return Promise.reject(new Error('not logged in'));
      opts = opts || {};
      var att = opts.attachment || {};
      var row = {
        thread_key: threadKey(me, recipient), sender: me, recipient: recipient,
        sender_name: myName(), recipient_name: recipientName || '', body: body,
        request_id: opts.requestId || null, request_title: opts.requestTitle || null,
        attachment_url: att.url || null, attachment_name: att.name || null, attachment_type: att.type || null
      };
      return rest('messages', { method: 'POST', body: JSON.stringify(row), prefer: 'return=representation' })
        .then(function (rows) { return Array.isArray(rows) ? rows[0] : rows; });
    },

    markRead: function (otherId) {
      var me = myId(); if (!me) return Promise.resolve();
      return rest('messages?recipient=eq.' + me + '&sender=eq.' + otherId + '&read_at=is.null',
        { method: 'PATCH', body: JSON.stringify({ read_at: new Date().toISOString() }), prefer: 'return=minimal' }).catch(function () {});
    },

    unreadCount: function () {
      var me = myId(); if (!me) return Promise.resolve(0);
      return Auth.token().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/messages?select=id&recipient=eq.' + me + '&read_at=is.null',
          { headers: headers(tok, { Prefer: 'count=exact' }) })
          .then(function (r) {
            var cr = r.headers.get('content-range'); // e.g. 0-9/42
            if (cr && cr.indexOf('/') >= 0) { var n = parseInt(cr.split('/')[1], 10); return isNaN(n) ? 0 : n; }
            return r.json().then(function (a) { return (a || []).length; });
          });
      }).catch(function () { return 0; });
    }
  };

  // ---------- Reusable chat panel ----------
  function tt(k, en) { try { return t(k); } catch (e) { return en; } }
  var POLL = null;

  function attachHTML(m) {
    if (!m.attachment_url) return '';
    var u = m.attachment_url, safe = window.safeUrl ? safeUrl(u) : u;
    if (m.attachment_type === 'image') {
      return '<button type="button" class="chat-att-img lb-ph" data-url="' + esc(u) + '" data-type="image" onclick="openLightbox(this)" style="background-image:url(\'' + safe + '\')"></button>';
    }
    if (m.attachment_type === 'video') {
      return '<button type="button" class="chat-att-img lb-ph" data-url="' + esc(u) + '" data-type="video" onclick="openLightbox(this)">' +
        '<video src="' + encodeURI(u) + '" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>' +
        '<span class="lb-play">' + (window.ICONS ? ICONS.play : '▶') + '</span></button>';
    }
    return '<a class="chat-att-file" href="' + encodeURI(u) + '" target="_blank" rel="noopener">' +
      (window.ICONS ? ICONS.download : '') + ' ' + esc(m.attachment_name || tt('chat_file', 'File')) + '</a>';
  }
  function bubble(m, me) {
    var mine = String(m.sender) === String(me);
    var tag = m.request_id
      ? '<a class="chat-ref" href="request-detail.html?id=' + encodeURIComponent(m.request_id) + '">' + (window.ICONS ? ICONS.clipboard : '') + ' ' + esc(m.request_title || tt('chat_ref', 'Request')) + '</a>'
      : '';
    var att = attachHTML(m);
    var text = m.body ? '<div class="chat-bubble">' + esc(m.body).replace(/\n/g, '<br>') + '</div>' : '';
    // Incoming messages can be reported.
    var report = '';
    if (!mine && window.openReportModal && window.ICONS) {
      var excerpt = String(m.body || m.attachment_name || '').slice(0, 200).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      report = '<button class="msg-report" title="' + tt('report', 'Report') + '" onclick="openReportModal(\'message\',\'' + esc(String(m.id)) + '\',\'' + esc(excerpt) + '\')">' + ICONS.flag + '</button>';
    }
    return '<div class="chat-msg ' + (mine ? 'me' : 'them') + '">' + tag + att + text +
      '<div class="chat-time">' + new Date(m.created_at).toLocaleString() + report + '</div></div>';
  }

  function paint(listEl, msgs, me) {
    listEl.innerHTML = msgs.length
      ? msgs.map(function (m) { return bubble(m, me); }).join('')
      : '<div class="muted" style="text-align:center;padding:30px 12px">' + tt('chat_empty', 'No messages yet — say hello!') + '</div>';
    listEl.scrollTop = listEl.scrollHeight;
  }

  // Open a conversation. displayName labels the other party; opts may carry a
  // request to tag onto the first message (requestId, requestTitle).
  window.Chat.openWith = function (userId, displayName, opts) {
    opts = opts || {};
    if (!ready()) { alert('Messaging is not configured yet.'); return; }
    if (!Auth.isLoggedIn()) { if (window.openAuthModal) openAuthModal('login'); return; }
    if (String(userId) === String(myId())) { return; }   // can't message yourself

    var me = myId();
    var pending = opts.requestId ? { id: opts.requestId, title: opts.requestTitle } : null;

    var bd = document.createElement('div');
    bd.className = 'modal-backdrop chat-backdrop';
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    bd.innerHTML =
      '<div class="chat-panel">' +
        '<div class="chat-head">' +
          '<div><b>' + esc(displayName || tt('chat_title', 'Chat')) + '</b>' +
            (pending ? '<div class="chat-subref">' + tt('chat_re', 'Re:') + ' ' + esc(pending.title || '') + '</div>' : '') +
          '</div>' +
          '<button class="chat-close" aria-label="Close">' + (window.ICONS ? ICONS.close : '✕') + '</button>' +
        '</div>' +
        '<div class="chat-list" id="chatList"><div class="muted" style="text-align:center;padding:30px">…</div></div>' +
        '<div class="chat-staged" id="chatStaged" style="display:none"></div>' +
        '<form class="chat-compose" id="chatForm">' +
          '<input type="file" id="chatFile" accept="image/*,video/*,.pdf,.csv,.doc,.docx,.xls,.xlsx" style="display:none">' +
          '<button type="button" class="chat-attach" id="chatAttachBtn" aria-label="' + esc(tt('chat_attach', 'Attach a file')) + '" title="' + esc(tt('chat_attach', 'Attach a file')) + '">' + (window.ICONS ? ICONS.clip : '+') + '</button>' +
          '<textarea id="chatInput" rows="1" placeholder="' + esc(tt('chat_ph', 'Write a message…')) + '"></textarea>' +
          '<button class="btn btn-primary btn-sm" type="submit">' + tt('chat_send', 'Send') + '</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(bd);
    document.body.style.overflow = 'hidden';

    var listEl = bd.querySelector('#chatList');
    var input = bd.querySelector('#chatInput');
    var form = bd.querySelector('#chatForm');
    var fileInput = bd.querySelector('#chatFile');
    var stagedBar = bd.querySelector('#chatStaged');
    var staged = null;   // File pending upload
    bd.querySelector('.chat-close').onclick = close;

    bd.querySelector('#chatAttachBtn').onclick = function () { fileInput.click(); };
    fileInput.onchange = function () {
      staged = fileInput.files && fileInput.files[0];
      if (!staged) { stagedBar.style.display = 'none'; return; }
      stagedBar.style.display = '';
      stagedBar.innerHTML = '<span>' + (window.ICONS ? ICONS.clip : '') + ' ' + esc(staged.name) + '</span>' +
        '<button type="button" class="chat-staged-x" aria-label="remove">' + (window.ICONS ? ICONS.close : '✕') + '</button>';
      stagedBar.querySelector('.chat-staged-x').onclick = function () { staged = null; fileInput.value = ''; stagedBar.style.display = 'none'; stagedBar.innerHTML = ''; };
    };
    function fileKind(f) { var ty = f.type || ''; return ty.indexOf('image') === 0 ? 'image' : ty.indexOf('video') === 0 ? 'video' : 'file'; }
    function uploadStaged() {
      if (!staged) return Promise.resolve(null);
      return Auth.token().then(function (tok) { return AdminStore.uploadPublic(staged, tok, 'chat'); })
        .then(function (url) { return { url: url, name: staged.name, type: fileKind(staged) }; });
    }

    function refresh() {
      return Chat.thread(userId).then(function (msgs) {
        paint(listEl, msgs, me);
        Chat.markRead(userId);
        if (window.updateChatBadge) setTimeout(window.updateChatBadge, 400);
      });
    }
    function close() {
      if (POLL) { clearInterval(POLL); POLL = null; }
      document.body.style.overflow = '';
      bd.remove();
    }

    form.onsubmit = function (e) {
      e.preventDefault();
      var body = input.value.trim();
      if (!body && !staged) return;   // need text or a file
      var sendBtn = form.querySelector('button[type="submit"]');
      input.value = ''; sendBtn.disabled = true;
      uploadStaged().then(function (attachment) {
        var o = pending ? { requestId: pending.id, requestTitle: pending.title } : {};
        if (attachment) o.attachment = attachment;
        return Chat.send(userId, displayName, body, o);
      }).then(function () {
        pending = null; var sr = bd.querySelector('.chat-subref'); if (sr) sr.remove();
        staged = null; fileInput.value = ''; stagedBar.style.display = 'none'; stagedBar.innerHTML = '';
        sendBtn.disabled = false;
        return refresh();
      }).catch(function (err) { sendBtn.disabled = false; alert('Could not send: ' + (err.message || err)); input.value = body; });
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.onsubmit(e); } });

    refresh();
    POLL = setInterval(refresh, 4000);
  };

  // Header unread badge — pages that include chat.js can call this.
  window.updateChatBadge = function () {
    if (!ready() || !Auth.isLoggedIn()) return;
    Chat.unreadCount().then(function (n) {
      document.querySelectorAll('.msg-badge').forEach(function (el) {
        if (n > 0) { el.textContent = n > 99 ? '99+' : n; el.style.display = ''; }
        else { el.style.display = 'none'; }
      });
    });
  };
  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (window.updateChatBadge) updateChatBadge(); }, 800); });

  // Record a view (once per account) for a factory/request and show the total
  // in the element with the given id.
  window.loadViews = function (type, id, elId) {
    if (!window.AdminStore || !AdminStore.recordView) return;
    var tokP = (window.Auth && Auth.isLoggedIn()) ? Auth.token().catch(function () { return null; }) : Promise.resolve(null);
    tokP.then(function (tok) { return AdminStore.recordView(type, id, tok); })
      .then(function (cnt) {
        if (cnt == null) return;
        var el = document.getElementById(elId);
        if (el) el.textContent = (window.num ? num(cnt) : cnt);
      });
  };

  // ---------- Notifications (bell) ----------
  window.Notifs = {
    list: function () {
      var me = myId(); if (!me) return Promise.resolve([]);
      return rest('notifications?select=*&order=created_at.desc&limit=30').catch(function () { return []; });
    },
    unreadCount: function () {
      var me = myId(); if (!me) return Promise.resolve(0);
      return Auth.token().then(function (tok) {
        return fetch(SUPABASE_URL + '/rest/v1/notifications?select=id&read_at=is.null', { headers: headers(tok, { Prefer: 'count=exact' }) })
          .then(function (r) { var cr = r.headers.get('content-range'); if (cr && cr.indexOf('/') >= 0) { var n = parseInt(cr.split('/')[1], 10); return isNaN(n) ? 0 : n; } return r.json().then(function (a) { return (a || []).length; }); });
      }).catch(function () { return 0; });
    },
    markAllRead: function () {
      var me = myId(); if (!me) return Promise.resolve();
      return rest('notifications?read_at=is.null', { method: 'PATCH', body: JSON.stringify({ read_at: new Date().toISOString() }), prefer: 'return=minimal' }).catch(function () {});
    }
  };

  window.updateNotifBadge = function () {
    if (!ready() || !Auth.isLoggedIn()) return;
    Notifs.unreadCount().then(function (n) {
      document.querySelectorAll('.notif-badge').forEach(function (el) {
        if (n > 0) { el.textContent = n > 99 ? '99+' : n; el.style.display = ''; }
        else { el.style.display = 'none'; }
      });
    });
  };

  function notifIcon(type) {
    var I = window.ICONS || {};
    return type === 'rfq' ? (I.clipboard || '')
      : type === 'review' ? (I.star || '')
      : type === 'view' ? (I.eye || '')
      : type === 'message' ? (I.chat || I.mail || '')
      : type === 'request' ? (I.clipboard || I.megaphone || '')
      : type === 'factory' ? (I.factory || I.check || '')
      : (I.megaphone || I.bell || '');
  }
  function relDays(iso) { var s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); try { return STR[LANG].days_ago(s); } catch (e) { return ''; } }

  window.toggleNotifs = function (ev) {
    if (ev) ev.stopPropagation();
    if (!ready() || !Auth.isLoggedIn()) { if (window.openAuthModal) openAuthModal('login'); return; }
    var existing = document.getElementById('notifPanel');
    if (existing) { existing.remove(); return; }
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }

    var panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.className = 'notif-panel';
    panel.innerHTML = '<div class="notif-head"><b>' + tt('nav_notifs', 'Notifications') + '</b></div><div class="notif-body">' + tt('loading', 'Loading…') + '</div>';
    document.body.appendChild(panel);
    setTimeout(function () { document.addEventListener('click', outside); }, 0);
    function outside(e) { if (!panel.contains(e.target) && !(e.target.closest && e.target.closest('.nav-bell'))) { panel.remove(); document.removeEventListener('click', outside); } }

    Notifs.list().then(function (items) {
      var body = panel.querySelector('.notif-body');
      body.innerHTML = items.length
        ? items.map(function (n) {
            return '<a class="notif-item' + (n.read_at ? '' : ' unread') + '" href="' + (n.link ? encodeURI(n.link) : '#') + '">' +
              '<span class="notif-ic">' + notifIcon(n.type) + '</span>' +
              '<span class="notif-txt"><b>' + esc(n.title || '') + '</b>' + (n.body ? '<span>' + esc(n.body) + '</span>' : '') +
                '<span class="notif-time">' + relDays(n.created_at) + '</span></span></a>';
          }).join('')
        : '<div class="muted" style="padding:26px;text-align:center">' + tt('notif_empty', 'No notifications yet') + '</div>';
      Notifs.markAllRead().then(function () { if (window.updateNotifBadge) updateNotifBadge(); });
    });
  };

  // While the tab is open, surface genuinely new notifications as browser
  // pop-ups (needs the user to allow notifications). Background push (site
  // closed) will ride on the email/push infrastructure later.
  function browserNotify(items) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var seen = {}; try { seen = JSON.parse(localStorage.getItem('sonnaNotifSeen') || '{}'); } catch (e) {}
    var first = Object.keys(seen).length === 0;
    var fresh = items.filter(function (n) { return !seen[n.id] && !n.read_at; });
    if (!first) fresh.slice(0, 3).forEach(function (n) { try { new Notification(n.title || 'Sonnaع', { body: n.body || '' }); } catch (e) {} });
    items.forEach(function (n) { seen[n.id] = 1; });
    try { localStorage.setItem('sonnaNotifSeen', JSON.stringify(seen)); } catch (e) {}
  }
  function pollNotifs() {
    if (!ready() || !Auth.isLoggedIn()) return;
    Notifs.list().then(function (items) { browserNotify(items); if (window.updateNotifBadge) updateNotifBadge(); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(pollNotifs, 1200);
    setInterval(pollNotifs, 25000);
  });
})();
