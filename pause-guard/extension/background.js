/*
 * Pause Guard — background script. Only opens the settings screen when you
 * tap the on-page badge. It makes no network requests.
 */
var ext = typeof browser !== 'undefined' ? browser : chrome;

ext.runtime.onMessage.addListener(function (msg) {
  if (!msg || msg.type !== 'pg:open-settings') return;
  if (ext.runtime.openOptionsPage) {
    ext.runtime.openOptionsPage();
  } else {
    ext.tabs.create({ url: ext.runtime.getURL('app/app.html') });
  }
});
