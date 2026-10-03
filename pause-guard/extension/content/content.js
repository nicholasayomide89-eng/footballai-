/*
 * Pause Guard — runs inside facebook.com and messenger.com pages.
 *
 * Stops restricted actions before Facebook's own code sees them, shows the
 * pause screen, and leaves everything else (scrolling, reading, liking,
 * commenting) alone. It never reads message text and sends nothing anywhere.
 */
(function () {
  'use strict';

  if (window.__pauseGuardLoaded) return;
  window.__pauseGuardLoaded = true;

  var Rules = window.PauseGuardRules;
  var Detect = window.PauseGuardDetect;
  var ext = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  // Until stored settings load (a few ms), use the safe defaults.
  var settings = Rules.defaultSettings();
  var pending = null;
  var overlayHost = null;
  var badgeHost = null;
  var lastBlockAt = 0;

  /* ---------- Settings ---------- */

  function load() {
    if (!ext || !ext.storage) return;
    try {
      var p = ext.storage.local.get(['settings', 'pending']);
      if (p && typeof p.then === 'function') {
        p.then(onLoaded, function () {});
      } else {
        ext.storage.local.get(['settings', 'pending'], onLoaded);
      }
    } catch (e) {
      ext.storage.local.get(['settings', 'pending'], onLoaded);
    }
  }

  function onLoaded(data) {
    data = data || {};
    if (data.settings) settings = Rules.normalizeSettings(data.settings);
    pending = data.pending || null;
    renderBadge();
  }

  if (ext && ext.storage && ext.storage.onChanged) {
    ext.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (changes.settings) settings = Rules.normalizeSettings(changes.settings.newValue);
      if (changes.pending) pending = changes.pending.newValue || null;
      renderBadge();
    });
  }

  if (ext && ext.runtime && ext.runtime.onMessage) {
    // The settings screen asks who the current page is about, so you can add
    // them to your list in one tap.
    ext.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || msg.type !== 'pg:page-person' || window.top !== window) return;
      var target = Detect.findTarget(null, location.href, document.title);
      sendResponse({ handles: target.handles, name: target.names[0] || '' });
    });
  }

  /* ---------- Blocking ---------- */

  function decide(found) {
    if (!found) return null;
    var target = Detect.findTarget(found.element, location.href, document.title);
    var verdict = Rules.shouldBlock(settings, found.action, target, Date.now());
    if (!verdict.block) return null;
    return { action: found.action, verdict: verdict };
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function block(event, decision) {
    stop(event);
    // One gesture fires several events; show the pause screen once.
    var now = Date.now();
    if (now - lastBlockAt > 400 || !overlayHost) showPause(decision);
    lastBlockAt = now;
  }

  // Early pointer events: swallow them silently so Facebook can't act on
  // press-down, then show the pause screen on the click that follows.
  function onPress(event) {
    if (overlayHost && overlayHost.contains(event.target)) return;
    var decision = decide(Detect.classifyClick(event.target, location.href));
    if (decision) {
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  function onClick(event) {
    if (overlayHost && overlayHost.contains(event.target)) return;
    var decision = decide(Detect.classifyClick(event.target, location.href));
    if (decision) block(event, decision);
  }

  function onKey(event) {
    if (overlayHost) {
      if (event.key === 'Escape') { stop(event); hidePause(); }
      return;
    }
    var decision = decide(Detect.classifyKey(event, location.href));
    if (decision) block(event, decision);
  }

  function onSubmit(event) {
    var decision = decide(Detect.classifySubmit(event.target, event.submitter, location.href));
    if (decision) block(event, decision);
  }

  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'touchend'].forEach(function (type) {
    window.addEventListener(type, onPress, { capture: true });
  });
  window.addEventListener('click', onClick, true);
  window.addEventListener('auxclick', onClick, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keypress', function (e) {
    if (decide(Detect.classifyKey(e, location.href))) stop(e);
  }, true);
  window.addEventListener('beforeinput', function (e) {
    // Some message boxes send on the "new paragraph" input itself.
    if (e.inputType !== 'insertParagraph' && e.inputType !== 'insertLineBreak') return;
    var fake = { key: 'Enter', shiftKey: e.inputType === 'insertLineBreak', isComposing: false, target: e.target };
    if (decide(Detect.classifyKey(fake, location.href))) stop(e);
  }, true);
  window.addEventListener('submit', onSubmit, true);

  /* ---------- Pause screen ---------- */

  var STYLE = [
    ':host{all:initial}',
    '.backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(15,20,25,.55);display:flex;',
    'align-items:center;justify-content:center;padding:16px;font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    '.card{background:#fff;color:#14171a;border-radius:16px;max-width:420px;width:100%;padding:24px;',
    'box-shadow:0 12px 40px rgba(0,0,0,.35);box-sizing:border-box}',
    '.icon{width:48px;height:48px;border-radius:50%;background:#e8f0fe;color:#1b4fbf;display:flex;',
    'align-items:center;justify-content:center;font-size:24px;font-weight:700;margin-bottom:12px}',
    'h2{font-size:22px;line-height:1.25;margin:0 0 8px;font-weight:700}',
    'p{margin:0 0 12px}',
    '.detail{color:#3d4852;font-size:15px}',
    '.hint{color:#57606a;font-size:14px}',
    'button{all:unset;box-sizing:border-box;display:block;width:100%;text-align:center;background:#1b4fbf;',
    'color:#fff;font-weight:600;font-size:17px;padding:14px 16px;border-radius:12px;cursor:pointer;margin-top:8px;min-height:48px}',
    'button:focus-visible{outline:3px solid #f5a623;outline-offset:2px}',
    '@media (prefers-color-scheme:dark){.card{background:#1c2128;color:#f0f3f6}.detail{color:#c9d1d9}',
    '.hint{color:#9da7b1}.icon{background:#1f3460;color:#a8c4ff}button{background:#3d74e8}}',
    '@media (prefers-reduced-motion:no-preference){.card{animation:pg-in .16s ease-out}}',
    '@keyframes pg-in{from{transform:scale(.96);opacity:0}to{transform:none;opacity:1}}'
  ].join('');

  function untilText(status) {
    if (status.until) return 'until ' + Rules.formatClock(status.until, Date.now());
    if (status.reasons.indexOf('always') !== -1) return 'at all times';
    return '';
  }

  function whoText(verdict) {
    if (verdict.why === 'everyone') return 'for everyone';
    if (verdict.why === 'selected') return 'for ' + (verdict.person.name || 'this person') + ' (on your list)';
    if (verdict.why === 'unknown-target') return 'because Pause Guard couldn’t tell who this was for';
    return '';
  }

  function showPause(decision) {
    hidePause();
    var previousFocus = document.activeElement;
    var status = Rules.protectionStatus(settings, Date.now());

    overlayHost = document.createElement('div');
    overlayHost.setAttribute('data-pause-guard', 'overlay');
    var shadow = overlayHost.attachShadow({ mode: 'closed' });
    var style = document.createElement('style');
    style.textContent = STYLE;
    shadow.appendChild(style);

    var backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    var card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'pg-title');
    card.setAttribute('aria-describedby', 'pg-detail');

    var icon = document.createElement('div');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '‖';
    var h = document.createElement('h2');
    h.id = 'pg-title';
    h.textContent = 'Pause. You chose to block this action';
    var detail = document.createElement('p');
    detail.id = 'pg-detail';
    detail.className = 'detail';
    detail.textContent = Rules.ACTION_LABELS[decision.action] + ' is blocked ' +
      [whoText(decision.verdict), untilText(status)].filter(Boolean).join(' ') + '.';
    var hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'You can keep browsing Facebook. To change this, open Pause Guard' +
      (settings.delayMinutes > 0 ? ' — loosening protection takes ' + Rules.formatMinutes(settings.delayMinutes) + '.' : '.');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Back to Facebook';

    function close() {
      hidePause();
      if (previousFocus && previousFocus.focus) {
        try { previousFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); btn.focus(); }
    });

    card.appendChild(icon);
    card.appendChild(h);
    card.appendChild(detail);
    card.appendChild(hint);
    card.appendChild(btn);
    backdrop.appendChild(card);
    shadow.appendChild(backdrop);
    (document.body || document.documentElement).appendChild(overlayHost);
    btn.focus();

    // Test hook: lets automated tests see what was shown (closed shadow DOM).
    overlayHost.setAttribute('data-action', decision.action);
    overlayHost.setAttribute('data-text', h.textContent + ' ' + detail.textContent);
  }

  function hidePause() {
    if (overlayHost && overlayHost.parentNode) overlayHost.parentNode.removeChild(overlayHost);
    overlayHost = null;
  }

  /* ---------- Status badge ---------- */

  var BADGE_STYLE = [
    ':host{all:initial}',
    '.pill{position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483645;',
    'display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);box-sizing:border-box;',
    'font:600 13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;',
    'padding:8px 12px;border-radius:999px;background:#0f5132;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);',
    'border:0;cursor:pointer;opacity:.92;text-align:left}',
    '.pill.off{background:#57606a}',
    '.dot{width:8px;height:8px;border-radius:50%;background:#7ee2a8;flex:none}',
    '.off .dot{background:#d0d7de}',
    '.pill:focus-visible{outline:3px solid #f5a623;outline-offset:2px}',
    '.more{font-weight:400}'
  ].join('');

  var SHORT = { message: 'messages', follow: 'follows', friend: 'friend requests' };

  function renderBadge() {
    if (window.top !== window) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', renderBadge, { once: true });
      return;
    }
    if (!settings.showBadge) {
      if (badgeHost) { badgeHost.remove(); badgeHost = null; }
      return;
    }
    var status = Rules.protectionStatus(settings, Date.now());
    if (!badgeHost) {
      badgeHost = document.createElement('div');
      badgeHost.setAttribute('data-pause-guard', 'badge');
      badgeHost._shadow = badgeHost.attachShadow({ mode: 'open' });
      document.body.appendChild(badgeHost);
    }
    var shadow = badgeHost._shadow;
    shadow.textContent = '';
    var style = document.createElement('style');
    style.textContent = BADGE_STYLE;
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pill' + (status.active ? '' : ' off');
    var dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    var text = document.createElement('span');
    var blocked = Rules.ACTIONS.filter(function (a) { return settings.actions[a]; })
      .map(function (a) { return SHORT[a]; });
    if (status.active) {
      var who = settings.scope === 'everyone' ? '' : ' (selected people)';
      text.textContent = 'Pause Guard on';
      var more = document.createElement('span');
      more.className = 'more';
      more.textContent = ' · blocking ' + blocked.join(', ') + who +
        (status.until ? ' until ' + Rules.formatClock(status.until, Date.now()) : '');
      text.appendChild(more);
    } else {
      text.textContent = 'Pause Guard off';
      var next = Rules.nextScheduledStart(settings, Date.now());
      if (next && status.anyAction) {
        var m = document.createElement('span');
        m.className = 'more';
        m.textContent = ' · starts ' + Rules.formatClock(next, Date.now());
        text.appendChild(m);
      }
    }
    pill.setAttribute('aria-label', text.textContent + '. Open Pause Guard settings.');
    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      if (ext && ext.runtime && ext.runtime.sendMessage) {
        try { ext.runtime.sendMessage({ type: 'pg:open-settings' }); } catch (err) { /* ignore */ }
      }
    });
    pill.appendChild(dot);
    pill.appendChild(text);
    shadow.appendChild(style);
    shadow.appendChild(pill);
    badgeHost.setAttribute('data-active', status.active ? 'true' : 'false');
  }

  // Schedules and timed locks start and end on their own; refresh the badge.
  setInterval(renderBadge, 30000);

  load();
  renderBadge();
})();
