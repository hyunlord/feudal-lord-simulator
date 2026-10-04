#!/usr/bin/env bash
set -euo pipefail
[[ "$(uname -s)" == Linux && "$PWD" == /home/hyunlord/fls-runs/* ]] || exit 64
: "${FLS_REMOTE_PORT:?Official runner required}"
base=output/steward-food-choice-r08
[[ ! -e "$base/result" ]] || exit 65
[[ "$(git rev-parse HEAD)" == 5fb1aebfe735592c1424c947e88388d4ffe21742 ]] || exit 66
finish() {
 rc=$?
 trap - EXIT
 printf '%s\n' "$rc" > "$base/exit.txt"
 sha256sum -c "$base/SOURCE_SHA256SUMS" > "$base/source-after.log" || rc=67
 (cd "$base" && sha256sum -c SHA256SUMS) > "$base/artifact-after.log" || rc=68
 printf 'No browser/server. Single foreground timeout child; exited %s. SIGKILL/host failure cleanup is not covered.\n' "$rc" > "$base/cleanup.txt"
 exit "$rc"
}
trap finish EXIT
sha256sum -c "$base/SOURCE_SHA256SUMS" > "$base/source-before.log"
(cd "$base" && sha256sum -c SHA256SUMS) > "$base/artifact-before.log"
timeout --signal=TERM --kill-after=5s 60s nice -n 19 node_modules/.bin/tsx "$base/probe.mjs"
