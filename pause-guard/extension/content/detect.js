/*
 * Pause Guard — recognises restricted actions on Facebook and Messenger pages.
 *
 * It only looks at button labels, link addresses and the page address. It
 * never reads what you type or the messages on screen.
 *
 * Facebook changes its markup often and labels depend on your language, so
 * the patterns below are the part most likely to need updating.
 */
(function (root) {
  'use strict';

  var Rules = root.PauseGuardRules;

  var INTERACTIVE = 'a,button,[role="button"],[role="link"],[role="menuitem"],input[type="submit"],input[type="button"]';

  // Matched against a lower-cased, whitespace-collapsed label.
  var PATTERNS = {
    friend: [
      /^add friend$/,
      /^add as friend$/,
      /^add [^,]{1,60} as (a )?friend$/,
      /^send (a )?friend request$/,
      /^send request$/,
      /^add friend to /
    ],
    follow: [
      /^follow$/,
      /^follow back$/,
      /^follow (page|profile|this page|[^,]{1,60})$/
    ],
    message: [
      /^message$/,
      /^send message$/,
      /^message [^,]{1,60}$/,
      /^send$/,
      /^send now$/,
      /^press enter to send$/,
      /^send a like$/,
      /^send like$/,
      /^send a thumbs up$/,
      /^send (a )?(sticker|gif|voice (clip|message)|photo)$/,
      /^reply$/
    ]
  };

  // Labels that look similar but are not restricted actions.
  var EXCLUDE = [
    /^following/, /^followers/, /^unfollow/, /^follow(ed|s)\b/,
    /^messages?\s*requests?/, /^messages$/, /^message (settings|delivery|options)/,
    /^cancel/, /^friends$/, /^friend requests?$/, /^see all friends/,
    /^send (feedback|code|login|email|verification)/
  ];

  // Link addresses that perform an action directly (mostly the basic mobile site).
  var HREF_PATTERNS = {
    friend: [/\/a\/friends\/add/i, /add_friend\.php/i, /\/friends\/requests\/send/i, /\/a\/mobile\/friends\/add/i],
    follow: [/\/a\/subscribe\.php/i, /\/a\/profile\.php\?.*fan/i, /subscriptions\/add/i],
    message: [/\/messages\/compose/i, /\/messages\/send/i]
  };

  var COMPOSER_LABEL = /(^| )(message|messages|aa|send a message|type a message|write a message|write to)( |$|…|\.\.\.)/i;
  var NOT_COMPOSER_LABEL = /comment|post|status|search|story|caption|bio|describe/i;

  function cleanLabel(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 120);
  }

  function labelOf(el) {
    if (!el || el.nodeType !== 1) return '';
    var aria = el.getAttribute('aria-label');
    if (aria) return cleanLabel(aria);
    var labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy && el.ownerDocument) {
      var parts = labelledBy.split(/\s+/).map(function (id) {
        var n = el.ownerDocument.getElementById(id);
        return n ? n.textContent : '';
      });
      var joined = cleanLabel(parts.join(' '));
      if (joined) return joined;
    }
    if (el.tagName === 'INPUT') return cleanLabel(el.value || el.getAttribute('name'));
    // Visible text of the control only — buttons, never message bodies.
    var text = el.textContent || '';
    if (text.length > 120) return '';
    return cleanLabel(text);
  }

  function matchAction(label) {
    if (!label) return null;
    for (var i = 0; i < EXCLUDE.length; i++) {
      if (EXCLUDE[i].test(label)) return null;
    }
    var order = ['friend', 'follow', 'message'];
    for (var j = 0; j < order.length; j++) {
      var list = PATTERNS[order[j]];
      for (var k = 0; k < list.length; k++) {
        if (list[k].test(label)) return order[j];
      }
    }
    return null;
  }

  function matchHref(href) {
    if (!href) return null;
    var keys = Object.keys(HREF_PATTERNS);
    for (var i = 0; i < keys.length; i++) {
      var list = HREF_PATTERNS[keys[i]];
      for (var j = 0; j < list.length; j++) {
        if (list[j].test(href)) return keys[i];
      }
    }
    return null;
  }

  /* The "send" button for a message must sit in a messaging area. */
  function looksLikeMessaging(el, pageUrl) {
    if (isMessagingUrl(pageUrl)) return true;
    var node = el;
    for (var i = 0; node && i < 25; i++, node = node.parentElement) {
      var aria = cleanLabel(node.getAttribute && node.getAttribute('aria-label'));
      if (/^(chat|conversation|messenger|messages|chats|new message)/.test(aria)) return true;
      if (node.tagName === 'FORM' && /messages|send/i.test(node.getAttribute('action') || '')) return true;
      // A message box right next to the button (a few levels up at most).
      if (i < 6 && node !== el && node.querySelector) {
        var composer = node.querySelector('[contenteditable="true"],textarea');
        if (composer && isComposer(composer, pageUrl)) return true;
      }
    }
    return false;
  }

  function isMessagingUrl(pageUrl) {
    try {
      var u = new URL(pageUrl);
      if (/(^|\.)messenger\.com$/.test(u.hostname)) return true;
      return /^\/(messages|messenger_media)(\/|$)/.test(u.pathname) || /^\/[^/]+\/inbox/.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  /* Is this text field where you write a message (not a comment or post)? */
  function isComposer(el, pageUrl) {
    if (!el || el.nodeType !== 1) return false;
    var editable = el.isContentEditable || el.getAttribute('contenteditable') === 'true' ||
      el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search)?$/.test(el.type || ''));
    if (!editable) return false;
    var hint = cleanLabel([
      el.getAttribute('aria-label'), el.getAttribute('placeholder'),
      el.getAttribute('aria-placeholder'), el.getAttribute('name'), el.getAttribute('data-pg-hint')
    ].filter(Boolean).join(' '));
    if (NOT_COMPOSER_LABEL.test(hint)) return false;
    if (COMPOSER_LABEL.test(hint)) return true;
    if (el.tagName === 'TEXTAREA' && el.getAttribute('name') === 'body') return isMessagingUrl(pageUrl);
    return isMessagingUrl(pageUrl) && !hint;
  }

  /*
   * Works out which restricted action, if any, a click on `target` performs.
   * Returns { action, element } or null.
   */
  function classifyClick(target, pageUrl) {
    var el = target && target.nodeType === 1 ? target : target && target.parentElement;
    if (!el || !el.closest) return null;
    var control = el.closest(INTERACTIVE);
    if (!control) return null;
    if (control.closest('[data-pause-guard]')) return null;

    var action = matchAction(labelOf(control));
    if (!action && control.tagName === 'A') action = matchHref(control.getAttribute('href'));
    if (!action) {
      // An icon inside a button often carries the label instead.
      var labelled = control.querySelector('[aria-label]');
      if (labelled) action = matchAction(labelOf(labelled));
    }
    if (!action) return null;

    // "Send"/"Reply" are generic words; only count them in a messaging area.
    var label = labelOf(control);
    if (action === 'message' && /^(send|send now|reply)$/.test(label) && !looksLikeMessaging(control, pageUrl)) {
      return null;
    }
    return { action: action, element: control };
  }

  /* Works out which restricted action a form submission performs. */
  function classifySubmit(form, submitter, pageUrl) {
    if (!form || form.closest('[data-pause-guard]')) return null;
    if (submitter) {
      var byButton = classifyClick(submitter, pageUrl);
      if (byButton) return byButton;
    }
    var action = matchHref(form.getAttribute('action'));
    if (action) return { action: action, element: form };
    var field = form.querySelector('textarea,[contenteditable="true"]');
    if (field && isComposer(field, pageUrl)) return { action: 'message', element: form };
    return null;
  }

  /* Enter (without Shift) in a message box sends it. */
  function classifyKey(event, pageUrl) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return null;
    var el = event.target;
    if (!el || el.nodeType !== 1) return null;
    var field = el.closest ? (el.closest('[contenteditable="true"],textarea,input') || el) : el;
    if (isComposer(field, pageUrl)) return { action: 'message', element: field };
    if (field.matches && field.matches(INTERACTIVE)) return classifyClick(field, pageUrl);
    return null;
  }

  /* Profile link ancestors to try when finding who an action is aimed at. */
  var CARD_SELECTOR = '[role="article"],[role="listitem"],[role="dialog"],[role="complementary"],li,article';

  function profileLinkIn(container, skip, pageUrl) {
    var links = container.querySelectorAll('a[href]');
    for (var i = 0; i < links.length && i < 30; i++) {
      if (links[i] === skip) continue;
      var found = Rules.handlesFromUrl(links[i].getAttribute('href'), pageUrl);
      if (found.length) {
        var name = cleanLabel(links[i].getAttribute('aria-label') || links[i].textContent);
        return { handles: found, name: name && name.length <= 80 ? name : '' };
      }
    }
    return null;
  }

  /*
   * Collects what we can tell about who the action targets: profile links in
   * the same card, the address of the page, and the page title. Never reads
   * message text.
   */
  function findTarget(element, pageUrl, pageTitle) {
    var handles = [];
    var names = [];
    function addHandles(list) {
      list.forEach(function (h) { if (handles.indexOf(h) === -1) handles.push(h); });
    }

    if (element && element.tagName === 'A') {
      addHandles(Rules.handlesFromUrl(element.getAttribute('href') || '', pageUrl));
    }

    // A button inside a card (search result, "People you may know", chat
    // window) is about the person that card links to.
    var card = element && element.closest ? element.closest(CARD_SELECTOR) : null;
    if (handles.length === 0 && card) {
      var inCard = profileLinkIn(card, element, pageUrl);
      if (inCard) {
        addHandles(inCard.handles);
        if (inCard.name) names.push(inCard.name);
      }
    }

    // Otherwise it's about the page itself: a profile or an open conversation.
    if (handles.length === 0) addHandles(Rules.handlesFromUrl(pageUrl));

    // Last resort: the closest profile link a few levels up.
    var node = element;
    for (var depth = 0; node && depth < 5 && handles.length === 0; depth++) {
      node = node.parentElement;
      if (!node || node.tagName === 'BODY') break;
      var near = profileLinkIn(node, element, pageUrl);
      if (near) {
        addHandles(near.handles);
        if (near.name) names.push(near.name);
      }
    }

    if (!card) {
      var title = cleanLabel(String(pageTitle || '').replace(/^\(\d+\)\s*/, ''));
      var titleName = title.split(/\s+[|·-]\s+/)[0];
      if (titleName && !/^(facebook|messenger|messages|chats|log in)/.test(titleName) && titleName.length <= 80) {
        names.push(titleName);
      }
    }
    return { handles: handles, names: names };
  }

  var api = {
    PATTERNS: PATTERNS,
    labelOf: labelOf,
    matchAction: matchAction,
    classifyClick: classifyClick,
    classifySubmit: classifySubmit,
    classifyKey: classifyKey,
    isComposer: isComposer,
    isMessagingUrl: isMessagingUrl,
    findTarget: findTarget
  };

  root.PauseGuardDetect = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
