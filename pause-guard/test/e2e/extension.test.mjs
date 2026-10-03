// End-to-end: loads the real extension into Chromium and serves a mock
// Facebook page at https://www.facebook.com/ (no real Facebook traffic).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.join(here, '..', '..', 'extension');
const fixture = await readFile(path.join(here, 'fixtures', 'facebook.html'), 'utf8');

let context, worker, page, profileDir, extId;

before(async () => {
  profileDir = await mkdtemp(path.join(os.tmpdir(), 'pg-e2e-'));
  context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`]
  });
  // Serve the mock page for any facebook.com / messenger.com address.
  await context.route(/https:\/\/([a-z]+\.)?(facebook|messenger)\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: fixture }));
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  extId = new URL(worker.url()).host;
});

after(async () => {
  await context?.close();
  if (profileDir) await rm(profileDir, { recursive: true, force: true });
});

async function setSettings(over) {
  await worker.evaluate(async (over) => {
    const defaults = {
      enabled: true, actions: { message: true, follow: true, friend: true }, scope: 'everyone',
      people: [], unknownTarget: 'block', alwaysOn: true, schedules: [], lockUntil: 0,
      delayMinutes: 15, showBadge: true
    };
    await chrome.storage.local.set({ settings: { ...defaults, ...over }, pending: null });
  }, over);
}

async function open(url = 'https://www.facebook.com/alex.example') {
  page = await context.newPage();
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('[data-pause-guard="badge"]'));
  // Let stored settings reach the content script.
  await page.waitForTimeout(150);
}

const log = () => page.evaluate(() => window.__log.slice());
const overlay = () => page.$('[data-pause-guard="overlay"]');
async function overlayText() {
  const el = await overlay();
  return el ? el.getAttribute('data-text') : null;
}
async function dismiss() {
  await page.keyboard.press('Escape');
  assert.equal(await overlay(), null, 'Escape closes the pause screen');
}

beforeEach(async () => {
  if (page) await page.close();
  page = null;
  await setSettings({});
});

test('blocks a friend request and shows the pause message', async () => {
  await open();
  await page.click('#profile-add');
  const text = await overlayText();
  assert.ok(text, 'pause screen shown');
  assert.match(text, /^Pause\. You chose to block this action/);
  assert.match(text, /Sending friend requests is blocked for everyone/);
  assert.deepEqual(await log(), [], 'Facebook never saw the click');
  await dismiss();
});

test('blocks follow and message buttons', async () => {
  await open();
  await page.click('#profile-follow');
  assert.equal(await (await overlay()).getAttribute('data-action'), 'follow');
  await dismiss();
  await page.click('#profile-message');
  assert.equal(await (await overlay()).getAttribute('data-action'), 'message');
  await dismiss();
  await page.click('#chat-send');
  assert.equal(await (await overlay()).getAttribute('data-action'), 'message');
  await dismiss();
  await page.click('#chat-like');
  assert.equal(await (await overlay()).getAttribute('data-action'), 'message');
  await dismiss();
  assert.deepEqual(await log(), []);
});

test('Enter in a chat is blocked; Shift+Enter, comments and likes still work', async () => {
  await open();
  await page.click('#chat-box');
  await page.keyboard.type('hi');
  await page.keyboard.press('Enter');
  assert.equal(await (await overlay()).getAttribute('data-action'), 'message');
  await dismiss();
  await page.click('#chat-box');
  await page.keyboard.press('Shift+Enter');
  await page.click('#comment-box');
  await page.keyboard.type('nice');
  await page.keyboard.press('Enter');
  await page.click('#post-like');
  assert.equal(await overlay(), null);
  const l = await log();
  assert.ok(!l.includes('enter:chat-box'), 'message not sent');
  assert.ok(l.includes('shift-enter:chat-box'), 'new line allowed');
  assert.ok(l.includes('enter:comment-box'), 'commenting still works');
  assert.ok(l.includes('click:post-like'), 'liking still works');
});

test('basic-site message form submit is blocked', async () => {
  await open('https://mbasic.facebook.com/messages/read/?tid=cid.c.100099');
  await page.fill('#basic-body', 'hello');
  await page.click('#basic-send');
  assert.equal(await (await overlay()).getAttribute('data-action'), 'message');
  assert.ok(!(await log()).includes('submit:basic-form'));
});

test('actions can be blocked independently', async () => {
  await setSettings({ actions: { message: false, follow: true, friend: false } });
  await open();
  await page.click('#profile-add');
  await page.click('#chat-send');
  assert.equal(await overlay(), null);
  await page.click('#profile-follow');
  assert.equal(await (await overlay()).getAttribute('data-action'), 'follow');
  const l = await log();
  assert.ok(l.includes('click:profile-add') && l.includes('click:chat-send'));
  assert.ok(!l.includes('click:profile-follow'));
});

test('selected people: only Jane is blocked', async () => {
  await setSettings({ scope: 'selected', people: [{ id: 'j', name: 'Jane Doe', handles: ['jane.doe', '100099'] }] });
  await open('https://www.facebook.com/friends');
  await page.click('#pymk-sam');
  assert.equal(await overlay(), null, 'Sam is not on the list');
  await page.click('#pymk-jane');
  assert.match(await overlayText(), /for Jane Doe \(on your list\)/);
  await dismiss();
  await page.click('#chat-send');
  assert.ok(await overlay(), 'chat with Jane (id 100099) is blocked');
  const l = await log();
  assert.ok(l.includes('click:pymk-sam'));
  assert.ok(!l.includes('click:pymk-jane'));
});

test('protection off outside schedule; timed lock turns it on', async () => {
  await setSettings({ alwaysOn: false });
  await open();
  assert.equal(await page.getAttribute('[data-pause-guard="badge"]', 'data-active'), 'false');
  await page.click('#profile-add');
  assert.equal(await overlay(), null);
  await setSettings({ alwaysOn: false, lockUntil: Date.now() + 3600000 });
  await page.waitForFunction(() => document.querySelector('[data-pause-guard="badge"]').getAttribute('data-active') === 'true');
  await page.click('#profile-follow');
  assert.ok(await overlay());
});

test('settings screen: loosening waits, protection stays on meanwhile', async () => {
  await setSettings({ delayMinutes: 15 });
  const app = await context.newPage();
  await app.goto(`chrome-extension://${extId}/app/app.html`);
  await app.waitForSelector('#status.on');
  assert.match(await app.textContent('#status-text'), /Protection is ON/);
  assert.match(await app.textContent('#status-where'), /facebook\.com/);

  // Turn off message blocking → becomes a pending request.
  await app.click('label:has(#act-message)');
  await app.waitForSelector('#savebar:not([hidden])');
  assert.match(await app.textContent('#save-summary'), /wait 15 minutes/);
  await app.click('#save');
  await app.waitForSelector('#pending:not([hidden])');
  assert.equal(await app.isDisabled('#pending-apply'), true);
  assert.match(await app.textContent('#pending-countdown'), /Available in 1[45] min/);
  const stored = await worker.evaluate(() => chrome.storage.local.get(['settings', 'pending']));
  assert.equal(stored.settings.actions.message, true, 'still blocked');
  assert.equal(stored.pending.proposed.actions.message, false);

  // Tightening (add a schedule) applies immediately.
  await app.click('#sched-add');
  await app.click('#save');
  await app.waitForFunction(() => document.querySelector('#savebar').hidden);
  const after = await worker.evaluate(() => chrome.storage.local.get(['settings']));
  assert.equal(after.settings.schedules.length, 1);

  // Pretend the wait passed: the request becomes applicable.
  await worker.evaluate(() => chrome.storage.local.set({
    pending: {
      requestedAt: Date.now() - 20 * 60000, readyAt: Date.now() - 1000, baseLockUntil: 0,
      proposed: { enabled: true, actions: { message: false, follow: true, friend: true }, scope: 'everyone', people: [],
        unknownTarget: 'block', alwaysOn: true, schedules: [], lockUntil: 0, delayMinutes: 15, showBadge: true },
      changes: ['Stop blocking: sending messages']
    }
  }));
  await app.waitForSelector('#pending-apply:not([disabled])');
  await app.click('#pending-apply');
  await app.waitForSelector('#pending[hidden]', { state: 'attached' });
  const final = await worker.evaluate(() => chrome.storage.local.get(['settings']));
  assert.equal(final.settings.actions.message, false);

  // Quick lock button.
  await app.click('[data-lock="60"]');
  await app.waitForSelector('#lock-end-row:not([hidden])');
  await app.close();
});
