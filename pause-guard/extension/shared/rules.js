/*
 * Pause Guard — shared rules.
 *
 * Pure logic with no DOM or browser APIs, so it can run in the content script,
 * the settings page, and Node tests. Nothing here reads message contents.
 */
(function (root) {
  'use strict';

  var ACTIONS = ['message', 'follow', 'friend'];

  var ACTION_LABELS = {
    message: 'Sending messages',
    follow: 'Following people',
    friend: 'Sending friend requests'
  };

  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var SITES = ['facebook.com', 'm.facebook.com', 'mbasic.facebook.com', 'messenger.com'];

  function defaultSettings() {
    return {
      version: 1,
      enabled: true,
      actions: { message: true, follow: true, friend: true },
      // 'everyone' or 'selected'
      scope: 'everyone',
      // [{ id, name, handles: ['zuck', '4'] }]
      people: [],
      // When scope is 'selected' and we can't tell who an action targets.
      unknownTarget: 'block',
      alwaysOn: true,
      // [{ id, days: [1,2,3,4,5], start: '09:00', end: '17:00' }]
      schedules: [],
      // Epoch ms; 0 when no timed lock.
      lockUntil: 0,
      // Waiting period before loosening protection takes effect.
      delayMinutes: 15,
      showBadge: true
    };
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeSettings(input) {
    var d = defaultSettings();
    var s = input && typeof input === 'object' ? input : {};
    var out = {
      version: 1,
      enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
      actions: {},
      scope: s.scope === 'selected' ? 'selected' : 'everyone',
      people: Array.isArray(s.people) ? s.people.filter(isValidPerson).map(normalizePerson) : [],
      unknownTarget: s.unknownTarget === 'allow' ? 'allow' : 'block',
      alwaysOn: typeof s.alwaysOn === 'boolean' ? s.alwaysOn : d.alwaysOn,
      schedules: Array.isArray(s.schedules) ? s.schedules.filter(isValidSchedule).map(normalizeSchedule) : [],
      lockUntil: Number.isFinite(s.lockUntil) && s.lockUntil > 0 ? s.lockUntil : 0,
      delayMinutes: Number.isFinite(s.delayMinutes) && s.delayMinutes >= 0 ? Math.min(Math.floor(s.delayMinutes), 10080) : d.delayMinutes,
      showBadge: typeof s.showBadge === 'boolean' ? s.showBadge : d.showBadge
    };
    ACTIONS.forEach(function (a) {
      var v = s.actions && s.actions[a];
      out.actions[a] = typeof v === 'boolean' ? v : d.actions[a];
    });
    return out;
  }

  /* ---------- Time helpers ---------- */

  var TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

  function parseTime(hhmm) {
    var m = TIME_RE.exec(hhmm || '');
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function isValidSchedule(s) {
    return !!s && Array.isArray(s.days) && s.days.length > 0 &&
      parseTime(s.start) !== null && parseTime(s.end) !== null &&
      s.start !== s.end;
  }

  function normalizeSchedule(s) {
    var days = s.days
      .map(Number)
      .filter(function (d) { return d >= 0 && d <= 6; })
      .filter(function (d, i, arr) { return arr.indexOf(d) === i; })
      .sort();
    return { id: String(s.id || makeId()), days: days, start: s.start, end: s.end };
  }

  function minutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  /*
   * A schedule window that ends earlier than it starts runs overnight, e.g.
   * 22:00–07:00 on Monday covers Monday 22:00 to Tuesday 07:00.
   */
  function scheduleCovers(schedule, date) {
    var start = parseTime(schedule.start);
    var end = parseTime(schedule.end);
    var now = minutesOfDay(date);
    var today = date.getDay();
    var yesterday = (today + 6) % 7;
    if (start < end) {
      return schedule.days.indexOf(today) !== -1 && now >= start && now < end;
    }
    // Overnight window.
    if (schedule.days.indexOf(today) !== -1 && now >= start) return true;
    if (schedule.days.indexOf(yesterday) !== -1 && now < end) return true;
    return false;
  }

  /* Finds when the currently covering schedule window ends. */
  function scheduleEndsAt(schedule, date) {
    var end = parseTime(schedule.end);
    var start = parseTime(schedule.start);
    var d = new Date(date.getTime());
    d.setSeconds(0, 0);
    if (start > end && minutesOfDay(date) >= start) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(Math.floor(end / 60), end % 60, 0, 0);
    return d.getTime();
  }

  /*
   * Returns { active, reasons: [...], until } where until is the epoch ms the
   * current protection is known to last until (null when indefinite).
   */
  function protectionStatus(settings, nowMs) {
    var s = settings;
    var now = new Date(nowMs);
    var reasons = [];
    var untils = [];
    var anyAction = ACTIONS.some(function (a) { return s.actions[a]; });

    if (!s.enabled || !anyAction) {
      return { active: false, reasons: [], until: null, anyAction: anyAction };
    }
    if (s.lockUntil && s.lockUntil > nowMs) {
      reasons.push('lock');
      untils.push(s.lockUntil);
    }
    if (s.alwaysOn) {
      reasons.push('always');
      untils.push(Infinity);
    }
    s.schedules.forEach(function (sch) {
      if (scheduleCovers(sch, now)) {
        if (reasons.indexOf('schedule') === -1) reasons.push('schedule');
        untils.push(scheduleEndsAt(sch, now));
      }
    });
    var until = untils.length ? Math.max.apply(null, untils) : null;
    return {
      active: reasons.length > 0,
      reasons: reasons,
      until: until === Infinity ? null : until,
      anyAction: anyAction
    };
  }

  /* Next time a schedule window starts, for display when protection is off. */
  function nextScheduledStart(settings, nowMs) {
    if (!settings.enabled) return null;
    var best = null;
    var base = new Date(nowMs);
    for (var offset = 0; offset <= 7; offset++) {
      var day = new Date(base.getTime());
      day.setDate(day.getDate() + offset);
      settings.schedules.forEach(function (sch) {
        if (sch.days.indexOf(day.getDay()) === -1) return;
        var start = parseTime(sch.start);
        var t = new Date(day.getTime());
        t.setHours(Math.floor(start / 60), start % 60, 0, 0);
        if (t.getTime() > nowMs && (best === null || t.getTime() < best)) best = t.getTime();
      });
    }
    return best;
  }

  /* ---------- People ---------- */

  function makeId() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function isValidPerson(p) {
    return !!p && Array.isArray(p.handles) && p.handles.length > 0;
  }

  function normalizePerson(p) {
    var handles = p.handles
      .map(function (h) { return String(h).toLowerCase().trim(); })
      .filter(Boolean)
      .filter(function (h, i, arr) { return arr.indexOf(h) === i; });
    return { id: String(p.id || makeId()), name: String(p.name || '').slice(0, 80), handles: handles };
  }

  // First path segments on facebook.com that are never a person's username.
  var RESERVED_PATHS = [
    '', 'home.php', 'watch', 'groups', 'marketplace', 'gaming', 'events', 'pages',
    'friends', 'messages', 'notifications', 'settings', 'search', 'photo', 'photo.php',
    'photos', 'story.php', 'stories', 'reel', 'reels', 'hashtag', 'login', 'login.php',
    'bookmarks', 'saved', 'memories', 'help', 'policies', 'privacy', 'ads', 'business',
    'permalink.php', 'sharer', 'sharer.php', 'dialog', 'a', 'me', 'menu', 'feeds',
    'composer', 'checkpoint', 'recover', 'r.php', 'l.php', 'videos', 'live', 'news',
    'fundraisers', 'jobs', 'weather', 'coronavirus_info', 'buddylist.php', 'notes',
    'privacy_sandbox', 'legal', 'terms', 'allactivity', 'profile', 't', 'e2ee', 'new'
  ];

  /*
   * Extracts the identifiers a Facebook/Messenger URL points at: a username or
   * a numeric profile ID. Returns [] for URLs that don't name a person.
   */
  function handlesFromUrl(rawUrl, baseUrl) {
    var url;
    try {
      url = new URL(rawUrl, baseUrl || 'https://www.facebook.com/');
    } catch (e) {
      return [];
    }
    var host = url.hostname.toLowerCase();
    var isFb = /(^|\.)facebook\.com$/.test(host) || host === 'fb.com' || host === 'fb.me';
    var isMessenger = /(^|\.)messenger\.com$/.test(host);
    if (!isFb && !isMessenger) return [];

    var parts = url.pathname.split('/').filter(Boolean).map(function (p) {
      try { return decodeURIComponent(p).toLowerCase(); } catch (e) { return p.toLowerCase(); }
    });
    var q = url.searchParams;
    var out = [];
    function add(h) {
      if (h && out.indexOf(h) === -1) out.push(String(h).toLowerCase());
    }

    // Posts, photos, groups etc. carry an ?id= that is not a person.
    var idPaths = ['profile.php', 'a', 'messages', 'friends', 'people', 'add_friend.php'];
    if (!isMessenger && parts.length && RESERVED_PATHS.indexOf(parts[0]) !== -1 &&
        idPaths.indexOf(parts[0]) === -1 && parts.indexOf('t') === -1) {
      return out;
    }

    // Query-string IDs used across desktop, mobile and basic Facebook.
    ['id', 'uid', 'profile_id', 'subject_id', 'ids'].forEach(function (k) {
      var v = q.get(k);
      if (v && /^\d{3,}$/.test(v)) add(v);
    });
    var tid = q.get('tid');
    if (tid) {
      var m = /(\d{5,})/.exec(tid);
      if (m) add(m[1]);
    }

    // messenger.com/t/<id>, facebook.com/messages/t/<id>, .../e2ee/t/<id>
    var tIndex = parts.indexOf('t');
    if (tIndex !== -1 && parts[tIndex + 1]) {
      add(parts[tIndex + 1]);
      return out;
    }
    if (isMessenger) return out;

    if (parts[0] === 'people' && parts[2] && /^\d+$/.test(parts[2])) {
      add(parts[2]);
      return out;
    }
    if (parts[0] === 'profile.php') return out;
    if (parts[0] === 'messages' && parts[1] === 'read') return out;
    if (parts.length >= 1 && RESERVED_PATHS.indexOf(parts[0]) === -1 && /^[a-z0-9.\-]{2,}$/.test(parts[0])) {
      add(parts[0]);
    }
    return out;
  }

  /* Turns whatever the user typed (URL, @handle, ID) into handles. */
  function handlesFromInput(text) {
    var t = String(text || '').trim();
    if (!t) return [];
    if (/^@?[a-z0-9.\-]{2,}$/i.test(t) && !/\.(com|me)$/i.test(t)) {
      return [t.replace(/^@/, '').toLowerCase()];
    }
    if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
    return handlesFromUrl(t);
  }

  /*
   * Decides whether an attempted action should be blocked.
   * target = { handles: [...], names: [...] } — what we could learn about who
   * the action is aimed at. Returns { block, why }.
   */
  function shouldBlock(settings, action, target, nowMs) {
    var status = protectionStatus(settings, nowMs);
    if (!status.active) return { block: false, why: 'inactive' };
    if (!settings.actions[action]) return { block: false, why: 'action-allowed' };
    if (settings.scope === 'everyone') return { block: true, why: 'everyone' };

    var handles = (target && target.handles) || [];
    var names = ((target && target.names) || []).map(function (n) { return n.toLowerCase().trim(); });
    var matched = settings.people.find(function (p) {
      if (p.handles.some(function (h) { return handles.indexOf(h) !== -1; })) return true;
      var pname = p.name.toLowerCase().trim();
      return pname.length >= 3 && names.some(function (n) { return n === pname; });
    });
    if (matched) return { block: true, why: 'selected', person: matched };
    if (handles.length === 0 && names.length === 0) {
      return settings.unknownTarget === 'block'
        ? { block: true, why: 'unknown-target' }
        : { block: false, why: 'unknown-target' };
    }
    return { block: false, why: 'not-selected' };
  }

  /* ---------- Waiting period ---------- */

  function sameList(a, b) {
    return a.length === b.length && a.every(function (x, i) { return x === b[i]; });
  }

  function scheduleKey(s) {
    return s.days.join(',') + '|' + s.start + '|' + s.end;
  }

  /*
   * Lists the ways `next` gives less protection than `prev`. An empty list
   * means the change can apply straight away.
   */
  function weakeningChanges(prev, next, nowMs) {
    var out = [];
    if (prev.enabled && !next.enabled) out.push('Turn protection off');
    ACTIONS.forEach(function (a) {
      if (prev.actions[a] && !next.actions[a]) out.push('Stop blocking: ' + ACTION_LABELS[a].toLowerCase());
    });
    if (prev.scope === 'everyone' && next.scope === 'selected') {
      out.push('Only block for selected people instead of everyone');
    }
    if (next.scope === 'selected') {
      prev.people.forEach(function (p) {
        var still = next.people.some(function (q) {
          return p.handles.every(function (h) { return q.handles.indexOf(h) !== -1; }) &&
            (!p.name || q.name === p.name);
        });
        if (!still) out.push('Remove or change ' + (p.name || p.handles[0]) + ' in the selected people');
      });
    }
    if (prev.unknownTarget === 'block' && next.unknownTarget === 'allow') {
      out.push('Allow actions when the person can\'t be identified');
    }
    if (prev.alwaysOn && !next.alwaysOn) out.push('Turn off "always on"');
    var nextKeys = next.schedules.map(scheduleKey);
    prev.schedules.forEach(function (s) {
      if (nextKeys.indexOf(scheduleKey(s)) === -1) {
        out.push('Remove or change schedule ' + describeSchedule(s));
      }
    });
    var prevLock = prev.lockUntil > nowMs ? prev.lockUntil : 0;
    var nextLock = next.lockUntil > nowMs ? next.lockUntil : 0;
    if (prevLock && nextLock < prevLock) out.push('End the timed lock early');
    if (next.delayMinutes < prev.delayMinutes) {
      out.push('Shorten the waiting period to ' + formatMinutes(next.delayMinutes));
    }
    return out;
  }

  /*
   * Applies a save request. Strengthening changes apply now; loosening ones
   * become a pending request that unlocks after the waiting period.
   * Returns { settings, pending, applied: bool, waits: [...] }.
   */
  function requestChange(current, proposed, nowMs) {
    var next = normalizeSettings(proposed);
    var waits = weakeningChanges(current, next, nowMs);
    if (waits.length === 0) {
      return { settings: next, pending: null, applied: true, waits: [] };
    }
    if (current.delayMinutes === 0) {
      return { settings: next, pending: null, applied: true, waits: waits };
    }
    // Apply the parts that tighten protection now, so a pending request
    // never delays a stricter setting.
    var merged = mergeStricter(current, next, nowMs);
    return {
      settings: merged,
      pending: {
        requestedAt: nowMs,
        baseLockUntil: current.lockUntil,
        readyAt: nowMs + current.delayMinutes * 60000,
        proposed: next,
        changes: waits
      },
      applied: false,
      waits: waits
    };
  }

  /* Combines two settings, keeping whichever side protects more. */
  function mergeStricter(a, b, nowMs) {
    var out = clone(a);
    out.enabled = a.enabled || b.enabled;
    ACTIONS.forEach(function (k) { out.actions[k] = a.actions[k] || b.actions[k]; });
    out.scope = a.scope === 'everyone' || b.scope === 'everyone' ? 'everyone' : 'selected';
    var people = clone(a.people);
    b.people.forEach(function (p) {
      var exists = people.some(function (q) { return sameList(q.handles.slice().sort(), p.handles.slice().sort()); });
      if (!exists) people.push(clone(p));
    });
    out.people = people;
    out.unknownTarget = a.unknownTarget === 'block' || b.unknownTarget === 'block' ? 'block' : 'allow';
    out.alwaysOn = a.alwaysOn || b.alwaysOn;
    var keys = a.schedules.map(scheduleKey);
    out.schedules = clone(a.schedules);
    b.schedules.forEach(function (s) {
      if (keys.indexOf(scheduleKey(s)) === -1) out.schedules.push(clone(s));
    });
    out.lockUntil = Math.max(a.lockUntil > nowMs ? a.lockUntil : 0, b.lockUntil > nowMs ? b.lockUntil : 0);
    out.delayMinutes = Math.max(a.delayMinutes, b.delayMinutes);
    out.showBadge = b.showBadge;
    return out;
  }

  /*
   * Returns the settings a pending request asked for once its wait is over,
   * or null while it is still waiting. A timed lock started while waiting is
   * kept rather than cancelled by the request.
   */
  function applyPending(current, pending, nowMs) {
    if (!pending || nowMs < pending.readyAt) return null;
    var out = normalizeSettings(pending.proposed);
    // Keep a lock started after the request, but not the one it ended early.
    if (current.lockUntil > nowMs && current.lockUntil !== pending.baseLockUntil &&
        current.lockUntil > out.lockUntil) {
      out.lockUntil = current.lockUntil;
    }
    return out;
  }

  /* ---------- Formatting ---------- */

  function formatMinutes(m) {
    if (m === 0) return 'no wait';
    if (m < 60) return m + (m === 1 ? ' minute' : ' minutes');
    if (m % 1440 === 0) { var d = m / 1440; return d + (d === 1 ? ' day' : ' days'); }
    if (m % 60 === 0) { var h = m / 60; return h + (h === 1 ? ' hour' : ' hours'); }
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }

  function formatTime(hhmm) {
    var mins = parseTime(hhmm);
    if (mins === null) return hhmm;
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ampm = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }

  function describeDays(days) {
    var sorted = days.slice().sort();
    if (sorted.length === 7) return 'Every day';
    if (sameList(sorted, [1, 2, 3, 4, 5])) return 'Weekdays';
    if (sameList(sorted, [0, 6])) return 'Weekends';
    return sorted.map(function (d) { return DAY_NAMES[d]; }).join(', ');
  }

  function describeSchedule(s) {
    return describeDays(s.days) + ' ' + formatTime(s.start) + '–' + formatTime(s.end) +
      (parseTime(s.end) < parseTime(s.start) ? ' (overnight)' : '');
  }

  function formatClock(ms, nowMs) {
    var d = new Date(ms);
    var n = new Date(nowMs);
    var hh = d.getHours();
    var mm = d.getMinutes();
    var time = formatTime((hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm);
    var sameDay = d.toDateString() === n.toDateString();
    if (sameDay) return time;
    var tomorrow = new Date(nowMs);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return 'tomorrow at ' + time;
    return DAY_NAMES[d.getDay()] + ' ' + d.getDate() + ' at ' + time;
  }

  function formatCountdown(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) return h + ' h ' + m + ' min';
    if (m > 0) return m + ' min ' + (s < 10 ? '0' : '') + s + ' s';
    return s + ' s';
  }

  /* A one-line, human summary of what is blocked and for whom. */
  function describeCoverage(settings) {
    var actions = ACTIONS.filter(function (a) { return settings.actions[a]; })
      .map(function (a) { return ACTION_LABELS[a].toLowerCase(); });
    var who = settings.scope === 'everyone'
      ? 'everyone'
      : settings.people.length === 0
        ? 'selected people (none added yet)'
        : settings.people.length + (settings.people.length === 1 ? ' selected person' : ' selected people');
    return { actions: actions, who: who };
  }

  var api = {
    ACTIONS: ACTIONS,
    ACTION_LABELS: ACTION_LABELS,
    DAY_NAMES: DAY_NAMES,
    SITES: SITES,
    defaultSettings: defaultSettings,
    normalizeSettings: normalizeSettings,
    parseTime: parseTime,
    scheduleCovers: scheduleCovers,
    protectionStatus: protectionStatus,
    nextScheduledStart: nextScheduledStart,
    handlesFromUrl: handlesFromUrl,
    handlesFromInput: handlesFromInput,
    shouldBlock: shouldBlock,
    weakeningChanges: weakeningChanges,
    requestChange: requestChange,
    applyPending: applyPending,
    mergeStricter: mergeStricter,
    formatMinutes: formatMinutes,
    formatTime: formatTime,
    formatClock: formatClock,
    formatCountdown: formatCountdown,
    describeSchedule: describeSchedule,
    describeCoverage: describeCoverage,
    makeId: makeId
  };

  root.PauseGuardRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
