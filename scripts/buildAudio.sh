#!/usr/bin/env bash
# F0-V: builds public/audio from Kenney CC0 packs (downloaded to $1: kenney_impact-sounds, kenney_interface-sounds,
# kenney_rpg-audio) and one synthesized ambience (scripts/synthAmbience.py). Every file is re-encoded once to mono
# MP3 (libmp3lame, every target browser plays it); the two composites (cart loop, spring ambience) are built here. Needs ffmpeg and python3/numpy.
#   bash scripts/buildAudio.sh <kenney-dir>
set -euo pipefail
K="$1"; OUT="$(cd "$(dirname "$0")/.." && pwd)/public/audio"; mkdir -p "$OUT"
enc() { ffmpeg -v error -y -i "$1" -ac 1 -ar 44100 -c:a libmp3lame -q:a 4 "$OUT/$2.mp3"; }
enc "$K/kenney_interface-sounds/Audio/confirmation_001.ogg" place_ok
enc "$K/kenney_interface-sounds/Audio/back_001.ogg" place_cancel
enc "$K/kenney_interface-sounds/Audio/error_006.ogg" place_blocked
enc "$K/kenney_interface-sounds/Audio/pluck_001.ogg" alert_info
enc "$K/kenney_interface-sounds/Audio/glass_004.ogg" alert_warn
enc "$K/kenney_impact-sounds/Audio/impactBell_heavy_000.ogg" alert_urgent
enc "$K/kenney_impact-sounds/Audio/impactWood_medium_000.ogg" hammer_1
enc "$K/kenney_impact-sounds/Audio/impactWood_medium_002.ogg" hammer_2
enc "$K/kenney_impact-sounds/Audio/impactWood_medium_004.ogg" hammer_3
enc "$K/kenney_impact-sounds/Audio/impactWood_heavy_001.ogg" unload_wood
enc "$K/kenney_impact-sounds/Audio/impactMining_002.ogg" unload_stone
enc "$K/kenney_impact-sounds/Audio/impactSoft_heavy_002.ogg" stage_thud
enc "$K/kenney_interface-sounds/Audio/confirmation_004.ogg" complete
# Cart loop (2.4 s): a wheel creak at 0 and 1.2 s over four light wooden knocks, quiet.
ffmpeg -v error -y -i "$K/kenney_rpg-audio/Audio/creak1.ogg" -i "$K/kenney_impact-sounds/Audio/impactWood_light_001.ogg" -filter_complex \
  "[0]asplit=2[c1][c2];[c2]adelay=1200|1200[c2d];[1]asplit=4[k1][k2][k3][k4];[k2]adelay=600|600[k2d];[k3]adelay=1200|1200[k3d];[k4]adelay=1800|1800[k4d];\
[c1][c2d][k1][k2d][k3d][k4d]amix=inputs=6:normalize=0,volume=0.6,apad=whole_dur=2.4,atrim=0:2.4" -ac 1 -ar 44100 -c:a libmp3lame -q:a 4 "$OUT/cart_loop.mp3"
# Spring ambience (12 s loop): synthesized (project-made, no source recording).
python3 "$(dirname "$0")/synthAmbience.py" "$OUT/spring_ambience.wav"
ffmpeg -v error -y -i "$OUT/spring_ambience.wav" -ac 1 -ar 44100 -c:a libmp3lame -q:a 5 "$OUT/spring_ambience.mp3" && rm "$OUT/spring_ambience.wav"
ls "$OUT" | wc -l
