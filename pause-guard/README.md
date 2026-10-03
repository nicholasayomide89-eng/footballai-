# Pause Guard

A personal self-control tool that stops **you** from sending messages, following
people, or sending friend requests on Facebook and Messenger. It's built for
**iPhone**, with Safari as the place you use Facebook and Screen Time as the lock.

Instead of the action happening, you see:

> **Pause. You chose to block this action**
> Sending messages is blocked for everyone until 9:00 PM.

You can keep scrolling, reading, liking and commenting. Only the actions you
chose are blocked.

---

## What can and can't be blocked on iPhone

| Where you use Facebook | Can Pause Guard block single actions? | How Pause Guard handles it |
|---|---|---|
| **Safari**: facebook.com, m.facebook.com, messenger.com | **Yes** | The Safari extension runs inside the page and stops the tap or Enter key before Facebook acts on it. |
| **Facebook app / Messenger app** | **No.** iOS doesn't let any app look inside or control another app. | Use **Screen Time** to block those apps completely (steps below), so Safari is the only way in. |
| Other browsers on the iPhone (Chrome, Firefox, Edge…) | No. Those iPhone browsers can't run Safari extensions. | Block them with Screen Time, or block facebook.com in them with Screen Time's website limits. |
| Another phone, a computer, a tablet | Only if Pause Guard is installed there too | It also works as a desktop Chrome/Edge extension (see below). |

Running Pause Guard in Safari and locking everything else with Screen Time is
the only setup on iPhone that blocks individual actions while still letting
you browse Facebook.

---

## Features

- **Choose what to block, independently**: sending messages, following people,
  sending friend requests.
- **Everyone or only people you select**: add someone by profile link, chat
  link, @username or numeric ID, or tap "Add person on current page" while
  you're on their profile or chat.
- **When it's on**: always on, on weekly **schedules** (including overnight,
  e.g. 21:00–07:00), or as a **timed lock** (30 min … 7 days, or a custom time).
- **Waiting period** (0 min – 3 days): anything that *loosens* protection waits.
  That includes turning a block off, removing a person or schedule, switching
  to "selected people", ending a lock early, or shortening the wait itself.
  You then confirm it again once the wait is over. Anything that *tightens*
  protection applies immediately.
- **Pause screen** with the exact message "Pause. You chose to block this
  action", plus what is blocked, for whom, and until when.
- **Status everywhere**: the settings screen shows ON/OFF, the reason (always
  on, schedule, lock), what is blocked, for whom, and where. A small badge on
  Facebook pages shows "Pause Guard on · blocking messages…". You can hide the
  badge.
- **Accessible**: native form controls, large tap targets, visible focus,
  screen-reader labels, dark mode, and less motion when the system asks for it.

### What gets blocked exactly

| Action | Blocked | Still allowed |
|---|---|---|
| Messages | Send button, Enter key in a message box, "Send a Like" / quick reactions, the profile **Message** button, basic-site send forms | Opening chats, reading messages, Shift+Enter for a new line, typing |
| Following | **Follow**, **Follow back** | Following / Unfollow buttons, viewing followers |
| Friend requests | **Add friend** buttons and add-friend links | Viewing friends, cancelling a request |

### Privacy

- It never asks for your Facebook password and doesn't use your Facebook login.
- It never reads, stores or sends your messages. It only looks at **button
  labels**, **link addresses** and the **page address/title**, so it can tell
  which button you tapped and who it's aimed at.
- It never sends anything on your behalf and makes **no network requests**.
- Settings live in the browser's extension storage **on this device only**.
  The only permission it asks for is `storage`.

---

## Install on iPhone (Safari Web Extension)

iOS only installs Safari extensions that come inside an app, so you need to
build it once on a Mac.

**You need:** a Mac with Xcode 15 or newer, your iPhone and a USB cable (or the
same Wi-Fi), and a free Apple ID. A free account works, but the app expires
after 7 days and you'd re-run it from Xcode. A paid Apple Developer account
($99/yr) lasts a year and lets you use TestFlight.

1. Copy this `pause-guard` folder to the Mac.
2. In Terminal:
   ```sh
   cd pause-guard
   xcrun safari-web-extension-converter extension \
     --app-name "Pause Guard" \
     --bundle-identifier com.yourname.pauseguard \
     --ios-only --swift --no-open --project-location build
   open "build/Pause Guard/Pause Guard.xcodeproj"
   ```
3. In Xcode, select the **Pause Guard** project → **Signing & Capabilities**.
   Choose your team (your Apple ID) for **both** targets: the app and the
   extension.
4. Plug in your iPhone, pick it as the run destination, and press **Run** (⌘R).
   - If you're asked to, turn on **Settings → Privacy & Security → Developer Mode**
     and restart.
   - With a free account, also trust your profile under **Settings → General →
     VPN & Device Management**.
5. On the iPhone: **Settings → Apps → Safari → Extensions → Pause Guard**
   - Turn it **on**.
   - Under **Permissions**, set facebook.com and messenger.com (or "All
     Websites") to **Allow**.
   - Turn on **Allow in Private Browsing** so Private tabs aren't a loophole.
6. Open Safari → go to `m.facebook.com` → tap the **page menu** (the `AA` /
   puzzle-piece icon in the address bar) → **Pause Guard** to open the settings
   screen. Tapping the green badge on Facebook pages also opens it.

### Make it stick with Screen Time

Pause Guard only works in Safari, so close the other ways in. Go to
**Settings → Screen Time**:

1. **Block the apps**: delete the Facebook and Messenger apps, or use **App
   Limits → Add Limit** → Facebook and Messenger → 1 minute → **Block at End of
   Limit** on.
2. **Stop reinstalling**: **Content & Privacy Restrictions → iTunes & App Store
   Purchases → Installing Apps → Don't Allow**.
3. **Block other browsers**: give other browser apps an App Limit, or
   delete them.
4. **Protect the extension**: under **Content & Privacy Restrictions**, keep
   changes restricted. Then ask a trusted person to **set the Screen Time
   passcode** so you can't undo all of this on impulse.

---

## Use it on a computer too (Chrome, Edge, Brave)

The same extension runs on desktop:

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `pause-guard/extension` folder.
3. Pin Pause Guard from the puzzle-piece menu and click it to see status and settings.

Settings are per browser and per device. They don't sync between your iPhone
and your computer.

---

## Testing

### Automated tests (included)

```sh
cd pause-guard
npm install            # installs Playwright (uses your existing Chromium if present)
npm test               # 29 unit tests: rules, schedules, waiting period, URL parsing, button detection
npm run test:e2e       # 8 end-to-end tests: loads the real extension in Chromium
```

The end-to-end tests serve a **mock Facebook page** (`test/e2e/fixtures/facebook.html`)
at `https://www.facebook.com/…` inside the test browser, so no real Facebook
traffic happens. They check that:

- Add friend, Follow, Message, Send, Send a Like and Enter-to-send are stopped
  before the page's own code sees them, and the pause screen shows the exact
  text.
- Shift+Enter, commenting, liking and scrolling still work.
- Each action can be switched off on its own.
- "Selected people" blocks Jane but not Sam.
- Protection is off outside a schedule and comes on with a timed lock.
- The settings screen turns a loosening change into a pending request (still
  blocked), applies tightening changes at once, applies the request only after
  the wait, and starts quick locks.

### Manual checklist on iPhone

Do this logged in, in Safari, on `m.facebook.com` (and `www.facebook.com` via
"Request Desktop Website"):

1. Badge says **Pause Guard on** in the bottom-left corner.
2. Open someone's profile → tap **Add friend** → pause screen appears, and no
   request is sent (the button stays "Add friend").
3. Tap **Follow** → pause screen.
4. Open a chat, type something, tap **Send** / press return → pause screen,
   message not sent. Scroll the chat and read older messages → works.
5. Comment on a post and like it → works.
6. In settings, turn off "Following people" → **Save** → a "Pending change" card
   shows a countdown and Follow is **still blocked**. Tap **Cancel request**.
7. Set "Who it applies to" → **Only people I select**, then add a friend. Message
   them → blocked. Message someone else → allowed.
8. Turn **Always on** off (this waits), add a schedule that started a minute ago
   → protection is ON. Start a **30 min** timed lock → status says "Timed lock
   until …".

If a button isn't caught, Facebook has probably changed its label. Add the
label to `PATTERNS` in `extension/content/detect.js` (labels are matched in
lower case).

---

## Limitations: what can get around it

Be honest with yourself about these. Pause Guard is a speed bump for impulses,
not a lock you can't open.

- **The Facebook and Messenger apps**: not covered at all. iOS doesn't allow it.
  Block them with Screen Time.
- **Other browsers** on the iPhone (Chrome, Firefox, etc.) don't run Safari
  extensions. Block them with Screen Time.
- **Turning the extension off or deleting it**: in Settings → Safari →
  Extensions, or by deleting the Pause Guard app. iOS doesn't let an extension
  stop that, and the waiting period only applies inside Pause Guard. A Screen
  Time passcode held by someone else is the real barrier.
- **Private Browsing**: covered only if "Allow in Private Browsing" is on.
- **Other devices**: a computer, tablet or someone else's phone isn't protected
  unless Pause Guard is installed there (desktop Chrome/Edge works; Android is
  not supported by this prototype).
- **Changing the phone's clock** can shorten a waiting period or timed lock,
  because times are checked against the device clock. Turn on Settings → General
  → Date & Time → **Set Automatically** and keep it under Screen Time restrictions.
- **Facebook changes**: Facebook renames and rebuilds its buttons often, and
  labels depend on your language. Detection uses English labels and known link
  patterns. A redesign or another language can let an action through until the
  patterns are updated.
- **"Selected people"** depends on recognising who an action is aimed at. A
  person's profile and chat can use different IDs, so add both (the "Add person
  on current page" button makes this easy). When Pause Guard can't tell who the
  action is for, it blocks by default (you can change that).
- **Other ways to act**: Facebook features outside these pages may still work,
  e.g. replying from an email notification, iOS notification quick-reply from
  the Messenger app, Instagram/WhatsApp, or Siri/Shortcuts.
- **Free Apple ID builds expire after 7 days.** When the app expires, the
  extension stops until you run it again from Xcode. A paid developer account
  avoids this.

---

## Project layout

```
pause-guard/
  extension/              The web extension (Safari, Chrome, Edge)
    manifest.json
    shared/rules.js       Settings, schedules, locks, waiting period, URL → person
    content/detect.js     Recognises Message / Follow / Add friend actions on the page
    content/content.js    Stops them, shows the pause screen and the status badge
    app/                  Status and settings screen (popup / options page)
    background.js         Opens settings when you tap the badge
    icons/
  test/unit/              Logic and detection tests
  test/e2e/               Real-extension tests against a mock Facebook page
  tools/make-icons.mjs    Regenerates the PNG icons from icon.svg
```
