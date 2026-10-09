#!/usr/bin/env bash
# ER-13 wording variants on the DGX: natural-play exposure (scripts/variantExposureRun.ts) — the lord's slice played by the
# lord bot on its own land, seeds 1-5, and on the woodland (core:forest_edge, the only land 041's pannage words read), seeds
# 1-3; first as the bot plays (its steward answers the small petitions by custom), then with the lord keeping the three
# home kinds the variants dress (`keeps`). Seven at a time (a & b & wait). Each run's counts into
# docs/verification/variants/exposure/, the state of each variant's first natural showing kept in
# $HOME/fls-variant-states/natural.
#   scripts/remote/run.sh render-VARIANTS-exposure-<sha7> --detach --keep -- bash scripts/variantExposureRuns.sh
set -u
out=docs/verification/variants/exposure
keep=${VARIANT_STATES_KEEP:-$HOME/fls-variant-states}/natural
mkdir -p "$out" "$keep" .remote/variant-exposure
run() { node_modules/.bin/tsx scripts/variantExposureRun.ts "$1" "$2" "$keep" "$4" > "$out/$3.json" 2> ".remote/variant-exposure/$3.log"; echo "$3 exit $?"; }
run 1 - slice-s1 bot & run 2 - slice-s2 bot & run 3 - slice-s3 bot & run 4 - slice-s4 bot & run 5 - slice-s5 bot &
run 1 core:forest_edge forest-s1 bot & run 2 core:forest_edge forest-s2 bot &
wait
run 3 core:forest_edge forest-s3 bot & run 1 - slice-s1-keeps keeps & run 2 - slice-s2-keeps keeps & run 3 - slice-s3-keeps keeps &
run 1 core:forest_edge forest-s1-keeps keeps & run 2 core:forest_edge forest-s2-keeps keeps & run 3 core:forest_edge forest-s3-keeps keeps &
wait
ls -la "$keep"
