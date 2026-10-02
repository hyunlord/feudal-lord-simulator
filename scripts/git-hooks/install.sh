#!/bin/sh
# Installs the repository's git hooks (npm run hooks:install; also run by postinstall, so a fresh clone gets them
# with npm ci). The hooks directory is shared by every worktree of a clone, so one install covers all sessions.
# Idempotent. An existing hook that is not ours (normally git-lfs's) is kept as <hook>.chained and still runs.
#   pre-push    trunk/main push guard, merge checks, the per-commit trend start (AGENTS.md rules 14, 19)
#   post-merge  the perf-trend page refreshed and committed when it lags (decision RR4)
# It also configures the merge driver the perf-trend page uses (.gitattributes merge=fls-trend).
set -eu
top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "hooks:install: not a git checkout, skipped"; exit 0; }
cd "$top"
hooks=$(git rev-parse --path-format=absolute --git-path hooks)
mkdir -p "$hooks"
install_hook() { # <name> <marker>
  src="$top/scripts/git-hooks/$1"
  dst="$hooks/$1"
  if [ -f "$dst" ] && ! grep -q "$2" "$dst"; then
    if [ -e "$dst.chained" ]; then
      echo "hooks:install: $dst is not ours and $1.chained already exists; resolve by hand" >&2
      exit 1
    fi
    mv "$dst" "$dst.chained"
    echo "hooks:install: kept the previous $1 as $1.chained"
  fi
  if ! cmp -s "$src" "$dst" 2>/dev/null; then
    cp "$src" "$dst.tmp" && chmod 755 "$dst.tmp" && mv -f "$dst.tmp" "$dst"
    echo "hooks:install: $1 installed in $hooks"
  fi
}
install_hook pre-push fls-pre-push-guard
install_hook post-merge fls-post-merge-trend
# The driver runs in the merging worktree; a worktree without the script (an old branch) merges as plain text.
driver='sh -c '"'"'d="$(git rev-parse --show-toplevel)/scripts/perf/trendMergeDriver.mjs"; if [ -f "$d" ]; then exec node "$d" "$@"; else exec git merge-file "$2" "$1" "$3"; fi'"'"' fls-trend %O %A %B %P'
if [ "$(git config --get merge.fls-trend.driver 2>/dev/null || true)" != "$driver" ]; then
  git config merge.fls-trend.name "perf-trend page: keep the side with more measured commits (decision RR4)"
  git config merge.fls-trend.driver "$driver"
  echo "hooks:install: merge driver fls-trend configured"
fi
