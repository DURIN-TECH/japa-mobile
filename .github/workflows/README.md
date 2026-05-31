# Workflows

Four GitHub Actions wire the EAS build + OTA pipeline to this repo's
`main`/`dev`/feature-branch model. All four require an `EXPO_TOKEN` repo
secret and exit early if it's missing.

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `development.yml` | push to `dev` | EAS dev build (iOS + Android) |
| `preview.yml` | PR to `dev` | OTA via `eas update --auto` |
| `preview-native.yml` | manual dispatch | Native preview build |
| `production.yml` | merge to `main` | Build, submit, release |

## development.yml

Every push to `dev` runs lint, `tsc`, and `eas build --profile development
--platform all`. The dev profile produces a debug-capable build subscribed
to the `development` EAS Update channel — install it once on your test
device and subsequent dev pushes update it OTA where possible.

## preview.yml

Fires on PR open/sync against `dev`. Runs `eas update --auto`, which
publishes the current branch's JS bundle to an EAS Update branch named
after the git branch. The `expo/expo-github-action/preview` step posts a
QR code in the PR comments — reviewers scan it with their installed
preview client to load that PR's JS.

Only ships JS-level changes. If the PR touches native code, runtime
fingerprint changes and the OTA gets pinned to the older runtime; use
`preview-native.yml` for those.

## preview-native.yml

Manually triggered from the Actions tab. Pick a branch, choose
`ios`/`android`/`all`, and the workflow runs lint + `tsc` + `eas build
--profile preview --platform <choice>`. Use for branches that include
native module additions or config-plugin edits that OTA can't deliver.

## production.yml

Only fires when a PR is **merged** into `main` (not on every PR-to-main
open). Trigger uses `pull_request: types: [closed]` with a
`merged == true` job guard so PR context (number, title) stays available
for the GitHub release body. Pipeline: lint -> tsc -> `eas build
--profile production --platform all` -> `eas submit --platform all` ->
create a `v<run_number>` GitHub release referencing the merged PR.

## Required secrets

- `EXPO_TOKEN` — EAS access token. Settings -> Secrets and variables ->
  Actions. Every workflow short-circuits with `exit 1` if it's missing.

## Channel + runtime configuration

OTA targeting is configured in `eas.json` (per-profile `channel` field:
`development`/`preview`/`production`) and `app.json`
(`updates.url` + `runtimeVersion.policy = "fingerprint"`). Fingerprint
auto-bumps the runtime whenever native code or config plugins change, so
OTA updates are only delivered to compatible clients without any manual
version bookkeeping.
