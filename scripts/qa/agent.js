/*
 * scripts/qa/agent.js — the in-app half of the headless QA driver.
 *
 * This file is NOT part of the app and is never imported by it. `walk.mjs`
 * reads it as text and sends it to the running app through Metro's inspector
 * (Hermes CDP `Runtime.evaluate`), where it installs `globalThis.__qa`.
 * It is re-sent before every command, so it never goes stale after a reload.
 *
 * Everything here works on the live React fiber tree that React DevTools
 * exposes in dev builds (`__REACT_DEVTOOLS_GLOBAL_HOOK__`). Fiber tags used:
 *   5  = HostComponent (native view: 'RCTText', 'RCTView', ...)
 *   6  = HostText (a raw string inside <Text>)
 *   10 = ContextProvider (react-navigation hangs its navigation object here)
 *
 * Every public function returns plain JSON-able data, because `walk.mjs`
 * evaluates with `returnByValue: true`.
 *
 * Plain script, no imports, no JSX: it must run as-is inside Hermes.
 */
(function () {
  var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  // ---------------------------------------------------------------------------
  // Tree access
  // ---------------------------------------------------------------------------

  /** All mounted fiber roots, across every renderer React registered. */
  function roots() {
    var out = [];
    if (!hook || !hook.renderers || typeof hook.getFiberRoots !== 'function') {
      return out;
    }
    hook.renderers.forEach(function (_renderer, id) {
      var set = hook.getFiberRoots(id);
      if (set) {
        set.forEach(function (r) {
          out.push(r);
        });
      }
    });
    return out;
  }

  /**
   * Is this fiber the boundary of a navigation screen, and if so is that
   * screen focused? Returns true/false at a screen boundary, null elsewhere.
   * Two shapes are recognised:
   *   - a NavigationContext provider (tag 10) whose value has isFocused()
   *   - a screen component receiving `route` + `navigation` props
   * If isFocused() throws we treat it as focused, so text is never hidden by
   * a helper error (better a noisy dump than a silently empty one).
   */
  function focusAt(f) {
    var p = f.memoizedProps;
    if (
      f.tag === 10 &&
      p &&
      p.value &&
      typeof p.value.isFocused === 'function' &&
      typeof p.value.getParent === 'function'
    ) {
      try {
        return p.value.isFocused();
      } catch (e) {
        return true;
      }
    }
    if (
      p &&
      p.route &&
      p.navigation &&
      typeof p.navigation.isFocused === 'function'
    ) {
      try {
        return p.navigation.isFocused();
      } catch (e) {
        return true;
      }
    }
    return null;
  }

  /**
   * Depth-first walk over every fiber, in render order (child before
   * sibling). `cb(fiber, focused)` gets whether the fiber sits inside the
   * focused screen; return false from cb to stop the walk early.
   */
  function walk(cb) {
    var rs = roots();
    for (var i = 0; i < rs.length; i++) {
      var stack = [[rs[i].current, true]];
      while (stack.length) {
        var item = stack.pop();
        var f = item[0];
        var parentFocused = item[1];
        if (!f) continue;
        var focused = parentFocused;
        if (focusAt(f) === false) focused = false;
        if (cb(f, focused) === false) return;
        // Push sibling first so the child is popped (visited) first.
        if (f.sibling) stack.push([f.sibling, parentFocused]);
        if (f.child) stack.push([f.child, focused]);
      }
    }
  }

  /** Concatenated raw text under a fiber (all HostText descendants). */
  function textUnder(f, limit) {
    var s = '';
    var n = 0;
    var st = [f.child];
    while (st.length && (!limit || n < limit)) {
      n++;
      var c = st.pop();
      if (!c) continue;
      if (c.sibling) st.push(c.sibling);
      if (c.tag === 6) s += String(c.memoizedProps);
      else if (c.child) st.push(c.child);
    }
    return s;
  }

  /** Nested <Text> is rendered by its outermost RCTText; skip the inner ones. */
  function hasTextAncestor(f) {
    var p = f.return;
    while (p) {
      if (p.tag === 5 && p.type === 'RCTText') return true;
      p = p.return;
    }
    return false;
  }

  function isOuterText(f) {
    return f.tag === 5 && f.type === 'RCTText' && !hasTextAncestor(f);
  }

  /** Readable name of a fiber's component, for messages. */
  function nameOf(f) {
    if (!f) return '?';
    if (typeof f.type === 'string') return f.type;
    return (f.type && (f.type.displayName || f.type.name)) || 'Anonymous';
  }

  /** Nearest fiber at or above `f` whose props carry `prop` as a function. */
  function ancestorWith(f, prop) {
    var p = f;
    while (p) {
      if (p.memoizedProps && typeof p.memoizedProps[prop] === 'function') {
        return p;
      }
      p = p.return;
    }
    return null;
  }

  /**
   * Is `f` the same component instance as any fiber in `list`? React keeps
   * two fibers per instance (current + alternate) and `.return` pointers can
   * lead to either, so identity alone over-counts (QA saw "match 1 of 2" on
   * a single password field after it re-rendered).
   */
  function inList(list, f) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] === f || list[i] === f.alternate || list[i].alternate === f) {
        return true;
      }
    }
    return false;
  }

  function isDisabled(props) {
    return !!(
      props &&
      (props.disabled === true ||
        (props.accessibilityState && props.accessibilityState.disabled))
    );
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /** The root navigation object (the provider with getRootState()). */
  function navObj() {
    var n = null;
    walk(function (f) {
      var p = f.memoizedProps;
      if (
        f.tag === 10 &&
        p &&
        p.value &&
        typeof p.value.getRootState === 'function'
      ) {
        n = p.value;
        return false;
      }
    });
    return n;
  }

  function rootState() {
    var n = navObj();
    if (!n) return null;
    try {
      return n.getRootState();
    } catch (e) {
      return null;
    }
  }

  function hasParams(r) {
    return r.params && Object.keys(r.params).length > 0;
  }

  /** Focused route chain, e.g. `__root > destination/[id]{"id":"gb-..."}`. */
  function path() {
    var st = rootState();
    var parts = [];
    while (st && st.routes && st.routes.length) {
      var r = st.routes[st.index == null ? st.routes.length - 1 : st.index];
      parts.push(r.name + (hasParams(r) ? JSON.stringify(r.params) : ''));
      st = r.state;
    }
    return parts.join(' > ');
  }

  /**
   * Root stack, two levels deep; `*` marks the focused entry, e.g.
   * `*__root[(tabs),*destination/[id]]`.
   */
  function stack() {
    // Two levels on purpose: deep enough to show duplicated tab shells or a
    // pushed screen, short enough to paste into a verdict. Use `nav` for all.
    var st = rootState();
    if (!st) return null;
    return st.routes
      .map(function (r, i) {
        return (
          (i === st.index ? '*' : '') +
          r.name +
          (r.state
            ? '[' +
              r.state.routes
                .map(function (x, j) {
                  return (j === r.state.index ? '*' : '') + x.name;
                })
                .join(',') +
              ']'
            : '')
        );
      })
      .join(' | ');
  }

  /** Full navigation state, simplified to names/params/index. */
  function nav() {
    function simp(s) {
      if (!s) return null;
      return {
        type: s.type,
        index: s.index,
        routes: s.routes.map(function (r) {
          return {
            name: r.name,
            params: hasParams(r) ? r.params : undefined,
            state: simp(r.state),
          };
        }),
      };
    }
    return simp(rootState());
  }

  // ---------------------------------------------------------------------------
  // Reading the screen
  // ---------------------------------------------------------------------------

  /**
   * Lines the focused screen renders, in order:
   *   plain text            — each outermost <Text>
   *   [a11y] label          — accessibilityLabel on a native view
   *   [input placeholder] p — a text field's placeholder
   * `all` includes screens that are mounted but not focused.
   */
  function lines(all) {
    var out = [];
    walk(function (f, focused) {
      if (!all && !focused) return;
      var p = f.memoizedProps;
      if (isOuterText(f)) {
        var t = textUnder(f).trim();
        if (t) out.push(t);
      }
      if (f.tag === 5 && p && p.accessibilityLabel) {
        out.push('[a11y] ' + p.accessibilityLabel);
      }
      if (f.tag === 5 && p && typeof p.placeholder === 'string' && p.placeholder) {
        out.push('[input placeholder] ' + p.placeholder);
      }
    });
    return out;
  }

  /** Everything `press` can target: text and labels, deduped (for hints). */
  function pressCandidates(all) {
    var seen = {};
    var out = [];
    walk(function (f, focused) {
      if (!all && !focused) return;
      var cands = [];
      if (isOuterText(f)) cands.push(textUnder(f).trim());
      if (f.tag === 5 && f.memoizedProps && f.memoizedProps.accessibilityLabel) {
        cands.push(String(f.memoizedProps.accessibilityLabel));
      }
      cands.forEach(function (c) {
        if (c && !seen[c]) {
          seen[c] = true;
          out.push(c);
        }
      });
    });
    return out;
  }

  /**
   * Host fibers whose text or accessibilityLabel matches. Exact matches come
   * first so `press Add` prefers a button reading exactly "Add" over
   * "Add document" when both are on screen.
   */
  function findText(match, opts) {
    var exact = [];
    var partial = [];
    walk(function (f, focused) {
      if (!opts.all && !focused) return;
      if (f.tag !== 5) return;
      var vals = [];
      if (isOuterText(f)) vals.push(textUnder(f).trim());
      if (f.memoizedProps && f.memoizedProps.accessibilityLabel) {
        vals.push(String(f.memoizedProps.accessibilityLabel));
      }
      for (var i = 0; i < vals.length; i++) {
        if (vals[i] === match) {
          exact.push({ fiber: f, text: vals[i] });
          return;
        }
        if (!opts.exact && vals[i].indexOf(match) !== -1) {
          partial.push({ fiber: f, text: vals[i] });
          return;
        }
      }
    });
    return exact.concat(partial);
  }

  /** A fake press event: enough for handlers that touch the event object. */
  function fakeEvent() {
    return {
      nativeEvent: {},
      persist: function () {},
      preventDefault: function () {},
      stopPropagation: function () {},
    };
  }

  // ---------------------------------------------------------------------------
  // Public API (globalThis.__qa)
  // ---------------------------------------------------------------------------

  var qa = {};

  /** Health check: is the DevTools hook there, how many roots are mounted. */
  qa.status = function () {
    return { hook: !!hook, roots: roots().length };
  };

  qa.path = path;
  qa.stack = stack;
  qa.nav = nav;

  /** Route + stack + rendered lines in one round trip. */
  qa.dump = function (all) {
    return { route: path(), stack: stack(), lines: lines(!!all) };
  };

  /**
   * Press the element whose text or label matches `match`.
   * opts: { index, exact, all, force }
   * Calls the nearest onPress at or above the matched native view. A
   * disabled control is reported, not pressed, unless opts.force — a real
   * finger would get no response from it either.
   */
  qa.press = function (match, opts) {
    opts = opts || {};
    // Count only ACTIONABLE matches, one per onPress owner:
    //   - a button's label and its inner text resolve to the same handler
    //     and count once, so --index counts buttons;
    //   - text that matches but has no onPress above it (a subtitle such as
    //     "Log in to pick up…" next to the "Log in" button) is dropped, so
    //     "match 1 of N" never overstates how many buttons there are.
    var matched = findText(match, opts);
    if (!matched.length) {
      return { ok: false, reason: 'not-found', candidates: pressCandidates(opts.all) };
    }
    var seenOwners = [];
    var found = [];
    matched.forEach(function (m) {
      var owner = ancestorWith(m.fiber, 'onPress');
      if (!owner || inList(seenOwners, owner)) return;
      seenOwners.push(owner);
      found.push(m);
    });
    if (!found.length) {
      // On screen, but nothing above any match handles a press.
      return { ok: false, reason: 'no-onpress', text: matched[0].text };
    }
    var idx = opts.index || 0;
    if (idx >= found.length) {
      return {
        ok: false,
        reason: 'index-out-of-range',
        matches: found.map(function (x) {
          return x.text;
        }),
      };
    }
    var target = ancestorWith(found[idx].fiber, 'onPress');
    if (!target) {
      return { ok: false, reason: 'no-onpress', text: found[idx].text };
    }
    if (isDisabled(target.memoizedProps) && !opts.force) {
      return { ok: false, reason: 'disabled', text: found[idx].text, via: nameOf(target) };
    }
    try {
      target.memoizedProps.onPress(fakeEvent());
    } catch (e) {
      return { ok: false, reason: 'threw', error: String(e && e.message) };
    }
    return {
      ok: true,
      text: found[idx].text,
      via: nameOf(target),
      index: idx,
      matches: found.length,
    };
  };

  /** Every text field on the focused screen with its current value. */
  qa.inputs = function (all) {
    var out = [];
    walk(function (f, focused) {
      if (!all && !focused) return;
      var p = f.memoizedProps;
      if (p && typeof p.onChangeText === 'function') {
        var row = {
          placeholder: p.placeholder,
          label: p.accessibilityLabel,
          testID: p.testID,
          value: p.value,
          secure: !!p.secureTextEntry,
        };
        var key = JSON.stringify(row);
        if (
          !out.some(function (x) {
            return JSON.stringify(x) === key;
          })
        ) {
          out.push(row);
        }
      }
    });
    return out;
  };

  /**
   * Fill a text field matched by placeholder, accessibilityLabel or testID.
   * Calls its onChangeText(value), exactly what typing would end with (but
   * without per-keystroke events or the on-screen keyboard).
   * opts: { index, all }
   */
  qa.fill = function (match, value, opts) {
    opts = opts || {};
    var hits = [];
    walk(function (f, focused) {
      if (!opts.all && !focused) return;
      var p = f.memoizedProps;
      if (!p || typeof p.onChangeText !== 'function') return;
      var keys = [p.placeholder, p.accessibilityLabel, p.testID];
      for (var i = 0; i < keys.length; i++) {
        if (typeof keys[i] === 'string' && keys[i].indexOf(match) !== -1) {
          // One field shows up on several fibers (a wrapper component, the
          // TextInput, its native view). The walk visits the outermost
          // first, so skip any fiber nested inside a field we already have.
          var up = f.return;
          while (up) {
            if (inList(hits, up)) return;
            up = up.return;
          }
          hits.push(f);
          return;
        }
      }
    });
    if (!hits.length) {
      return { ok: false, reason: 'not-found', inputs: qa.inputs(opts.all) };
    }
    var idx = opts.index || 0;
    if (idx >= hits.length) {
      return { ok: false, reason: 'index-out-of-range', matches: hits.length };
    }
    try {
      hits[idx].memoizedProps.onChangeText(String(value));
    } catch (e) {
      return { ok: false, reason: 'threw', error: String(e && e.message) };
    }
    return { ok: true, via: nameOf(hits[idx]), index: idx, matches: hits.length };
  };

  /** Everything with an onPress on the focused screen, with its label/text. */
  qa.pressables = function (all) {
    var out = [];
    walk(function (f, focused) {
      if (!all && !focused) return;
      var p = f.memoizedProps;
      if (f.tag !== 5 && p && typeof p.onPress === 'function') {
        var s =
          (p.accessibilityLabel ? '[' + p.accessibilityLabel + '] ' : '') +
          textUnder(f, 200).trim().slice(0, 80) +
          (isDisabled(p) ? ' (disabled)' : '');
        if (out.indexOf(s) === -1) out.push(s);
      }
    });
    return out;
  };

  /**
   * The app's TanStack QueryClient (found on QueryClientProvider's props).
   * For `eval`: read or seed cache data, e.g.
   *   __qa.qc().getQueryCache().getAll().map(q => q.queryKey)
   *   __qa.qc().setQueryData([...key], data)
   * Seeded data lives in memory only; label any check built on it
   * "(injected)" in the verdict.
   */
  qa.qc = function () {
    var c = null;
    walk(function (f) {
      var p = f.memoizedProps;
      if (p && p.client && typeof p.client.getQueryCache === 'function') {
        c = p.client;
        return false;
      }
    });
    return c;
  };

  /** Query keys currently in the cache, as JSON strings (for `eval`). */
  qa.queryKeys = function () {
    var c = qa.qc();
    if (!c) return null;
    return c
      .getQueryCache()
      .getAll()
      .map(function (q) {
        return JSON.stringify(q.queryKey);
      });
  };

  /** The raw navigation object, for `eval` (e.g. `__qa.navObj().goBack()`). */
  qa.navObj = navObj;
  /** The raw walker, for one-off `eval` probes. */
  qa.walk = walk;

  // ---------------------------------------------------------------------------
  // Async results, modules, dev menu
  // ---------------------------------------------------------------------------

  /**
   * Promise settling for `walk.mjs eval`. RN's Promise polyfill isn't a
   * native promise, so CDP's awaitPromise does nothing with it; instead the
   * CLI wraps the expression in settle(), then polls settled(id).
   */
  var pending = globalThis.__qaPending || (globalThis.__qaPending = {});
  qa.settle = function (id, v) {
    if (!v || typeof v.then !== 'function') return { state: 'value', value: v };
    pending[id] = { done: false };
    v.then(
      function (r) {
        pending[id] = { done: true, value: r };
      },
      function (e) {
        pending[id] = { done: true, error: String((e && (e.stack || e.message)) || e) };
      },
    );
    return { state: 'pending', id: id };
  };
  qa.settled = function (id) {
    var p = pending[id];
    if (!p) return { done: true, error: 'unknown pending id ' + id };
    if (p.done) delete pending[id];
    return p;
  };

  /** Metro's module table as [id, verboseName, initialized] (dev bundles only). */
  function moduleTable() {
    var r = globalThis.__r;
    if (!r || typeof r.getModules !== 'function') return [];
    var ms = r.getModules();
    var out = [];
    var add = function (m, id) {
      if (m) out.push({ id: Number(id), name: m.verboseName || '', initialized: !!m.isInitialized });
    };
    if (ms && typeof ms.forEach === 'function') ms.forEach(add);
    else if (ms) Object.keys(ms).forEach(function (k) { add(ms[k], k); });
    return out;
  }

  /** Bundled modules whose path matches `pattern` (a regex string). */
  qa.mods = function (pattern) {
    var re = new RegExp(pattern);
    return moduleTable().filter(function (m) {
      return re.test(m.name);
    });
  };

  /**
   * Exports of the bundled module matching `pattern`, e.g.
   *   __qa.mod('stores/auth.store').useAuthStore.getState().isAuthenticated
   * Prefers an already-initialised module, so it doesn't run a module's top
   * level for the first time as a side effect. Use inside an expression;
   * whole module objects are usually too big to print.
   */
  qa.mod = function (pattern) {
    var hits = qa.mods(pattern);
    if (!hits.length) throw new Error('no bundled module matches ' + pattern);
    var pick = hits.filter(function (m) { return m.initialized; })[0] || hits[0];
    return globalThis.__r(pick.id);
  };

  /** A native Expo module, e.g. __qa.native('ExpoDevMenu'). */
  qa.native = function (name) {
    var m = globalThis.expo && globalThis.expo.modules && globalThis.expo.modules[name];
    if (!m) throw new Error('no native Expo module ' + name);
    return m;
  };

  /** Close the Expo dev menu if it opened over the app. */
  qa.closeDevMenu = function () {
    qa.native('ExpoDevMenu').closeMenu();
    return 'closed';
  };

  globalThis.__qa = qa;
})();
