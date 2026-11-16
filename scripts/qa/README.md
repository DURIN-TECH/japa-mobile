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

Run `node "$QA/walk.mjs" --help` or `node "$QA/sim.mjs"` for the full
option list (`$QA` is set in step 1 of the recipe).

## Ground rules

- **Your own everything.** Use your own cloned simulator, your own Metro, and a
  free port of 8084 or higher. Ports **8081–8083** belong to other sessions;
  both CLIs refuse them. Never boot, shut down or delete another session's
  simulator.
  - `sim.mjs` only acts on a device named `Seli QA …` that it created
    itself. `create` writes a marker per UDID under
    `~/Library/Caches/seli-qa/sims/`, and `teardown` removes it. A device
    named that way by hand has no marker, so it is refused.
  - `walk.mjs` has no default port. With `QA_UDID` set, it only drives an
    app running on that simulator, so it can't attach to another session's
    Metro by mistake.
  - **Export `QA_METRO_PORT` and `QA_UDID` at the start of every walk**
    (step 1 below).
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
it off.

Two folders are involved, and they can differ:

- **Metro** runs from the issue's `seli-mobile` worktree, because that is
  the code under test.
- **The scripts** run from wherever `scripts/qa/` lives. Until this tool is
  merged to `dev`, that is the #342 worktree
  (`.worktrees/seli-mobile-342-qa-driver/scripts/qa`). After that, any
  checkout of `dev` has it.

Point `QA` at the scripts folder and every command below works from any
directory.

### 1. Simulator

```bash
export QA=/absolute/path/to/seli-mobile/scripts/qa   # see above
# Pick a free port >= 8084. Another QA walk may already hold 8084, so check.
export QA_METRO_PORT=8084
lsof -nP -iTCP:$QA_METRO_PORT -sTCP:LISTEN   # must print nothing; else pick another
export SCRATCH=/path/to/your/scratch         # evidence goes here

node "$QA/sim.mjs" list           # QA devices + shut-down clone sources
node "$QA/sim.mjs" create 342     # clones a SHUT-DOWN device that has the dev client
                                       # (or: --from <udid|name>; or a blank device: --app path/to/Seli.app)
export QA_UDID=<udid printed above>     # both CLIs read it from here on

node "$QA/sim.mjs" boot             # simctl boot only, no Simulator window
                                         # (create --app already booted it; harmless)
node "$QA/sim.mjs" approve-schemes  # no "Open in Seli?" alert on openurl,
                                         # and no dev menu over the app
```

Once `QA_UDID` is exported, you can leave `[device]` out of every `sim.mjs`
command, as the recipe does. `--port` defaults to `QA_METRO_PORT`.

`approve-schemes` (and `create --app`) also sets two user defaults:

- `EXDevMenuIsOnboardingFinished`: stops the dev menu's welcome sheet.
- `EXDevMenuShowsAtLaunch`: stops the dev menu opening by itself on launch.

Without them, the menu covers the bottom half of every screenshot on a fresh
device, tab bar included. The manual equivalent is:

```bash
xcrun simctl spawn $QA_UDID defaults write com.durintech.japamobile EXDevMenuIsOnboardingFinished -bool YES
xcrun simctl spawn $QA_UDID defaults write com.durintech.japamobile EXDevMenuShowsAtLaunch -bool NO
```

If the menu still shows, close it with `W eval '__qa.closeDevMenu()'` (`W`
is defined in step 3). That calls
`globalThis.expo.modules.ExpoDevMenu.closeMenu()`.

A blank device (`create --app`) also shows iOS's "Seli would like to send
you notifications" prompt after sign-in. It can't be dismissed headlessly
(`simctl privacy` has no notifications service). The app keeps working
underneath it, so the walk can go on, but screenshots show the prompt.
Mention it in the verdict, or clone a device where it was already answered.

`create` refuses a source device that is booted, because a booted device is
probably someone else's walk. A clone copies the source device's app data,
including a signed-in session, and keeps it until `teardown` deletes the
clone. The source is only read, never booted. Bundle
id and URL schemes are read from the installed app's `Info.plist`. The dev
client is the app with an `exp+…` scheme, matched to this repo's
`app.json` bundle id (override with `--bundle-id`).

### 2. Metro, flag on

Run this from the **issue's** worktree:

```bash
CI=1 DEBUG=Metro:InspectorProxy EXPO_PUBLIC_SELF_SERVICE_ONLY=true \
  npx expo start --port $QA_METRO_PORT 2>&1 | tee $SCRATCH/metro-on.log
```

Run it in the background and note its PID so you can stop exactly this
process later.

- `CI=1` turns off watch mode and interactive prompts.
- `DEBUG=Metro:InspectorProxy` makes Metro log which device connected.

```bash
node "$QA/sim.mjs" open-dev-client --port $QA_METRO_PORT
```

Then check `$SCRATCH/metro-on.log` for both:

```text
Metro:InspectorProxy Got new device connection: name='Seli QA 342', app=com.durintech.japamobile ...
iOS Bundled 1251ms index.ts (4096 modules)
```

If these lines don't appear in **your** log, the app is on someone else's
server: stop and relaunch.

**"There was a problem loading the project / Failed to load app from
http://…"**: run `open-dev-client` again.

- It happens about 1 launch in 8, even with a cached bundle and no crash.
- It also happens when the first bundle request on a freshly `--clear`ed
  Metro times out. Wait for the bundle to finish building, then retry.

`open-dev-client` kills the app before opening it, so it also works as a
relaunch. To load the bundle without killing what is running, pass
`--no-terminate`. Use it, for example, under a dev-client launcher that is
already showing.

### 3. Walk

```bash
# Works in bash and zsh (a plain W="node ..." variable does not split in zsh).
# walk.mjs reads QA_METRO_PORT and QA_UDID from the environment.
W() { node "$QA/walk.mjs" "$@"; }

W dump                          # route, stack, rendered text, a11y labels, input placeholders
W press "I already have an account"
W fill you@email.com "$QA_EMAIL"         # the login screen's placeholders
W fill "Your password" "$QA_PASSWORD"
W press "Log in"                # the login button's text
W wait-for "Explore visas"      # poll until a line shows up (after a fetch)
W step 01-home --out "$SCRATCH/shots"    # needs --udid or QA_UDID (exported in step 1)
```

**Matching is case-sensitive.** `fill Password` doesn't find "Your password".

- `press` matches a `<Text>`'s text or an accessibility label. Exact matches
  come first, then partial ones.
- `fill` matches a field's placeholder, accessibility label or `testID`.
  It doesn't match the visible label above the field: on the login screen
  "Email" is that label and "you@email.com" is the placeholder.
- Run `dump` or `inputs` first and copy the exact strings.

With `QA_UDID` set, every command checks that the attached app runs on
that simulator. It refuses with "no app from your simulator … is attached"
when the Metro on that port is serving someone else's device. Without
`QA_UDID`, each command prints the device it attached to on stderr. Read it
before you trust the step.

`step` takes the screenshot of the device named by `--udid`, or by
`QA_UDID` when `--udid` is left out. It writes `<name>.png` and `<name>.txt`
into `--out` (or `QA_OUT`).

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
  See [eval: reaching into the app](#eval-reaching-into-the-app).

`press` won't press a disabled control, because a real tap would do nothing
(`--force` overrides this).

- When several elements match, `--index n` picks one. The count in
  `match 1 of N` only includes things that can be pressed: one per button,
  with text that has no `onPress` (such as a subtitle) left out.
- A miss lists the near matches on screen.
- `fill` counts one match per field. A wrapper component (such as the
  login screen's `Field`) and the `TextInput` inside it count once, even
  after a re-render.
- Right after a navigation, the screen that is still animating in can be
  counted twice for a moment. If a count looks too high, run the command
  again after a second.

**Look at every screenshot.** A dump can read fine while the screen is
blank, covered or crashed.

Deep links:

```bash
node "$QA/sim.mjs" open durintech://messages        # warm: the app is running
node "$QA/sim.mjs" cold-link durintech://messages   # cold start through a link
W route                                                  # where did it land?
```

**Cold start through a link.** With the dev client you can't do it the way a
release build would, by opening the link while the app is closed:

- That only starts the dev client's launcher, and the link never reaches the
  app's router.
- expo-router takes the initial URL from expo-linking's `getLinkingURL()`.
  Through the dev client, that holds the `exp+…expo-development-client` URL,
  so the app lands on Home.
- React Native's `Linking.getInitialURL()` can still return the link. That
  is why the earlier #334 check looked fine: it read the wrong API.

What works is `cold-link`:

1. It kills the app and launches the dev client on your Metro.
2. About 2 s later, while the bundle is still loading, it sends the link.
3. The router gets the link and handles it as the initial URL.

If `route` shows Home, raise `--link-delay` (in ms) a little. Say in the
verdict that the cold start was done this way.

### 4. Metro, flag off

Stop your Metro (by its PID), then start it again without the variable and
with `--clear`. `EXPO_PUBLIC_*` values are inlined into the bundle, so a
cached bundle would keep the old value.

```bash
CI=1 npx expo start --port $QA_METRO_PORT --clear 2>&1 | tee $SCRATCH/metro-off.log
node "$QA/sim.mjs" open-dev-client --port $QA_METRO_PORT
```

Check for the `iOS Bundled` line again, then repeat the walk.

### 5. Tear down

```bash
kill <your Metro PID>; lsof -nP -iTCP:$QA_METRO_PORT -sTCP:LISTEN   # port free again
node "$QA/sim.mjs" teardown                           # shutdown + delete the clone
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
W eval '__qa.queryKeys()'          # what's cached, as JSON keys
W eval '__qa.qc().getQueryData(["notifications"])'
W eval '(function () {
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

## eval: reaching into the app

`W eval '<js>'` runs code in the app, with `__qa` available, and prints the
value.

- **Promises are awaited.** That includes React Native's polyfilled ones,
  which the debugger's own `awaitPromise` ignores. The driver polls for the
  result for up to `--timeout` ms (default 20000) and reports a rejection as
  an error.
- **Only an expression is awaited.** Statements (`var x = …; x`) run as
  they are, and the last value is printed without awaiting it. For async
  work, use an async IIFE: `W eval '(async () => { … return v; })()'`.
- Top-level `const`/`let` persist between calls and clash on the next one.
  Use an IIFE, or `var`.

Bundled modules (dev bundles only):

```bash
W eval '__qa.mods("auth.store")'    # [{id, name, initialized}]; name is the file path
W eval '__qa.mod("stores/auth.store").useAuthStore.getState().isAuthenticated'
```

- `__qa.mods(regex)` lists the bundled modules whose path matches. It reads
  Metro's `__r.getModules()` and matches each module's `verboseName`.
- `__qa.mod(regex)` returns a matching module's exports through `__r(id)`.
  It prefers a module that has already run, so it doesn't run a module's top
  level for the first time.
- Keep the result small: a whole module object is usually too big to print.

Native Expo modules:

- `__qa.native("ExpoDevMenu")` is `globalThis.expo.modules.ExpoDevMenu`.
- `__qa.closeDevMenu()` closes the dev menu.
- To fire a dev-menu item the app registered, emit
  `registeredCallbackFired` with the item's name on `DeviceEventEmitter`,
  for example `__qa.mod("RCTDeviceEventEmitter").default.emit("registeredCallbackFired", "<item name>")`.
  Check the module's exports with `__qa.mods` first.

## Gotchas

- **The debugger `Origin` header must be exactly `http://127.0.0.1:<port>`.**
  With `http://localhost:<port>`, Metro accepts the socket and then drops the
  session at once: `Debugger … disconnected` shows in its log and no reply
  comes back. `walk.mjs` always sends the right header. Keep it if you write
  your own client.
- **A crash inside Hermes's debugger means relaunch and redo the step.**
  Expect it: it happened twice in one day, both times shortly after a `fill`
  or after pressing Sign out.
  - The crash log names `hermes::vm::Debugger::runDebugger`. `walk.mjs`
    reports "the debugger connection closed before the app answered". The
    next command says no app is attached.
  - The debugger connection caused it, not the app.
  - Relaunch with `sim.mjs open-dev-client`, which kills the app first. If
    it shows "Failed to load app from http://…", run it again.
  - Sign in again if needed, redo the step, and mention the crash in the
    verdict's notes.
- **Virtualised lists only mount the rows on screen.** A row further down a
  `FlatList`/`FlashList` isn't in the tree, so `dump` doesn't show it and
  `press` can't find it. Scroll the list first (for example
  `eval` → find the list's ref or `scrollToEnd`), or read the data from the
  query cache, and say which you did.
- **Confirm the bundle request in YOUR Metro log** after every (re)launch.
  See [Ground rules](#ground-rules).
- **Several apps on one Metro.** If more than one device is attached,
  `walk.mjs` refuses to guess. `QA_UDID` picks yours. Otherwise use
  `--device "<name part>"` or `--target <id>` (`targets` lists them).
- **Metro lists devices by name, not UDID.** The `QA_UDID` check compares
  the simulator's name, so keep the `create` suffix unique (the issue
  number). If two attached devices share a name, the walk is refused.
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
