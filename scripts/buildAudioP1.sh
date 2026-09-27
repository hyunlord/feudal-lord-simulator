#!/usr/bin/env bash
# AUDIO-1: builds the P1 sounds into public/audio (the F0-V 15 stay as scripts/buildAudio.sh made them): 17 made by this
# project (scripts/synthAudioP1.py: the three season ambiences, the building, walker and event loops and calls, the
# fanfare; Kenney CC0 knocks, creaks, strikes and coins layered in) and five Kenney Music Jingles (CC0: the four season
# stingers and the unlock call). Every file is encoded once to mono MP3 (libmp3lame, as buildAudio.sh). Needs ffmpeg and
# python3/numpy. <kenney-dir> holds kenney_impact-sounds, kenney_rpg-audio and kenney_music-jingles (kenney.nl, CC0).
#   bash scripts/buildAudioP1.sh <kenney-dir>
set -euo pipefail
K="$1"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$ROOT/public/audio"; WORK="$(mktemp -d)"; mkdir -p "$OUT"
trap 'rm -rf "$WORK"' EXIT
python3 "$ROOT/scripts/synthAudioP1.py" "$K" "$WORK"
for wav in "$WORK"/*.wav; do
  name=$(basename "$wav" .wav)
  ffmpeg -v error -y -i "$wav" -ac 1 -ar 44100 -c:a libmp3lame -q:a 4 "$OUT/$name.mp3"
done
jingle() { ffmpeg -v error -y -i "$K/kenney_music-jingles/Audio/Pizzicato jingles/$1.ogg" -ac 1 -ar 44100 -c:a libmp3lame -q:a 4 "$OUT/$2.mp3"; }
jingle jingles_PIZZI07 season_spring
jingle jingles_PIZZI03 season_summer
jingle jingles_PIZZI12 season_autumn
jingle jingles_PIZZI01 season_winter
jingle jingles_PIZZI00 unlock_banner
cp "$K/kenney_music-jingles/License.txt" "$ROOT/public/licenses/audio/Kenney-music-jingles-License.txt"
ls "$OUT" | wc -l
