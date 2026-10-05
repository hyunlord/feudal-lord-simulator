#!/usr/bin/env bash
# QA-003 gate evidence on the DGX: serves this run folder (and, given a base commit, that commit beside it) with the
# no-watch dev server (scripts/remote/viteNoWatch.config.ts: the DGX's inotify watches run out with two watched trees),
# then runs scripts/qa003GateCaptures.ts on each, labels "after" and "before".
#   scripts/remote/run.sh render-QA003-gates-<sha7> -- bash scripts/qa003GateCaptures.sh <base-sha|-> <out dir>
set -euo pipefail
base_sha=$1; out=$2; shift 2
port=${FLS_REMOTE_PORT:?run through scripts/remote/run.sh}
. scripts/remote/devServers.sh   # every server started here stops on any exit, failures and a stopped run included
serve() { fls_serve "$1" ${3:+--in "$3"} --config scripts/remote/viteNoWatch.config.ts --host 127.0.0.1 --port "$2" --strictPort; }  # <log> <port> [dir]
up() { for _ in $(seq 1 90); do curl -sf "$1" > /dev/null && return 0; sleep 1; done; echo "vite did not come up on $1"; return 1; }
serve .remote/vite-this.log "$port"
dir=.remote/base-build
fls_on_exit 'git worktree remove --force "$dir" 2>/dev/null || true'
if [ "$base_sha" != "-" ]; then
  git worktree remove --force "$dir" 2>/dev/null || true
  git worktree add -q --detach "$dir" "$base_sha"
  ln -sfn "$PWD/node_modules" "$dir/node_modules"
  # The base serves its own tree with this run's no-watch config (the base may predate it).
  cp scripts/remote/viteNoWatch.config.ts "$dir/scripts/remote/viteNoWatch.config.ts"
  serve .remote/vite-base.log $((port + 50)) "$dir"
fi
up "http://127.0.0.1:$port/"
node_modules/.bin/tsx scripts/qa003GateCaptures.ts "http://127.0.0.1:$port/" "$out" after
if [ "$base_sha" != "-" ]; then
  up "http://127.0.0.1:$((port + 50))/"
  node_modules/.bin/tsx scripts/qa003GateCaptures.ts "http://127.0.0.1:$((port + 50))/" "$out" before
fi
