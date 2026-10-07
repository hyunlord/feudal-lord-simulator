# Heavy-run slots on the DGX (sourced by remote-exec.sh; bash, Linux flock): at most HEAVY_SLOTS (3) heavy runs at once
# across all sessions — full regression, clean clones, the ui-geometry audit, guardrails and long campaign runs (run.sh
# decides what is heavy). Why (2026-10-04): the render LM-R1 audit overlapping the engine FIX-17 clone did a third of its
# work in 6.5 hours at load 23. Light runs (single test files, short probes) and the performance measurements (decision
# RR3: measuring never waits) are outside the cap.
#   heavy_take_slot <base> <run> <what>    returns holding fd 5 = the slot lock, kept for the run's whole command
# A run takes _slots/heavy.<n>.lock and writes _slots/heavy.<n>.info (run, start, what). When every slot is taken it
# waits in line, first come first served: a ticket _slots/queue/<ns>-<run> it holds locked while waiting. A ticket whose
# lock is free and that is older than a minute belongs to a run that is gone and is removed. While waiting the run logs
# its place in line, what holds each slot and who is ahead — at the start, whenever that changes, and every 10 minutes.
# A ticket holds its run's cap (a ticket of an older copy of this file is empty and counts as 2). A run may take a free
# slot that no run ahead of it could take (a slot above every cap ahead): when the cap rose to 3, the third slot is not
# left empty behind runs that only know two (2026-10-06).
# 3 since 2026-10-06 (user order: every session waited hours in line; was 2). <base>/_slots/max, when it holds a number,
# overrides it at every check, so the DGX can change the cap without a code push.
HEAVY_SLOTS=${HEAVY_SLOTS:-3}
heavy__cap() { local c; read -r c 2> /dev/null < "$HEAVY_DIR/max" && [[ $c =~ ^[1-9][0-9]?$ ]] && HEAVY_SLOTS=$c; return 0; }
HEAVY_POLL_S=${HEAVY_POLL_S:-10}

# Is this lock file held by a live process? (opened for reading: never created here)
heavy__held() { [ -e "$1" ] && ! ( flock -n 7 ) 7<"$1"; }

heavy__running() {
  local n run since what
  for n in $(seq 1 "$HEAVY_SLOTS"); do
    heavy__held "$HEAVY_DIR/heavy.$n.lock" || continue
    IFS=$'\t' read -r run since what < "$HEAVY_DIR/heavy.$n.info" 2> /dev/null || { echo "slot $n: (no info)"; continue; }
    if [ "${1:-}" = --names ]; then echo "$n:$run"; continue; fi
    echo "slot $n: $run (since $(date -d "@$since" +%H:%M 2> /dev/null || echo "$since"), $(( ($(date +%s) - since) / 60 )) min) $what"
  done
}

heavy_take_slot() {
  local base=$1 run=$2 what=$3 ticket t name born n now place state last="" last_at=0
  HEAVY_DIR=$base/_slots
  mkdir -p "$HEAVY_DIR/queue"
  ticket="$HEAVY_DIR/queue/$(date +%s%N)-$run"
  heavy__cap
  exec 6> "$ticket"
  flock -n 6 || true
  echo "$HEAVY_SLOTS" > "$ticket"
  while :; do
    heavy__cap
    [ "$(cat "$ticket" 2> /dev/null)" = "$HEAVY_SLOTS" ] || echo "$HEAVY_SLOTS" > "$ticket"
    [ -e "$ticket" ] || { exec 6> "$ticket"; flock -n 6 || true; }   # never dropped while held, but be safe
    now=$(date +%s)
    local ahead=() above=0 cap
    for t in $(ls -1 "$HEAVY_DIR/queue" 2> /dev/null | sort); do
      [ "$HEAVY_DIR/queue/$t" = "$ticket" ] && break
      born=$(( ${t%%-*} / 1000000000 ))
      if heavy__held "$HEAVY_DIR/queue/$t" || [ $((now - born)) -lt 60 ]; then
        ahead+=("${t#*-}")
        read -r cap 2> /dev/null < "$HEAVY_DIR/queue/$t"; [[ ${cap:-} =~ ^[1-9][0-9]?$ ]] || cap=2
        [ "$cap" -gt "$above" ] && above=$cap
      else rm -f "$HEAVY_DIR/queue/$t"; fi
    done
    if [ "$above" -lt "$HEAVY_SLOTS" ]; then
      for n in $(seq $((above + 1)) "$HEAVY_SLOTS"); do
        exec 5> "$HEAVY_DIR/heavy.$n.lock"
        if flock -n 5; then
          printf '%s\t%s\t%s\n' "$run" "$now" "$what" > "$HEAVY_DIR/heavy.$n.info"
          echo "== heavy slot $n/$HEAVY_SLOTS"
          exec 6>&-; rm -f "$ticket"
          return 0
        fi
        exec 5>&-
      done
    fi
    place=$(( ${#ahead[@]} + 1 ))
    state="$place|$(heavy__running --names | tr '\n' ' ')|${ahead[*]:-}"
    if [ "$state" != "$last" ] || [ $((now - last_at)) -ge 600 ]; then
      echo "== waiting for a heavy slot (all $HEAVY_SLOTS busy): number $place in line"
      heavy__running | sed 's/^/   running /'
      [ "${#ahead[@]}" -gt 0 ] && echo "   ahead in line: ${ahead[*]}"
      last=$state; last_at=$now
    fi
    sleep "$HEAVY_POLL_S"
  done
}
