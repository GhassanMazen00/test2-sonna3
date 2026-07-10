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
      var row = {
        thread_key: threadKey(me, recipient), sender: me, recipient: recipient,
        sender_name: myName(), recipient_name: recipientName || '', body: body,
        request_id: opts.requestId || null, request_title: opts.requestTitle || null
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

  function bubble(m, me) {
    var mine = String(m.sender) === String(me);
    var tag = m.request_id
      ? '<a class="chat-ref" href="request-detail.html?id=' + encodeURIComponent(m.request_id) + '">' + (window.ICONS ? ICONS.clipboard : '') + ' ' + esc(m.request_title || tt('chat_ref', 'Request')) + '</a>'
      : '';
    return '<div class="chat-msg ' + (mine ? 'me' : 'them') + '">' + tag +
      '<div class="chat-bubble">' + esc(m.body).replace(/\n/g, '<br>') + '</div>' +
      '<div class="chat-time">' + new Date(m.created_at).toLocaleString() + '</div></div>';
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
        '<form class="chat-compose" id="chatForm">' +
          '<textarea id="chatInput" rows="1" placeholder="' + esc(tt('chat_ph', 'Write a message…')) + '"></textarea>' +
          '<button class="btn btn-primary btn-sm" type="submit">' + tt('chat_send', 'Send') + '</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(bd);
    document.body.style.overflow = 'hidden';

    var listEl = bd.querySelector('#chatList');
    var input = bd.querySelector('#chatInput');
    var form = bd.querySelector('#chatForm');
    bd.querySelector('.chat-close').onclick = close;

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
      if (!body) return;
      input.value = '';
      Chat.send(userId, displayName, body, pending ? { requestId: pending.id, requestTitle: pending.title } : {})
        .then(function () { pending = null; var sr = bd.querySelector('.chat-subref'); if (sr) sr.remove(); return refresh(); })
        .catch(function (err) { alert('Could not send: ' + (err.message || err)); input.value = body; });
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
})();
