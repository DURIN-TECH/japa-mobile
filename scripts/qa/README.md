# Headless QA walk

Tools for walking the app end to end without taking over the screen. The
real dev client runs on QA's own simulator and loads the branch's bundle from
QA's own Metro. The walk is driven through Metro's debugger: it reads what
React actually rendered and calls the handlers a tap or keystroke would end
in. `simctl` handles deep links and screenshots.

This is how mobile QA walks run by default. Use screen control (computer use)
only for checks that need real touch (see [What a headless walk cannot
check](#what-a-headless-walk-cannot-check)), and only when no other session
holds the screen.

| File | What it is |
| ---- | ---------- |
| `walk.mjs` | CLI: connect to the app through Metro's inspector; `dump`, `press`, `fill`, `route`, `eval`, `step`, ... |
| `agent.js` | Helpers that `walk.mjs` installs inside the app (`globalThis.__qa`) before every command. Not imported by the app |
| `sim.mjs` | Simulator helpers: create (clone or install), boot headless, approve URL schemes, open the dev client on a port, deep links, screenshots, teardown |

Both CLIs need only Node 24 (built-in `fetch` and `WebSocket`) and Xcode's
`xcrun simctl`. They work from the worktree without an `npm install`. None of
these files is imported by the app, so Metro never bundles them. Jest doesn't
run them and ESLint ignores `scripts/qa/`.

Run `node scripts/qa/walk.mjs --help` or `node scripts/qa/sim.mjs` for the
full option list.

## Ground rules

- **Your own everything.** Use your own cloned simulator, your own Metro, and a
  free port of 8084 or higher. Ports **8081–8083** belong to other sessions;
  both CLIs refuse them. Never boot, shut down or delete another session's
  simulator. `sim.mjs` only acts on devices named `Seli QA …`, the names it
  gives the devices it creates.
- **Confirm the bundle came from YOUR Metro.** The app can end up on another
  session's server, which may point at a different backend. Check your Metro
  log for the bundle request and the device connection before you trust a
  step.
- **No credentials in this repo.** Test accounts and their password are
  documented by the backend seed scripts
  (`seli-backend/functions/src/scripts/seed-all.ts` and the seed data they
  load). Read them from there and pass them in from the shell.
- Keep evidence (screenshots, dumps, Metro logs) in your scratch folder, never
  in the repo.

## Recipe

The example is a feature flag walked twice: once with the flag on, once with
it off. Run everything from the issue's `seli-mobile` worktree.

### 1. Simulator

```bash
export PORT=8084                       # any free port >= 8084
lsof -nP -iTCP:$PORT -sTCP:LISTEN      # must print nothing
export SCRATCH=/path/to/your/scratch   # evidence goes here

node scripts/qa/sim.mjs list           # QA devices + shut-down clone sources
node scripts/qa/sim.mjs create 342     # clones a SHUT-DOWN device that has the dev client
                                       # (or: --from <udid|name>; or a blank device: --app path/to/Seli.app)
export QA_UDID=<udid printed above>

node scripts/qa/sim.mjs boot             # simctl boot only: no Simulator window
node scripts/qa/sim.mjs approve-schemes  # no "Open in Seli?" alert on openurl
```

`create` refuses a source device that is booted, because a booted device is
probably someone else's walk. The source is only read, never booted. Bundle
id and URL schemes are read from the installed app's `Info.plist`. The dev
client is the app with an `exp+…` scheme, matched to this repo's
`app.json` bundle id (override with `--bundle-id`).

### 2. Metro, flag on

```bash
CI=1 EXPO_PUBLIC_SELF_SERVICE_ONLY=true \
  npx expo start --dev-client --localhost --port $PORT 2>&1 | tee $SCRATCH/metro-on.log
```

Run it in the background and note its PID so you can stop exactly this
process later. `CI=1` turns off watch mode and interactive prompts.

```bash
node scripts/qa/sim.mjs open-dev-client --port $PORT
```

Then check `$SCRATCH/metro-on.log` for both:

```text
Metro:InspectorProxy Got new device connection: name='Seli QA 342', app=com.durintech.japamobile ...
iOS Bundled 1251ms index.ts (4096 modules)
```

The device connection line only shows when Metro's debug logging is on
(`DEBUG=Metro:InspectorProxy`). The `iOS Bundled` line always shows. If it
doesn't appear in **your** log, the app is on someone else's server: stop
and relaunch.

### 3. Walk

```bash
W="node scripts/qa/walk.mjs --port $PORT"   # bash; in zsh use a function
$W dump                       # route, stack, rendered text, a11y labels, input placeholders
$W fill Email "$QA_EMAIL"     # matches placeholder, accessibilityLabel or testID
$W fill Password "$QA_PASSWORD"
$W press "Sign in"            # matches text or accessibilityLabel; exact matches first
$W wait-for "Explore visas"   # poll until a line shows up (after a fetch)
$W step 01-home --out $SCRATCH/shots   # screenshot + dump -> 01-home.png / 01-home.txt
```

`step` output (`.txt`), the same shape as `dump`:

```text
ROUTE: __root > destination/[id]{"id":"gb-standard-visitor","code":"gb"}
STACK: *__root[(tabs),*destination/[id]]
Standard Visitor visa
Choose your path
Self-service
[a11y] Start application
Start application
```

- `ROUTE` is the focused route chain. `STACK` is the root stack, two levels
  deep, with `*` marking the focused entry. Use `nav` for the full state.
- Each line is one outermost `<Text>`. `[a11y]` lines are accessibility
  labels and `[input placeholder]` lines are text fields.
- Only the **focused** screen is listed. Add `--all` to include screens
  that are mounted behind it.

Other commands:

- `route`: route and stack only.
- `pressables`: everything with an `onPress`, with "(disabled)" marked.
- `inputs`: every text field and its current value.
- `targets`: the inspector pages attached to your Metro.
- `eval '<js>'` or `eval --file x.js`: anything else, with `__qa` available.

`press` won't press a disabled control, because a real tap would do nothing
(`--force` overrides this). When several elements match, `--index n` picks
one. A miss lists the near matches on screen.

**Look at every screenshot.** A dump can read fine while the screen is
blank, covered or crashed.

Deep links and cold starts:

```bash
node scripts/qa/sim.mjs open durintech://messages        # warm deep link
node scripts/qa/sim.mjs terminate                        # kill the app...
node scripts/qa/sim.mjs open durintech://messages        # ...and cold start through a link
node scripts/qa/sim.mjs open-dev-client --port $PORT     # plain relaunch on your Metro
```

On a cold start the dev client's launcher shows first. The bundle loads
after it.

### 4. Metro, flag off

Stop your Metro (by its PID), then start it again without the variable and
with `--clear`. `EXPO_PUBLIC_*` values are inlined into the bundle, so a
cached bundle would keep the old value.

```bash
CI=1 npx expo start --dev-client --localhost --port $PORT --clear 2>&1 | tee $SCRATCH/metro-off.log
node scripts/qa/sim.mjs open-dev-client --port $PORT
```

Check for the `iOS Bundled` line again, then repeat the walk.

### 5. Tear down

```bash
kill <your Metro PID>; lsof -nP -iTCP:$PORT -sTCP:LISTEN   # port free again
node scripts/qa/sim.mjs teardown                           # shutdown + delete the clone
```

Say in the verdict that the clone was deleted and that the source device and
the 8081–8083 servers were not touched.

### Against the local emulators

Start Metro with `EXPO_PUBLIC_USE_EMULATOR=true` and
`EXPO_PUBLIC_EMULATOR_PROJECT_ID=<the emulators' project id>` (see this
repo's `CLAUDE.md`, "Environment Configuration"). The dev build's native
Firebase config decides which project the Auth emulator mints tokens for.
The emulators have to run under that same id, or every request returns 401.

## Seeding states no account has (injected data)

Some states can't be reached with any dev account, such as an empty inbox, a
blocking review or a shared document. For these you can put data straight
into the app's in-memory TanStack Query cache. The app's real code then
renders it. Nothing is written to the backend, and a reload or refetch wipes
it.

```bash
$W eval '__qa.queryKeys()'          # what's cached, as JSON keys
$W eval '__qa.qc().getQueryData(["notifications"])'
$W eval '(function () {
  var qc = __qa.qc();
  var key = ["notifications"];      // copy the exact key from queryKeys()
  var cur = qc.getQueryData(key);
  qc.setQueryData(key, /* same shape as cur, with your fake rows */ cur);
  return "seeded";
})()'
```

- Copy the shape from the real cached value. Don't make one up.
- Some screens refetch on focus or mount and overwrite what you seeded. Seed
  after the screen has loaded, or navigate first and seed second.
- **Label every check that relies on injected data as "(injected)" in the
  verdict.** It shows how the UI renders that data, not that the backend
  ever produces it.

## Gotchas

- **The debugger `Origin` header must be exactly `http://127.0.0.1:<port>`.**
  With `http://localhost:<port>`, Metro accepts the socket and then drops the
  session at once: `Debugger … disconnected` shows in its log and no reply
  comes back. `walk.mjs` always sends the right header. Keep it if you write
  your own client.
- **A crash inside Hermes's debugger means relaunch and redo the step.** The
  crash log names `hermes::vm::Debugger::runDebugger`, and `walk.mjs`
  reports "the debugger connection closed before the app answered". The
  debugger connection caused it, not the app. Relaunch with
  `open-dev-client`, sign in again if needed, redo the step, and mention the
  crash in the verdict's notes.
- **Virtualised lists only mount the rows on screen.** A row further down a
  `FlatList`/`FlashList` isn't in the tree, so `dump` doesn't show it and
  `press` can't find it. Scroll the list first (for example
  `eval` → find the list's ref or `scrollToEnd`), or read the data from the
  query cache, and say which you did.
- **Confirm the bundle request in YOUR Metro log** after every (re)launch.
  See [Ground rules](#ground-rules).
- **Several apps on one Metro.** If more than one device is attached,
  `walk.mjs` refuses to guess. Pick one with `--device "<name part>"` or
  `--target <id>` (`targets` lists them).
- **`eval` scope.** Top-level `const`/`let` persist between calls and clash on
  the next one. Wrap multi-line code in an IIFE, as in the examples.
- **Handlers, not touches.** `press` calls the nearest `onPress` with a fake
  event object. A handler that reads touch coordinates from the event won't
  get real ones.

## What a headless walk cannot check

The driver calls handlers directly, so it never tests whether a real finger
would reach them. Leave these unchecked, or check them with screen control
when the screen is free, and say so in the verdict:

- A button covered by another view, off screen, or too small to hit.
- Gestures: swipes, long-presses, pull-to-refresh, drag, swipe-back.
- The on-screen keyboard: covering fields, `returnKeyType`, focus moving
  between fields, dismissing. `fill` sets the final value in one step, with
  no per-keystroke events.
- Animations and transitions as they look while moving. Screenshots are
  stills.
- Native system UI: permission prompts, share sheets, pickers, push banners.
