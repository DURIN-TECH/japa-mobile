#!/usr/bin/env bash
# Generate Expo Router typed-route declarations into .expo/types/router.d.ts.
#
# Expo Router's typed routes are emitted as a side effect of Metro
# starting (`expo start`). There is no dedicated one-shot CLI as of
# the Expo version this project pins, so we start the server, wait
# for the types file to appear, then terminate it.
#
# Used by CI before `npx tsc` so the typecheck sees an up-to-date
# route table. Safe to run locally too.

set -uo pipefail

TYPES_FILE=".expo/types/router.d.ts"
TIMEOUT_SECONDS="${EXPO_TYPEGEN_TIMEOUT:-60}"

# Snapshot mtime (if any) so we can detect a regeneration even when the
# file already exists from a prior run.
prior_mtime=""
if [ -f "$TYPES_FILE" ]; then
  prior_mtime=$(stat -f %m "$TYPES_FILE" 2>/dev/null || stat -c %Y "$TYPES_FILE")
fi

# Start Metro in the background. --no-dev disables HMR overhead; --port 0
# picks any free port so concurrent CI shards don't collide.
npx expo start --no-dev --port 0 > /dev/null 2>&1 &
EXPO_PID=$!

# Ensure we always reap the background process.
# shellcheck disable=SC2329  # invoked indirectly via the `trap ... EXIT` below
cleanup() {
  kill "$EXPO_PID" 2>/dev/null || true
  wait "$EXPO_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Poll for the types file to be (re)generated.
for _ in $(seq 1 "$TIMEOUT_SECONDS"); do
  if [ -s "$TYPES_FILE" ]; then
    current_mtime=$(stat -f %m "$TYPES_FILE" 2>/dev/null || stat -c %Y "$TYPES_FILE")
    if [ "$current_mtime" != "$prior_mtime" ]; then
      echo "Generated $TYPES_FILE"
      exit 0
    fi
  fi
  sleep 1
done

echo "Timed out after ${TIMEOUT_SECONDS}s waiting for $TYPES_FILE" >&2
exit 1
