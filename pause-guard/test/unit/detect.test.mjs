// Classifier tests run in a real browser page (Chromium via Playwright) so
// they use a real DOM, without loading the extension.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ext = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'extension');
let browser, page;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ path: path.join(ext, 'shared/rules.js') });
  await page.addScriptTag({ path: path.join(ext, 'content/detect.js') });
});

after(async () => { await browser?.close(); });

async function classify(html, url = 'https://www.facebook.com/') {
  return page.evaluate(([html, url]) => {
    document.body.innerHTML = html;
    const el = document.querySelector('[data-t]');
    const r = window.PauseGuardDetect.classifyClick(el, url);
    return r && r.action;
  }, [html, url]);
}

test('recognises friend request buttons', async () => {
  assert.equal(await classify('<div role="button" aria-label="Add friend" data-t></div>'), 'friend');
  assert.equal(await classify('<div role="button"><span data-t>Add Friend</span></div>'), 'friend');
  assert.equal(await classify('<a href="/a/friends/add/?id=123456" data-t>Add</a>', 'https://mbasic.facebook.com/x'), 'friend');
  assert.equal(await classify('<div role="button" aria-label="Cancel request" data-t></div>'), null);
  assert.equal(await classify('<div role="button" aria-label="Friends" data-t></div>'), null);
});

test('recognises follow buttons but not "Following"/"Unfollow"', async () => {
  assert.equal(await classify('<div role="button" aria-label="Follow" data-t></div>'), 'follow');
  assert.equal(await classify('<button data-t>Follow back</button>'), 'follow');
  assert.equal(await classify('<div role="button" aria-label="Following" data-t></div>'), null);
  assert.equal(await classify('<div role="button" aria-label="Unfollow Alex" data-t></div>'), null);
  assert.equal(await classify('<a href="/x/followers" data-t>Followers</a>'), null);
});

test('recognises message buttons', async () => {
  assert.equal(await classify('<div role="button" aria-label="Message" data-t></div>'), 'message');
  assert.equal(await classify('<div role="button" aria-label="Press Enter to send" data-t></div>', 'https://www.facebook.com/messages/t/1'), 'message');
  assert.equal(await classify('<div role="button" aria-label="Send a Like" data-t></div>'), 'message');
  assert.equal(await classify('<a href="/messages" data-t>Messages</a>'), null);
  assert.equal(await classify('<div role="button" aria-label="Message requests" data-t></div>'), null);
});

test('"Send" only counts inside a messaging area', async () => {
  // A "Send" button in a chat popup (has a message box next to it).
  assert.equal(await classify(
    '<div aria-label="Chat with Alex"><div contenteditable="true" aria-label="Message"></div><div role="button" aria-label="Send" data-t></div></div>'
  ), 'message');
  // A "Send" button somewhere unrelated on the news feed.
  assert.equal(await classify('<div><input aria-label="Write a comment…"><div role="button" aria-label="Send" data-t></div></div>'), null);
  // Any "Send" on a messaging page.
  assert.equal(await classify('<div role="button" aria-label="Send" data-t></div>', 'https://www.messenger.com/t/1'), 'message');
});

test('ignores ordinary browsing', async () => {
  assert.equal(await classify('<div role="button" aria-label="Like" data-t></div>'), null);
  assert.equal(await classify('<div role="button" aria-label="Comment" data-t></div>'), null);
  assert.equal(await classify('<a href="/zuck" data-t>Mark</a>'), null);
  assert.equal(await classify('<span data-t>Just some text</span>'), null);
});

test('Enter in a message box counts as sending; Enter in a comment box does not', async () => {
  const res = await page.evaluate(() => {
    const D = window.PauseGuardDetect;
    document.body.innerHTML =
      '<div contenteditable="true" aria-label="Message" id="m"></div>' +
      '<div contenteditable="true" aria-label="Write a comment…" id="c"></div>' +
      '<textarea name="body" id="b"></textarea>';
    const k = (id, extra = {}) => {
      const r = D.classifyKey({ key: 'Enter', shiftKey: false, isComposing: false, target: document.getElementById(id), ...extra }, 'https://www.facebook.com/');
      return r && r.action;
    };
    const kOnMessages = (id) => {
      const r = D.classifyKey({ key: 'Enter', shiftKey: false, target: document.getElementById(id) }, 'https://m.facebook.com/messages/read/?tid=cid.c.1');
      return r && r.action;
    };
    return {
      message: k('m'), comment: k('c'), shift: k('m', { shiftKey: true }),
      basicBodyOffMessages: k('b'), basicBodyOnMessages: kOnMessages('b')
    };
  });
  assert.equal(res.message, 'message');
  assert.equal(res.comment, null);
  assert.equal(res.shift, null);
  assert.equal(res.basicBodyOffMessages, null);
  assert.equal(res.basicBodyOnMessages, 'message');
});

test('findTarget uses the card the button is in, then the page URL', async () => {
  const res = await page.evaluate(() => {
    const D = window.PauseGuardDetect;
    document.body.innerHTML =
      '<ul><li><a href="/jane.doe">Jane Doe</a><div role="button" aria-label="Add friend" id="a"></div></li>' +
      '<li><a href="/profile.php?id=4455667788">Sam</a><div role="button" aria-label="Add friend" id="b"></div></li></ul>' +
      '<div><div role="button" aria-label="Message" id="c"></div></div>';
    return {
      a: D.findTarget(document.getElementById('a'), 'https://www.facebook.com/friends', 'Friends | Facebook'),
      b: D.findTarget(document.getElementById('b'), 'https://www.facebook.com/friends', 'Friends | Facebook'),
      c: D.findTarget(document.getElementById('c'), 'https://www.facebook.com/alex.example', '(3) Alex Example | Facebook')
    };
  });
  assert.deepEqual(res.a.handles, ['jane.doe']);
  assert.deepEqual(res.a.names, ['jane doe']);
  assert.deepEqual(res.b.handles, ['4455667788']);
  assert.deepEqual(res.c.handles, ['alex.example']);
  assert.deepEqual(res.c.names, ['alex example']);
});
