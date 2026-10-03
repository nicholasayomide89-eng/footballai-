import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../../extension/shared/rules.js');

// Wednesday 1 Oct 2025, local time.
const at = (h, m = 0, day = 1) => new Date(2025, 9, day, h, m).getTime();

function settings(over = {}) {
  return R.normalizeSettings({ ...R.defaultSettings(), ...over });
}

test('defaults block all three actions for everyone, always', () => {
  const s = R.defaultSettings();
  assert.deepEqual(s.actions, { message: true, follow: true, friend: true });
  assert.equal(s.scope, 'everyone');
  assert.equal(R.protectionStatus(s, at(12)).active, true);
});

test('each action can be blocked independently', () => {
  const s = settings({ actions: { message: true, follow: false, friend: false } });
  assert.equal(R.shouldBlock(s, 'message', null, at(12)).block, true);
  assert.equal(R.shouldBlock(s, 'follow', null, at(12)).block, false);
  assert.equal(R.shouldBlock(s, 'friend', null, at(12)).block, false);
});

test('master switch off disables everything', () => {
  const s = settings({ enabled: false });
  assert.equal(R.protectionStatus(s, at(12)).active, false);
  assert.equal(R.shouldBlock(s, 'message', null, at(12)).block, false);
});

test('schedules: daytime window on chosen days', () => {
  const s = settings({ alwaysOn: false, schedules: [{ days: [3], start: '09:00', end: '17:00' }] });
  assert.equal(R.protectionStatus(s, at(8, 59)).active, false);
  assert.equal(R.protectionStatus(s, at(9, 0)).active, true);
  assert.equal(R.protectionStatus(s, at(16, 59)).active, true);
  assert.equal(R.protectionStatus(s, at(17, 0)).active, false);
  // Thursday: not a chosen day.
  assert.equal(R.protectionStatus(s, at(12, 0, 2)).active, false);
});

test('schedules: overnight window spills into the next morning', () => {
  const s = settings({ alwaysOn: false, schedules: [{ days: [3], start: '22:00', end: '07:00' }] });
  assert.equal(R.protectionStatus(s, at(23)).active, true);
  assert.equal(R.protectionStatus(s, at(6, 30, 2)).active, true); // Thu morning
  assert.equal(R.protectionStatus(s, at(7, 0, 2)).active, false);
  assert.equal(R.protectionStatus(s, at(6, 30, 1)).active, false); // Wed morning (Tue not chosen)
  const st = R.protectionStatus(s, at(23));
  assert.equal(st.until, at(7, 0, 2));
});

test('timed lock turns protection on until it expires', () => {
  const s = settings({ alwaysOn: false, lockUntil: at(13) });
  assert.equal(R.protectionStatus(s, at(12)).active, true);
  assert.deepEqual(R.protectionStatus(s, at(12)).reasons, ['lock']);
  assert.equal(R.protectionStatus(s, at(13)).active, false);
});

test('nextScheduledStart finds the next window', () => {
  const s = settings({ alwaysOn: false, schedules: [{ days: [1, 2, 3, 4, 5], start: '21:00', end: '23:00' }] });
  assert.equal(R.nextScheduledStart(s, at(12)), at(21));
});

test('handlesFromUrl understands profile and chat URLs', () => {
  assert.deepEqual(R.handlesFromUrl('https://www.facebook.com/zuck'), ['zuck']);
  assert.deepEqual(R.handlesFromUrl('https://m.facebook.com/Some.Person?ref=bookmarks'), ['some.person']);
  assert.deepEqual(R.handlesFromUrl('https://www.facebook.com/profile.php?id=100012345'), ['100012345']);
  assert.deepEqual(R.handlesFromUrl('https://www.facebook.com/messages/t/100012345'), ['100012345']);
  assert.deepEqual(R.handlesFromUrl('https://www.messenger.com/t/100012345/'), ['100012345']);
  assert.deepEqual(R.handlesFromUrl('https://www.messenger.com/e2ee/t/7788990011'), ['7788990011']);
  assert.deepEqual(R.handlesFromUrl('https://www.facebook.com/people/Jane-Doe/100099887766/'), ['100099887766']);
  assert.deepEqual(R.handlesFromUrl('/a/friends/add/?id=55512345&hf=profile', 'https://mbasic.facebook.com/'), ['55512345']);
});

test('handlesFromUrl ignores non-person pages', () => {
  for (const url of [
    'https://www.facebook.com/',
    'https://www.facebook.com/groups/12345',
    'https://www.facebook.com/watch?v=1',
    'https://www.facebook.com/photo/?fbid=123456',
    'https://www.facebook.com/story.php?id=123456&story_fbid=1',
    'https://www.facebook.com/marketplace/item/123',
    'https://example.com/zuck'
  ]) {
    assert.deepEqual(R.handlesFromUrl(url), [], url);
  }
});

test('handlesFromInput accepts links, @usernames and IDs', () => {
  assert.deepEqual(R.handlesFromInput('facebook.com/zuck'), ['zuck']);
  assert.deepEqual(R.handlesFromInput('@Jane.Doe'), ['jane.doe']);
  assert.deepEqual(R.handlesFromInput('100012345'), ['100012345']);
  assert.deepEqual(R.handlesFromInput('https://www.messenger.com/t/42424242'), ['42424242']);
  assert.deepEqual(R.handlesFromInput(''), []);
});

test('selected people: only listed people are blocked', () => {
  const s = settings({
    scope: 'selected',
    people: [{ name: 'Alex Example', handles: ['alex.example', '100011'] }]
  });
  assert.equal(R.shouldBlock(s, 'message', { handles: ['100011'], names: [] }, at(12)).block, true);
  assert.equal(R.shouldBlock(s, 'follow', { handles: ['alex.example'], names: [] }, at(12)).block, true);
  assert.equal(R.shouldBlock(s, 'friend', { handles: ['someone.else'], names: [] }, at(12)).block, false);
  // Name match helps for chat windows whose URL has no ID.
  assert.equal(R.shouldBlock(s, 'message', { handles: ['999'], names: ['alex example'] }, at(12)).block, true);
});

test('selected people: unknown target follows the chosen fallback', () => {
  const base = { scope: 'selected', people: [{ name: 'A', handles: ['a.person'] }] };
  assert.equal(R.shouldBlock(settings(base), 'message', { handles: [], names: [] }, at(12)).block, true);
  assert.equal(R.shouldBlock(settings({ ...base, unknownTarget: 'allow' }), 'message', { handles: [], names: [] }, at(12)).block, false);
});

test('tightening changes apply immediately', () => {
  const cur = settings({ actions: { message: true, follow: false, friend: false } });
  const next = settings({ actions: { message: true, follow: true, friend: true }, delayMinutes: 60 });
  const r = R.requestChange(cur, next, at(12));
  assert.equal(r.applied, true);
  assert.equal(r.pending, null);
  assert.equal(r.settings.actions.follow, true);
  assert.equal(r.settings.delayMinutes, 60);
});

test('loosening changes wait for the waiting period', () => {
  const cur = settings({ delayMinutes: 15 });
  const next = settings({ delayMinutes: 15, actions: { message: false, follow: true, friend: true } });
  const r = R.requestChange(cur, next, at(12));
  assert.equal(r.applied, false);
  assert.equal(r.settings.actions.message, true, 'still blocked while waiting');
  assert.equal(r.pending.readyAt, at(12, 15));
  assert.match(r.pending.changes[0], /sending messages/);
  assert.equal(R.applyPending(r.settings, r.pending, at(12, 14)), null, 'not ready yet');
  const applied = R.applyPending(r.settings, r.pending, at(12, 15));
  assert.equal(applied.actions.message, false);
});

test('mixed change: stricter parts apply now, looser parts wait', () => {
  const cur = settings({ delayMinutes: 30, actions: { message: true, follow: false, friend: false } });
  const next = settings({ delayMinutes: 30, actions: { message: false, follow: true, friend: false } });
  const r = R.requestChange(cur, next, at(12));
  assert.equal(r.applied, false);
  assert.deepEqual(r.settings.actions, { message: true, follow: true, friend: false });
});

test('every loosening kind is detected', () => {
  const cur = settings({
    alwaysOn: true,
    scope: 'selected',
    people: [{ name: 'A', handles: ['a.person'] }],
    schedules: [{ days: [1], start: '09:00', end: '10:00' }],
    lockUntil: at(14),
    delayMinutes: 60
  });
  const now = at(12);
  const loosen = (over) => R.weakeningChanges(cur, settings({ ...cur, ...over }), now);
  assert.equal(loosen({}).length, 0);
  assert.equal(loosen({ enabled: false }).length, 1);
  assert.equal(loosen({ alwaysOn: false }).length, 1);
  assert.equal(loosen({ people: [] }).length, 1);
  assert.equal(loosen({ unknownTarget: 'allow' }).length, 1);
  assert.equal(loosen({ schedules: [] }).length, 1);
  assert.equal(loosen({ schedules: [{ days: [1], start: '09:00', end: '09:30' }] }).length, 1);
  assert.equal(loosen({ lockUntil: 0 }).length, 1);
  assert.equal(loosen({ delayMinutes: 5 }).length, 1);
  assert.equal(loosen({ showBadge: false }).length, 0, 'hiding the badge is cosmetic');
  const toSelected = R.weakeningChanges(settings(), settings({ scope: 'selected' }), now);
  assert.equal(toSelected.length, 1);
});

test('shortening the waiting period itself must wait the old period', () => {
  const cur = settings({ delayMinutes: 1440 });
  const r = R.requestChange(cur, settings({ delayMinutes: 0 }), at(12));
  assert.equal(r.applied, false);
  assert.equal(r.settings.delayMinutes, 1440);
  assert.equal(r.pending.readyAt, at(12) + 1440 * 60000);
});

test('a lock started while a request waits survives applying it', () => {
  const cur = settings({ delayMinutes: 10 });
  const r = R.requestChange(cur, settings({ delayMinutes: 10, enabled: false }), at(12));
  const locked = { ...r.settings, lockUntil: at(15) };
  const applied = R.applyPending(locked, r.pending, at(12, 10));
  assert.equal(applied.lockUntil, at(15));
});

test('ending a lock early goes through the wait and is not restored after', () => {
  const cur = settings({ alwaysOn: false, lockUntil: at(15), delayMinutes: 10 });
  const r = R.requestChange(cur, { ...cur, lockUntil: 0 }, at(12));
  assert.equal(r.applied, false);
  assert.equal(r.settings.lockUntil, at(15));
  const applied = R.applyPending(r.settings, r.pending, at(12, 10));
  assert.equal(applied.lockUntil, 0);
  assert.equal(R.protectionStatus(applied, at(12, 10)).active, false);
});

test('no waiting period means loosening applies immediately', () => {
  const cur = settings({ delayMinutes: 0 });
  const r = R.requestChange(cur, settings({ delayMinutes: 0, enabled: false }), at(12));
  assert.equal(r.applied, true);
  assert.equal(r.settings.enabled, false);
});

test('normalizeSettings rejects junk', () => {
  const s = R.normalizeSettings({
    scope: 'weird', delayMinutes: -5, schedules: [{ days: [], start: 'x', end: 'y' }],
    people: [{ handles: [] }], actions: { message: 'yes' }
  });
  assert.equal(s.scope, 'everyone');
  assert.equal(s.delayMinutes, 15);
  assert.deepEqual(s.schedules, []);
  assert.deepEqual(s.people, []);
  assert.equal(s.actions.message, true);
});

test('formatting helpers', () => {
  assert.equal(R.formatMinutes(15), '15 minutes');
  assert.equal(R.formatMinutes(60), '1 hour');
  assert.equal(R.formatMinutes(1440), '1 day');
  assert.equal(R.formatTime('21:05'), '9:05 PM');
  assert.equal(R.formatTime('00:00'), '12:00 AM');
  assert.equal(R.describeSchedule({ days: [1, 2, 3, 4, 5], start: '22:00', end: '07:00' }), 'Weekdays 10:00 PM–7:00 AM (overnight)');
});
