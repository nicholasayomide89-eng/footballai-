/*
 * Pause Guard — status and settings screen.
 * Everything is stored with the browser's extension storage on this device.
 */
(function () {
  'use strict';

  var Rules = window.PauseGuardRules;
  var ext = typeof browser !== 'undefined' && browser.storage ? browser
    : typeof chrome !== 'undefined' && chrome.storage ? chrome : null;

  /* Storage: extension storage, or localStorage when previewing the page directly. */
  var store = {
    get: function () {
      if (ext) {
        return new Promise(function (resolve) {
          var r = ext.storage.local.get(['settings', 'pending'], resolve);
          if (r && typeof r.then === 'function') r.then(resolve);
        });
      }
      var out = {};
      try {
        out.settings = JSON.parse(localStorage.getItem('pg.settings') || 'null') || undefined;
        out.pending = JSON.parse(localStorage.getItem('pg.pending') || 'null');
      } catch (e) { /* preview without storage */ }
      return Promise.resolve(out);
    },
    set: function (data) {
      if (ext) {
        return new Promise(function (resolve) {
          var r = ext.storage.local.set(data, resolve);
          if (r && typeof r.then === 'function') r.then(resolve);
        });
      }
      try {
        Object.keys(data).forEach(function (k) { localStorage.setItem('pg.' + k, JSON.stringify(data[k])); });
      } catch (e) { /* preview without storage */ }
      return Promise.resolve();
    }
  };

  var current = Rules.defaultSettings();
  var pending = null;
  var draft = null;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Status ---------- */

  function renderStatus() {
    var now = Date.now();
    var status = Rules.protectionStatus(current, now);
    var cov = Rules.describeCoverage(current);
    var box = $('status');
    box.classList.toggle('on', status.active);
    box.classList.toggle('off', !status.active);

    $('status-text').textContent = status.active ? 'Protection is ON' : 'Protection is OFF';
    var why = [];
    if (!current.enabled) why.push('The master switch is off.');
    else if (!status.anyAction) why.push('No actions are selected to block.');
    else if (status.active) {
      if (status.reasons.indexOf('always') !== -1) why.push('Always on.');
      if (status.reasons.indexOf('lock') !== -1) why.push('Timed lock until ' + Rules.formatClock(current.lockUntil, now) + '.');
      if (status.reasons.indexOf('schedule') !== -1) why.push('Scheduled block running.');
      if (status.until) why.push('Active until ' + Rules.formatClock(status.until, now) + '.');
    } else {
      var next = Rules.nextScheduledStart(current, now);
      why.push(next ? 'Next scheduled block starts ' + Rules.formatClock(next, now) + '.' : 'No schedule or timed lock is running.');
    }
    $('status-why').textContent = why.join(' ');
    $('status-actions').textContent = cov.actions.length ? capitalise(cov.actions.join(', ')) : 'Nothing';
    $('status-who').textContent = capitalise(cov.who);
    $('status-where').textContent = 'Safari (or this browser) on facebook.com, m.facebook.com and messenger.com';
    $('lock-end-row').hidden = !(current.lockUntil > now);
  }

  function renderPending() {
    var box = $('pending');
    if (!pending) { box.hidden = true; return; }
    box.hidden = false;
    var now = Date.now();
    var ready = now >= pending.readyAt;
    $('pending-text').textContent = ready
      ? 'Your waiting period is over. Apply these changes only if you still want to:'
      : 'You asked to loosen protection. Until the wait ends, your current protection stays on:';
    var list = $('pending-list');
    list.textContent = '';
    pending.changes.forEach(function (c) {
      var li = document.createElement('li');
      li.textContent = c;
      list.appendChild(li);
    });
    $('pending-countdown').textContent = ready
      ? 'Ready now'
      : 'Available in ' + Rules.formatCountdown(pending.readyAt - now) + ' (at ' + Rules.formatClock(pending.readyAt, now) + ')';
    $('pending-apply').disabled = !ready;
  }

  function capitalise(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ---------- Form ---------- */

  function fillForm(s) {
    $('enabled').checked = s.enabled;
    $('act-message').checked = s.actions.message;
    $('act-follow').checked = s.actions.follow;
    $('act-friend').checked = s.actions.friend;
    $('scope-everyone').checked = s.scope === 'everyone';
    $('scope-selected').checked = s.scope === 'selected';
    $('unknown-target').value = s.unknownTarget;
    $('always-on').checked = s.alwaysOn;
    var delay = $('delay');
    if (!Array.prototype.some.call(delay.options, function (o) { return Number(o.value) === s.delayMinutes; })) {
      var opt = document.createElement('option');
      opt.value = String(s.delayMinutes);
      opt.textContent = Rules.formatMinutes(s.delayMinutes);
      delay.appendChild(opt);
    }
    delay.value = String(s.delayMinutes);
    $('show-badge').checked = s.showBadge;
    renderPeople(s);
    renderSchedules(s);
    $('people-area').hidden = s.scope !== 'selected';
  }

  function readForm() {
    var s = JSON.parse(JSON.stringify(draft));
    s.enabled = $('enabled').checked;
    s.actions = {
      message: $('act-message').checked,
      follow: $('act-follow').checked,
      friend: $('act-friend').checked
    };
    s.scope = $('scope-selected').checked ? 'selected' : 'everyone';
    s.unknownTarget = $('unknown-target').value;
    s.alwaysOn = $('always-on').checked;
    s.delayMinutes = Number($('delay').value);
    s.showBadge = $('show-badge').checked;
    return Rules.normalizeSettings(s);
  }

  function renderPeople(s) {
    var list = $('people-list');
    list.textContent = '';
    s.people.forEach(function (p) {
      var li = document.createElement('li');
      var info = document.createElement('div');
      var name = document.createElement('strong');
      name.textContent = p.name || p.handles[0];
      var meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = p.handles.join(', ');
      info.appendChild(name);
      info.appendChild(meta);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn small';
      rm.textContent = 'Remove';
      rm.setAttribute('aria-label', 'Remove ' + (p.name || p.handles[0]));
      rm.addEventListener('click', function () {
        draft.people = draft.people.filter(function (q) { return q.id !== p.id; });
        onDraftChanged();
      });
      li.appendChild(info);
      li.appendChild(rm);
      list.appendChild(li);
    });
    $('people-empty').hidden = s.people.length > 0;
  }

  function renderSchedules(s) {
    var list = $('schedule-list');
    list.textContent = '';
    s.schedules.forEach(function (sch) {
      var li = document.createElement('li');
      var text = document.createElement('span');
      text.textContent = Rules.describeSchedule(sch);
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn small';
      rm.textContent = 'Remove';
      rm.setAttribute('aria-label', 'Remove schedule ' + Rules.describeSchedule(sch));
      rm.addEventListener('click', function () {
        draft.schedules = draft.schedules.filter(function (x) { return x.id !== sch.id; });
        onDraftChanged();
      });
      li.appendChild(text);
      li.appendChild(rm);
      list.appendChild(li);
    });
    $('schedule-empty').hidden = s.schedules.length > 0;
  }

  function isDirty() {
    var a = JSON.parse(JSON.stringify(current));
    var b = JSON.parse(JSON.stringify(draft));
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  function onDraftChanged() {
    draft = readForm();
    renderPeople(draft);
    renderSchedules(draft);
    $('people-area').hidden = draft.scope !== 'selected';
    var dirty = isDirty();
    $('savebar').hidden = !dirty;
    if (!dirty) return;
    var waits = Rules.weakeningChanges(current, draft, Date.now());
    if (waits.length && current.delayMinutes > 0) {
      $('save-summary').textContent = 'Some of these changes loosen protection, so they will wait ' +
        Rules.formatMinutes(current.delayMinutes) + ' before taking effect. Stricter changes apply now.' +
        (pending ? ' This replaces your earlier request and restarts the wait.' : '');
    } else {
      $('save-summary').textContent = 'These changes apply immediately.' +
        (pending ? ' Saving cancels your earlier waiting request.' : '');
    }
  }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.textContent = ''; }, 6000);
  }

  function save(proposed) {
    var result = Rules.requestChange(current, proposed, Date.now());
    current = result.settings;
    pending = result.pending;
    draft = JSON.parse(JSON.stringify(current));
    return store.set({ settings: current, pending: pending }).then(function () {
      fillForm(current);
      $('savebar').hidden = true;
      renderAll();
      toast(result.applied
        ? 'Saved.'
        : 'Stricter changes saved. Loosening changes will be available ' + Rules.formatClock(pending.readyAt, Date.now()) + '.');
      return result;
    });
  }

  function startLock(minutes) {
    var now = Date.now();
    var until = Math.max(current.lockUntil > now ? current.lockUntil : 0, now + minutes * 60000);
    current.lockUntil = until;
    if (draft) draft.lockUntil = until;
    // Starting a lock is never undone by a request made earlier.
    store.set({ settings: current, pending: pending }).then(function () {
      renderAll();
      toast('Timed lock on until ' + Rules.formatClock(until, Date.now()) + '.');
    });
  }

  function renderAll() {
    renderStatus();
    renderPending();
  }

  /* ---------- Events ---------- */

  function wire() {
    var form = $('settings-form');
    form.addEventListener('change', function (e) {
      if (e.target.closest('.add-box')) return;
      onDraftChanged();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      save(readForm());
    });
    $('discard').addEventListener('click', function () {
      draft = JSON.parse(JSON.stringify(current));
      fillForm(current);
      $('savebar').hidden = true;
    });

    document.querySelectorAll('[data-lock]').forEach(function (b) {
      b.addEventListener('click', function () { startLock(Number(b.getAttribute('data-lock'))); });
    });
    $('lock-custom-go').addEventListener('click', function () {
      var m = Number($('lock-custom').value);
      if (!Number.isFinite(m) || m < 1 || m > 43200) {
        toast('Enter a number of minutes between 1 and 43200.');
        return;
      }
      startLock(Math.round(m));
      $('lock-custom').value = '';
    });
    $('end-lock').addEventListener('click', function () {
      var proposed = JSON.parse(JSON.stringify(current));
      proposed.lockUntil = 0;
      save(proposed);
    });

    $('pending-cancel').addEventListener('click', function () {
      pending = null;
      store.set({ pending: null }).then(function () { renderAll(); toast('Request cancelled. Protection unchanged.'); });
    });
    $('pending-apply').addEventListener('click', function () {
      var next = Rules.applyPending(current, pending, Date.now());
      if (!next) return;
      current = next;
      pending = null;
      draft = JSON.parse(JSON.stringify(current));
      store.set({ settings: current, pending: null }).then(function () {
        fillForm(current);
        renderAll();
        toast('Changes applied.');
      });
    });

    $('person-add').addEventListener('click', function () {
      var handles = Rules.handlesFromInput($('person-link').value);
      if (!handles.length) {
        $('person-error').textContent = 'That doesn’t look like a Facebook or Messenger profile or chat link.';
        return;
      }
      addPerson(handles, $('person-name').value.trim());
      $('person-link').value = '';
      $('person-name').value = '';
    });

    $('sched-add').addEventListener('click', function () {
      var days = Array.prototype.filter.call(document.querySelectorAll('.days input'), function (i) { return i.checked; })
        .map(function (i) { return Number(i.value); });
      var start = $('sched-start').value;
      var end = $('sched-end').value;
      var err = $('sched-error');
      if (!days.length) { err.textContent = 'Pick at least one day.'; return; }
      if (Rules.parseTime(start) === null || Rules.parseTime(end) === null) { err.textContent = 'Enter a start and end time.'; return; }
      if (start === end) { err.textContent = 'Start and end can’t be the same time.'; return; }
      err.textContent = '';
      draft.schedules.push({ id: Rules.makeId(), days: days, start: start, end: end });
      onDraftChanged();
    });

    setupCurrentTabButton();

    if (ext && ext.storage && ext.storage.onChanged) {
      ext.storage.onChanged.addListener(function (changes, area) {
        if (area !== 'local') return;
        if (changes.settings) current = Rules.normalizeSettings(changes.settings.newValue);
        if (changes.pending) pending = changes.pending.newValue || null;
        if (!isDirty()) { draft = JSON.parse(JSON.stringify(current)); fillForm(current); }
        renderAll();
      });
    }

    setInterval(renderAll, 1000);
  }

  function addPerson(handles, name) {
    $('person-error').textContent = '';
    var existing = draft.people.find(function (p) {
      return p.handles.some(function (h) { return handles.indexOf(h) !== -1; }) ||
        (name && p.name && p.name.toLowerCase() === name.toLowerCase());
    });
    if (existing) {
      handles.forEach(function (h) { if (existing.handles.indexOf(h) === -1) existing.handles.push(h); });
      if (!existing.name && name) existing.name = name;
    } else {
      draft.people.push({ id: Rules.makeId(), name: name, handles: handles });
    }
    if (draft.scope !== 'selected') {
      $('scope-selected').checked = true;
    }
    onDraftChanged();
  }

  /* Offers "Add person on current page" when opened over a Facebook tab. */
  function setupCurrentTabButton() {
    var api = typeof browser !== 'undefined' && browser.tabs ? browser : typeof chrome !== 'undefined' && chrome.tabs ? chrome : null;
    if (!api) return;
    var query = api.tabs.query({ active: true, currentWindow: true });
    var handle = function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || tab.id == null) return;
      var ask = function (resp) {
        // Reading lastError tells Chrome we expected "no Facebook tab" errors.
        if (api.runtime && api.runtime.lastError) return;
        if (!resp || !resp.handles || !resp.handles.length) return;
        var btn = $('person-from-tab');
        btn.hidden = false;
        btn.textContent = 'Add ' + (resp.name ? capitalise(resp.name) : resp.handles[0]) + ' (current page)';
        btn.onclick = function () { addPerson(resp.handles, resp.name ? capitalise(resp.name) : ''); };
      };
      try {
        if (typeof browser !== 'undefined' && api === browser) {
          api.tabs.sendMessage(tab.id, { type: 'pg:page-person' }).then(ask, function () {});
        } else {
          api.tabs.sendMessage(tab.id, { type: 'pg:page-person' }, ask);
        }
      } catch (e) { /* not a Facebook tab */ }
    };
    if (query && typeof query.then === 'function') query.then(handle, function () {});
    else api.tabs.query({ active: true, currentWindow: true }, handle);
  }

  /* ---------- Start ---------- */

  store.get().then(function (data) {
    current = Rules.normalizeSettings(data && data.settings);
    pending = (data && data.pending) || null;
    draft = JSON.parse(JSON.stringify(current));
    if (!data || !data.settings) store.set({ settings: current });
    fillForm(current);
    renderAll();
    wire();
  });
})();
