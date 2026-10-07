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
# Two lines (user order 2026-10-06, decision RR20): the gate line (_slots/queue-gate/: what a push needs — the changed
# rows' geometry audit, test:changed when run heavy; short) and the experiment line (_slots/queue/: long games, probes,
# analyses, clones, guardrails; long). A gate takes any free slot before any experiment and tries the last slot first;
# the last slot is kept for gates, so experiments use slots 1..cap-1 and a gate runs at once even when experiments fill
# the rest. While a gate waits, no experiment takes a slot. A run is a gate only when run.sh is told --gate.
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

heavy_take_slot() { # <base> <run> <what> [gate|experiment]
  local base=$1 run=$2 what=$3 class=${4:-${HEAVY_CLASS:-experiment}} ticket t born n now place state last="" last_at=0
  [ "$class" = gate ] || class=experiment
  HEAVY_DIR=$base/_slots
  local gq=$HEAVY_DIR/queue-gate eq=$HEAVY_DIR/queue
  mkdir -p "$gq" "$eq"
  heavy__cap
  if [ "$class" = gate ]; then ticket="$gq/$(date +%s%N)-$run"; else ticket="$eq/$(date +%s%N)-$run"; fi
  exec 6> "$ticket"
  flock -n 6 || true
  echo "$HEAVY_SLOTS" > "$ticket"
  while :; do
    heavy__cap
    [ "$(cat "$ticket" 2> /dev/null)" = "$HEAVY_SLOTS" ] || echo "$HEAVY_SLOTS" > "$ticket"
    [ -e "$ticket" ] || { exec 6> "$ticket"; flock -n 6 || true; }   # never dropped while held, but be safe
    now=$(date +%s)
    # The live tickets of one line, oldest first (a ticket whose lock is free and that is over a minute old belongs to a
    # run that is gone and is removed).
    local ahead=() gates_waiting=0 above=0 cap
    live() { local dir=$1 stop=${2:-}
      for t in $(ls -1 "$dir" 2> /dev/null | sort); do
        [ "$dir/$t" = "$stop" ] && return 0
        born=$(( ${t%%-*} / 1000000000 ))
        if heavy__held "$dir/$t" || [ $((now - born)) -lt 60 ]; then echo "$t"; else rm -f "$dir/$t"; fi
      done; }
    local slots=()
    if [ "$class" = gate ]; then
      # Gates: first come first served among gates, any free slot, the reserved last one first.
      for t in $(live "$gq" "$ticket"); do ahead+=("${t#*-}"); done
      if [ "${#ahead[@]}" -eq 0 ]; then slots=("$HEAVY_SLOTS"); for n in $(seq 1 $((HEAVY_SLOTS - 1))); do slots+=("$n"); done; fi
    else
      # Experiments: never while a gate waits, never the reserved last slot, one at a time per session (the run name's
      # first part: engine, engineB, render, astra, infra, trunk), and sessions take turns: of the sessions that have
      # none running, the one served longest ago goes next, with its earliest run (decision RR21). A ticket of an older
      # copy of this file (empty) keeps first come first served among the tickets before it and takes no turn here
      # (it waits only for the tickets ahead of it, so a turn given to it could wait forever).
      gates_waiting=$(live "$gq" | wc -l)
      local me=${run%%-*} top=$((HEAVY_SLOTS > 1 ? HEAVY_SLOTS - 1 : 1)) busy=" " r w s seen=" " next="" next_t="" next_age="" age waiting=""
      for n in $(seq 1 "$HEAVY_SLOTS"); do
        heavy__held "$HEAVY_DIR/heavy.$n.lock" || continue
        IFS=$'\t' read -r r _ w < "$HEAVY_DIR/heavy.$n.info" 2> /dev/null || continue
        case "$w" in "[gate]"*) ;; *) busy="$busy${r%%-*} " ;; esac
      done
      for t in $(live "$eq"); do
        r=${t#*-}; s=${r%%-*}; waiting="$waiting $s"
        [ "$eq/$t" != "$ticket" ] && ahead+=("$r")
        [ -s "$eq/$t" ] || continue                              # an older copy's ticket: no turn
        case "$busy" in *" $s "*) continue ;; esac              # that session has an experiment running
        case "$seen" in *" $s "*) continue ;; esac; seen="$seen$s "   # each session's earliest ticket only
        age=$(stat -c %Y "$HEAVY_DIR/served/$s" 2> /dev/null || echo 0)
        if [ -z "$next_t" ] || [ "$age" -lt "$next_age" ]; then next=$s; next_t=$t; next_age=$age; fi
      done
      if [ "$gates_waiting" -eq 0 ] && [ "$eq/$next_t" = "$ticket" ]; then for n in $(seq 1 "$top"); do slots+=("$n"); done; fi
    fi
    for n in "${slots[@]}"; do
      exec 5> "$HEAVY_DIR/heavy.$n.lock"
      if flock -n 5; then
        printf '%s\t%s\t%s\n' "$run" "$now" "[$class] $what" > "$HEAVY_DIR/heavy.$n.info"
        [ "$class" = experiment ] && mkdir -p "$HEAVY_DIR/served" && touch "$HEAVY_DIR/served/${run%%-*}"
        echo "== heavy slot $n/$HEAVY_SLOTS ($class line)"
        exec 6>&-; rm -f "$ticket"
        return 0
      fi
      exec 5>&-
    done
    place=$(( ${#ahead[@]} + 1 ))
    state="$place|$gates_waiting|${next:-}|$(heavy__running --names | tr '\n' ' ')|${ahead[*]:-}"
    if [ "$state" != "$last" ] || [ $((now - last_at)) -ge 600 ]; then
      if [ "$class" = gate ]; then echo "== waiting for a heavy slot (gate line, every slot busy): number $place among gates"
      else
        echo "== waiting for a heavy slot (experiment line: slots 1-$((HEAVY_SLOTS > 1 ? HEAVY_SLOTS - 1 : 1)), slot $HEAVY_SLOTS kept for gates$([ "$gates_waiting" -gt 0 ] && echo ", $gates_waiting gate(s) go first")): number $place by arrival"
        local mine="" counts
        [[ "$busy" == *" $me "* ]] && mine=" ($me already has one running: one at a time)"
        counts=$(printf '%s\n' $waiting | sort | uniq -c | awk '{printf "%s %s, ", $2, $1}' | sed 's/, $//')
        echo "   turns by session — waiting: $counts; running:${busy% }; next: ${next:-none}$mine"
      fi
      heavy__running | sed 's/^/   running /'
      [ "${#ahead[@]}" -gt 0 ] && echo "   ahead in line: ${ahead[*]}"
      last=$state; last_at=$now
    fi
    sleep "$HEAVY_POLL_S"
  done
}
