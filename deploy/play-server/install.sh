#!/usr/bin/env bash
# Installs the play server for the current user (PLAY-1). Run on the server from a clone of the repository:
#   git clone -b codex/phase15-organic-ground https://github.com/hyunlord/feudal-lord-simulator ~/fls-play/repo
#   ~/fls-play/repo/deploy/play-server/install.sh
# User units (no root). To start them at boot without a login, lingering must be on once:
#   sudo loginctl enable-linger "$USER"      (the only sudo step)
set -euo pipefail
ROOT=${FLS_PLAY_ROOT:-$HOME/fls-play}
HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$ROOT/bin" "$ROOT/state" "$ROOT/releases" "$HOME/.config/systemd/user"
install -m 755 "$HERE/update.sh" "$ROOT/bin/update.sh"
install -m 644 "$HERE/serve.mjs" "$ROOT/bin/serve.mjs"
install -m 644 "$HERE"/systemd/fls-play.service "$HERE"/systemd/fls-play-update.service "$HERE"/systemd/fls-play-update.timer "$HOME/.config/systemd/user/"
[ -d "$ROOT/repo/.git" ] || git clone -b codex/phase15-organic-ground https://github.com/hyunlord/feudal-lord-simulator "$ROOT/repo"
systemctl --user daemon-reload
"$ROOT/bin/update.sh" --force || echo "first build failed: see $ROOT/state/status.json"
systemctl --user enable --now fls-play.service fls-play-update.timer
loginctl show-user "$USER" -p Linger
systemctl --user --no-pager status fls-play.service fls-play-update.timer | head -20
