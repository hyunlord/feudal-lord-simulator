#!/bin/sh
# Installs the repository's git hooks (npm run hooks:install; also run by postinstall, so a fresh clone gets them
# with npm ci). The hooks directory is shared by every worktree of a clone, so one install covers all sessions.
# Idempotent. An existing pre-push that is not ours (normally git-lfs's) is kept as pre-push.chained and still runs.
set -eu
top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "hooks:install: not a git checkout, skipped"; exit 0; }
cd "$top"
hooks=$(git rev-parse --path-format=absolute --git-path hooks)
mkdir -p "$hooks"
src="$top/scripts/git-hooks/pre-push"
dst="$hooks/pre-push"
if [ -f "$dst" ] && ! grep -q 'fls-pre-push-guard' "$dst"; then
  if [ -e "$hooks/pre-push.chained" ]; then
    echo "hooks:install: $dst is not ours and pre-push.chained already exists; resolve by hand" >&2
    exit 1
  fi
  mv "$dst" "$hooks/pre-push.chained"
  echo "hooks:install: kept the previous pre-push as pre-push.chained"
fi
if ! cmp -s "$src" "$dst" 2>/dev/null; then
  cp "$src" "$dst.tmp" && chmod 755 "$dst.tmp" && mv -f "$dst.tmp" "$dst"
  echo "hooks:install: pre-push guard installed in $hooks"
fi
