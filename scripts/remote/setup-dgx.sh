#!/usr/bin/env bash
# One-time (idempotent) DGX preparation for the remote runner (REMOTE-1). From the Mac: npm run remote:setup
# (= ssh hyunlord@100.70.109.50 bash -s < scripts/remote/setup-dgx.sh). No sudo: everything lives in ~/fls-runs and
# ~/.config/systemd/user. The play server (~/fls-play, port 4173) is not touched.
set -euo pipefail
BASE=$HOME/fls-runs
TOOLS=$BASE/_tools
PLAYWRIGHT_CORE_VERSION=1.62.1   # its Chromium (linux-arm64) is revision 1234
GIT_LFS_VERSION=3.8.0
mkdir -p "$BASE"/{_cache,_tools/bin,_locks,_slots,_ports,_clones} "$HOME/.config/systemd/user"

# Node 20 (the same one PLAY-1 builds with).
node_version=$(node -v)
case "$node_version" in v20.*) echo "node $node_version (/usr/bin/node)" ;; *) echo "expected Node 20, found $node_version" >&2; exit 1 ;; esac

# playwright-core + its Chromium for linux-arm64.
if [ "$(node -p "require('$TOOLS/node_modules/playwright-core/package.json').version" 2>/dev/null)" != "$PLAYWRIGHT_CORE_VERSION" ]; then
  npm install --prefix "$TOOLS" --no-audit --no-fund --loglevel=error "playwright-core@$PLAYWRIGHT_CORE_VERSION"
fi
node "$TOOLS/node_modules/playwright-core/cli.js" install chromium
node --input-type=module -e "import { chromium } from '$TOOLS/node_modules/playwright-core/index.mjs'; console.log(chromium.executablePath())" > "$TOOLS/chromium-path"
echo "chromium $(cat "$TOOLS/chromium-path")"

# Tests that default to Chrome on Linux look for /usr/bin/google-chrome. The only sudo step (once):
#   sudo ln -sfn "$(cat ~/fls-runs/_tools/chromium-path)" /usr/bin/google-chrome
if [ "$(readlink -f /usr/bin/google-chrome 2>/dev/null)" = "$(readlink -f "$(cat "$TOOLS/chromium-path")")" ]; then
  echo "/usr/bin/google-chrome -> Playwright Chromium"
else
  echo "MISSING: /usr/bin/google-chrome. Ask the user to run once on the DGX:" >&2
  echo "  sudo ln -sfn $(cat "$TOOLS/chromium-path") /usr/bin/google-chrome" >&2
fi

# git-lfs (clean-clone checks pull LFS files).
if ! "$TOOLS/bin/git-lfs" version 2>/dev/null | grep -q "$GIT_LFS_VERSION"; then
  tmp=$(mktemp -d)
  curl -fsSL "https://github.com/git-lfs/git-lfs/releases/download/v$GIT_LFS_VERSION/git-lfs-linux-arm64-v$GIT_LFS_VERSION.tar.gz" | tar -xz -C "$tmp"
  install -m 755 "$(find "$tmp" -name git-lfs -type f | head -1)" "$TOOLS/bin/git-lfs"
  rm -rf "$tmp"
fi
"$TOOLS/bin/git-lfs" version

# Korean fonts for captures (Noto CJK). Installing them needs sudo: sudo apt-get install fonts-noto-cjk
if fc-list :lang=ko family | grep -qi 'noto'; then echo "fonts: $(fc-list :lang=ko family | grep -ci noto) Noto families with Korean"; else
  echo "fonts: no Noto CJK. Ask the user to run once: sudo apt-get install -y fonts-noto-cjk" >&2; exit 1; fi

# Headless check: launch through the same shim path the runs use, render Korean text, read its width.
node --input-type=module -e "
  import { chromium } from '$TOOLS/node_modules/playwright-core/index.mjs';
  const browser = await chromium.launch({ executablePath: '$(cat "$TOOLS/chromium-path")', headless: true });
  const page = await browser.newPage();
  await page.setContent('<meta charset=utf-8><span id=k style=\"font:20px sans-serif\">영주 시뮬레이터</span>');
  const width = await page.evaluate(() => document.getElementById('k').getBoundingClientRect().width);
  console.log('headless', browser.version(), 'korean text width', Math.round(width), 'px');
  await browser.close();
  if (!(width > 80)) process.exit(1);"

# All remote runs share fls-runs.slice: together they never exceed 48 GB or 12 of the 20 cores.
cat > "$HOME/.config/systemd/user/fls-runs.slice" <<'UNIT'
[Unit]
Description=Feudal Lord Simulator remote verification runs (REMOTE-1)

[Slice]
MemoryMax=48G
CPUQuota=1200%
UNIT
systemctl --user daemon-reload
systemctl --user show fls-runs.slice -p MemoryMax -p CPUQuotaPerSecUSec

# Bare mirror whose objects back each run folder's git metadata.
if [ ! -d "$BASE/_cache/repo.git" ]; then
  git clone -q --bare https://github.com/hyunlord/feudal-lord-simulator "$BASE/_cache/repo.git"
  git -C "$BASE/_cache/repo.git" config remote.origin.fetch '+refs/heads/*:refs/heads/*'
fi
git -C "$BASE/_cache/repo.git" fetch -q --prune origin
echo "mirror $(du -sh "$BASE/_cache/repo.git" | cut -f1)"
echo "setup ok"
