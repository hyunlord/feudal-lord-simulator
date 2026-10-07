#!/usr/bin/env bash
# The DGX slot keeper (decision RR23, user order 2026-10-07): the one place that decides which waiting run takes a heavy
# slot, so the rules hold whatever copy of heavySlots.sh a run brought from its session's checkout — a waiting gate goes
# first and the last slot is the gates' (RR20), one experiment at a time per session and sessions in turn (RR21).
# Why: on 2026-10-07 three experiments of engine B from a checkout before RR20 (heavySlots.sh 7c81bc43) held all three
# slots and four engine gate runs waited. That copy knows neither the gate line nor sessions: it takes any free slot up
# to the cap once no ticket is ahead of it in _slots/queue/.
#
# How. Every copy of heavySlots.sh waits on a ticket in _slots/queue/ (experiments) or _slots/queue-gate/ (gates) and
# takes no slot while a live ticket it respects is ahead of it. The keeper holds a fence ticket (<ns>-_slotkeeper,
# locked, cap 99) at the front of both lines, so no copy takes a slot by itself. To admit the run the rules pick, it
# opens a door for that run only:
#   keeper  a copy that speaks this protocol (its heavySlots.sh says "slot keeper protocol 1"): a grant file
#           _slots/grant/<run> holding the slot;
#   gate    a gate of the RR20/RR21 copies: the gate fence moves to just behind it, so it is first among gates;
#   fifo    an experiment of a copy before RR20 (first come first served, the lowest free slot): it must be first in the
#           experiment line; the experiment fence moves to just behind it;
#   lines   an experiment of the RR20 copy: the same, and the gate fence is lifted (no gate waits then);
#   turns   an experiment of the RR21 copy: the gate fence is lifted, its session's served time is set to 0 and the
#           fence's own to the far future, so the RR21 turn rule picks exactly it (every other session is 1 or more).
# The door closes when the run has taken its slot (its ticket is gone) or after KEEPER_DOOR_S; the fences go back to the
# front. One door at a time. The keeper never stops or moves a run that holds a slot.
# The rules: a waiting gate goes first, first come first served, on any free slot (the last one first); experiments only
# while no gate waits, on slots 1..cap-1, at most one running per session (the run name's first part: engine, engineB,
# render, astra, infra, trunk), and of the sessions with none running the one served longest ago
# (_slots/served/<session>, never served counts as oldest) with its earliest run. A fifo or lines copy can be let in only
# when it is first in the experiment line; until then its session's turn passes to the next session.
# Every loop it writes _slots/keeper.status (slots, both lines, the turn order, why a session waits, the open door);
# run.sh --status and the waiting runs of this protocol print it.
# What it cannot explain it writes as "ANOMALY:" lines to its log and to _slots/keeper-anomalies.log (user order
# 2026-10-07: tell at once when a slot is free and nobody can go), each once: a door its run did not take in time; a run
# in a slot the keeper did not let in (a copy that ignored the fences); and a free slot with runs that may go waiting —
# a gate, or an experiment of a session with none running — while nobody is let in for KEEPER_STALL_S.
# If the keeper is down its locks are free: the fences go stale, the clients remove them within a minute and every copy
# falls back to its own rules. It runs as the user unit fls-slot-keeper (scripts/remote/systemd/), which loads the
# trunk's copy from the mirror; every KEEPER_UPDATE_S it looks at the trunk again and, when the copy changed, executes the
# new one in place, keeping its locks (an exec keeps the open files and their flocks).
set -uo pipefail
export LC_ALL=C
BASE=${FLS_KEEPER_BASE:-$HOME/fls-runs}
D=$BASE/_slots
GQ=$D/queue-gate
EQ=$D/queue
TRUNK=${FLS_TRUNK:-codex/phase15-organic-ground}
POLL=${KEEPER_POLL_S:-2}
DOOR_S=${KEEPER_DOOR_S:-45}
UPDATE_S=${KEEPER_UPDATE_S:-300}
STALL_S=${KEEPER_STALL_S:-600}
FENCE=_slotkeeper
FRONT=0000000000000000000
mkdir -p "$GQ" "$EQ" "$D/served" "$D/grant"

log() { echo "$(date '+%F %T') $*"; }
declare -A REPORTED=()
anomaly() { # <key> <text>: once per key
  [ -n "${REPORTED[$1]:-}" ] && return 0
  REPORTED[$1]=1
  log "ANOMALY: $2"
  echo "$(date '+%F %T') $2" >> "$D/keeper-anomalies.log"
}
held() { [ -e "$1" ] && ! ( flock -n 7 ) 7< "$1"; }

if [ "${KEEPER_DRY:-0}" = 1 ]; then :   # KEEPER_DRY=1: decide once from the live state, print it, touch nothing
elif [ -n "${KEEPER_LOCK_FD:-}" ] && [ -e "/proc/$$/fd/$KEEPER_LOCK_FD" ]; then klock=$KEEPER_LOCK_FD
else
  exec {klock}> "$D/keeper.lock"
  flock -n "$klock" || { log "slot keeper: another keeper holds $D/keeper.lock"; exit 0; }
fi

# --- fences -------------------------------------------------------------------------------------------------------
# A fence is written and locked under a temporary name and only then renamed into the line: a client removes an
# unlocked ticket that is over a minute old, and the front fence's name says 1970.
declare -A FFD=() FPATH=()
for f in ${KEEPER_FENCES:-}; do   # g:<fd>:<path> e:<fd>:<path>, from the copy that executed this one
  IFS=: read -r line fd path <<< "$f"
  [ -n "$fd" ] && [ -n "$path" ] && [ -e "/proc/$$/fd/$fd" ] && [ -e "$path" ] && { FFD[$line]=$fd; FPATH[$line]=$path; }
done
fence_set() { # <g|e> <ns>: the line's fence stands at <ns> (moved: the new one is in place before the old one goes)
  local line=$1 ns=$2 dir tmp fd old_fd old_path
  if [ "$line" = g ]; then dir=$GQ; else dir=$EQ; fi
  [ "${FPATH[$line]:-}" = "$dir/$ns-$FENCE" ] && [ -e "$dir/$ns-$FENCE" ] && return 0
  tmp="$D/.fence-$line-$$"
  printf '99\n' > "$tmp"
  exec {fd}< "$tmp"
  flock -n "$fd" || { exec {fd}<&-; rm -f "$tmp"; return 1; }
  mv -f "$tmp" "$dir/$ns-$FENCE"
  old_fd=${FFD[$line]:-}; old_path=${FPATH[$line]:-}
  FFD[$line]=$fd; FPATH[$line]=$dir/$ns-$FENCE
  if [ -n "$old_path" ] && [ "$old_path" != "$dir/$ns-$FENCE" ]; then rm -f "$old_path"; fi
  if [ -n "$old_fd" ]; then exec {old_fd}<&-; fi
  return 0
}
fence_lift() { # <g|e>
  local line=$1 fd=${FFD[$1]:-}
  [ -n "${FPATH[$line]:-}" ] && rm -f "${FPATH[$line]}"
  if [ -n "$fd" ]; then exec {fd}<&-; fi
  FFD[$line]=""; FPATH[$line]=""
}
fences_front() { fence_set g "$FRONT"; fence_set e "$FRONT"; rm -f "$D/served/$FENCE"; }
trap 'fence_lift g; fence_lift e; rm -f "$D/served/$FENCE"; log "slot keeper stopped: the fences are lifted, every copy follows its own rules"; exit 0' TERM INT

# --- what waits, what runs ----------------------------------------------------------------------------------------
live() { # <dir>: its live tickets, oldest first, fences left out (a stale ticket is removed, as the clients do)
  local dir=$1 t born now; now=$(date +%s)
  for t in $(ls -1 "$dir" 2> /dev/null | sort); do
    case "$t" in *-"$FENCE") continue ;; [0-9]*-?*) ;; *) continue ;; esac
    born=$(( 10#${t%%-*} / 1000000000 ))
    if held "$dir/$t" || [ $((now - born)) -lt 60 ]; then echo "$t"; else rm -f "$dir/$t"; fi
  done
}
declare -A TYPE=()
ctype() { # <ticket>: CT = the protocol of the heavySlots.sh copy in that run's folder (the copy it sources)
  local t=$1 run=${1#*-} f
  if [ -n "${TYPE[$t]:-}" ]; then CT=${TYPE[$t]}; return; fi
  f=$BASE/$run/scripts/remote/heavySlots.sh
  if [ ! -f "$f" ]; then CT=fifo
  elif grep -q 'slot keeper protocol 1' "$f"; then CT=keeper
  elif grep -q 'HEAVY_DIR/served' "$f"; then CT=turns
  elif grep -q 'queue-gate' "$f"; then CT=lines
  else CT=fifo; fi
  TYPE[$t]=$CT
}
declare -A INSLOT=()
read_slots() { # CAP TOP FREE[] BUSY (" session … ") INSLOT[run]=n SLOTS_TXT
  local c n r w
  CAP=${KEEPER_SLOTS:-3}
  read -r c 2> /dev/null < "$D/max" && [[ $c =~ ^[1-9][0-9]?$ ]] && CAP=$c
  TOP=$(( CAP > 1 ? CAP - 1 : 1 )); FREE=(); BUSY=" "; INSLOT=(); SLOTS_TXT=""
  for n in $(seq 1 "$CAP"); do
    if held "$D/heavy.$n.lock"; then
      IFS=$'\t' read -r r _ w < "$D/heavy.$n.info" 2> /dev/null || { r="?"; w=""; }
      INSLOT[$r]=$n
      case "$w" in
        "[gate]"*) SLOTS_TXT+="  slot $n: $r (gate)"$'\n' ;;
        *) BUSY+="${r%%-*} "; SLOTS_TXT+="  slot $n: $r (experiment of ${r%%-*})"$'\n' ;;
      esac
    else FREE+=("$n"); SLOTS_TXT+="  slot $n: free"$'\n'; fi
  done
}
served_at() { stat -c %Y "$D/served/$1" 2> /dev/null || echo 0; }

# --- the rules ----------------------------------------------------------------------------------------------------
decide() { # PICK (ticket) PICK_LINE PICK_SLOT, and WHY/ORDER for the status
  local t run s age i=0 seen=" " head best="" best_age="" n
  PICK=""; WHY=""; ORDER=""; MAYGO=""
  mapfile -t GATES < <(live "$GQ")
  mapfile -t EXPS < <(live "$EQ")
  for t in "${EXPS[@]}"; do   # never served counts as oldest: 1 (0 is the door's)
    s=${t#*-}; s=${s%%-*}
    [ -e "$D/served/$s" ] || touch -d @1 "$D/served/$s"
  done
  head=${EXPS[0]:-}
  for t in "${EXPS[@]}"; do
    run=${t#*-}; s=${run%%-*}; i=$((i + 1))
    case "$seen" in *" $s "*) continue ;; esac
    seen+="$s "
    case "$BUSY" in *" $s "*) ORDER+="  $s waits: $run — $s has an experiment running (one at a time)"$'\n'; continue ;; esac
    MAYGO+="$run "
    ctype "$t"
    if { [ "$CT" = fifo ] || [ "$CT" = lines ]; } && [ "$t" != "$head" ]; then
      ORDER+="  $s waits: $run — an older copy of heavySlots.sh ($CT), let in only when first in line"$'\n'; continue
    fi
    age=$(served_at "$s")
    ORDER+="  $s (served $( [ "$age" -le 1 ] && echo never || date -d "@$age" '+%m-%d %H:%M')): $run ($CT copy)"$'\n'
    if [ -z "$best" ] || [ "$age" -lt "$best_age" ]; then best=$t; best_age=$age; fi
  done
  if [ "${#GATES[@]}" -gt 0 ]; then
    if [ "${#FREE[@]}" -eq 0 ]; then WHY="every slot is busy; the first gate goes at the next free one"; return; fi
    PICK=${GATES[0]}; PICK_LINE=g; PICK_SLOT=${FREE[0]}
    for n in "${FREE[@]}"; do [ "$n" = "$CAP" ] && PICK_SLOT=$n; done
    return
  fi
  [ "${#EXPS[@]}" -gt 0 ] || return
  [ -n "$best" ] || { WHY="no session may start an experiment now"; return; }
  if [ "${#FREE[@]}" -eq 0 ] || [ "${FREE[0]}" -gt "$TOP" ]; then
    WHY="slots 1-$TOP are busy (slot $CAP is the gates')"; return
  fi
  PICK=$best; PICK_LINE=e; PICK_SLOT=${FREE[0]}
}

# --- the door -----------------------------------------------------------------------------------------------------
DOOR=""
open_door() {
  local run=${PICK#*-} ns=${PICK%%-*} s
  s=${run%%-*}
  ctype "$PICK"
  DOOR=$PICK; DOOR_LINE=$PICK_LINE; DOOR_TYPE=$CT; DOOR_SLOT=$PICK_SLOT; DOOR_UNTIL=$(( $(date +%s) + DOOR_S )); DOOR_SAVED=""
  case "$PICK_LINE:$CT" in
    *:keeper) echo "$PICK_SLOT" > "$D/grant/$run" ;;
    g:*) fence_set g "$(( 10#$ns + 1 ))" ;;
    e:fifo) fence_set e "$(( 10#$ns + 1 ))" ;;
    e:lines) fence_set e "$(( 10#$ns + 1 ))"; fence_lift g ;;
    e:turns)
      DOOR_SAVED=$(served_at "$s")
      touch -d "@$(( $(date +%s) + 3650 * 86400 ))" "$D/served/$FENCE"
      touch -d @0 "$D/served/$s"
      fence_lift g ;;
  esac
  log "door: $run ($([ "$PICK_LINE" = g ] && echo gate || echo experiment), $CT copy) → slot $PICK_SLOT"
}
door_check() { # closes the door once its run took a slot, left, or the time is up
  local run=${DOOR#*-} dir s now; now=$(date +%s)
  s=${run%%-*}
  if [ "$DOOR_LINE" = g ]; then dir=$GQ; else dir=$EQ; fi
  if [ -e "$dir/$DOOR" ] && [ "$now" -lt "$DOOR_UNTIL" ]; then return; fi
  read_slots     # the run may have taken its slot since this loop read them
  fences_front
  rm -f "$D/grant/$run"
  if [ -n "${INSLOT[$run]:-}" ]; then
    [ "$DOOR_LINE" = e ] && touch "$D/served/$s"
    log "door closed: $run took slot ${INSLOT[$run]}"
    LET_IN=$run
  else
    if [ "$DOOR_TYPE" = turns ] && [ "$(served_at "$s")" = 0 ]; then touch -d "@${DOOR_SAVED:-1}" "$D/served/$s"; fi
    if [ -e "$dir/$DOOR" ]; then
      log "door closed: $run did not take slot $DOOR_SLOT in ${DOOR_S}s"
      anomaly "door:$DOOR" "the door for $run ($DOOR_TYPE copy) → slot $DOOR_SLOT was open ${DOOR_S}s and it did not take the slot (it keeps waiting; the keeper tries again)"
    else log "door closed: $run left the line"; fi
  fi
  DOOR=""
}

# A run in a slot that the keeper did not let in (the slots seen last loop, the open door's run and the last one let in
# are known). Only when it is still there one loop later: a free slot looks held for an instant whenever another
# process tests its lock at the same moment (every waiting copy tests the slot locks), and then the name in the slot's
# info is its last run's (2026-10-07 20:25, astra-WET-geometry-b65ca77, ten minutes after it had ended).
declare -A SEEN_IN=() ODD_IN=()
SEEN_FIRST=1; LET_IN=""; STALL_SINCE=""
watch_slots() {
  local r
  declare -A odd=()
  if [ -z "$SEEN_FIRST" ]; then
    for r in "${!INSLOT[@]}"; do
      [ -n "${SEEN_IN[$r]:-}" ] || [ "$r" = "$LET_IN" ] || [ "$r" = "${DOOR#*-}" ] && continue
      odd[$r]=1
      [ -n "${ODD_IN[$r]:-}" ] && anomaly "in:$r:${INSLOT[$r]}" "$r is in slot ${INSLOT[$r]} but the keeper did not let it in (a copy of heavySlots.sh that ignored the fences, or a slot taken by hand)"
    done
  fi
  SEEN_FIRST=""; SEEN_IN=(); ODD_IN=()
  for r in "${!INSLOT[@]}"; do [ -n "${odd[$r]:-}" ] || SEEN_IN[$r]=1; done
  for r in "${!odd[@]}"; do ODD_IN[$r]=1; done
}
# A free slot, runs that may go, and nobody let in (checked after decide, while no door is open).
watch_stall() {
  local now; now=$(date +%s)
  if [ -z "$PICK" ] && [ "${#FREE[@]}" -gt 0 ] && { [ "${#GATES[@]}" -gt 0 ] || { [ -n "$MAYGO" ] && [ "${FREE[0]}" -le "$TOP" ]; }; }; then
    [ -n "$STALL_SINCE" ] || STALL_SINCE=$now
    if [ $((now - STALL_SINCE)) -ge "$STALL_S" ]; then
      anomaly "stall:$STALL_SINCE" "slot(s) ${FREE[*]} free for $(( (now - STALL_SINCE) / 60 )) min while ${GATES[*]:+gates ${GATES[*]#*-} and }${MAYGO:+experiments ${MAYGO}}wait, and nobody is let in: ${WHY:-no reason given}$(printf '%s' "$ORDER" | tr '\n' ';')"
    fi
  else STALL_SINCE=""; fi
}

write_status() {
  local t tmp=$D/.keeper.status.$$ c
  {
    echo "the DGX slot keeper (decision RR23), $(date '+%m-%d %H:%M:%S'): cap $CAP, slots 1-$TOP for experiments, slot $CAP kept for gates"
    printf '%s' "$SLOTS_TXT"
    if [ "${#GATES[@]}" -gt 0 ]; then
      echo "gate line (first come first served):"; c=0
      for t in "${GATES[@]}"; do c=$((c + 1)); ctype "$t"; echo "  $c. ${t#*-} ($CT copy)"; done
    else echo "gate line: empty"; fi
    if [ "${#EXPS[@]}" -gt 0 ]; then echo "experiment line by session (the earliest served goes next):"; printf '%s' "$ORDER"
    else echo "experiment line: empty"; fi
    if [ -n "$DOOR" ]; then echo "letting in: ${DOOR#*-} → slot $DOOR_SLOT"
    elif [ -n "$WHY" ]; then echo "nobody goes now: $WHY"; fi
    if [ -s "$D/keeper-anomalies.log" ]; then echo "last anomaly (_slots/keeper-anomalies.log): $(tail -1 "$D/keeper-anomalies.log")"; fi
  } > "$tmp" && mv -f "$tmp" "$D/keeper.status"
}

# --- update in place ----------------------------------------------------------------------------------------------
NEXT_UPDATE=$(( $(date +%s) + UPDATE_S ))
maybe_update() {
  [ "${KEEPER_UPDATE:-1}" = 1 ] && [ -z "$DOOR" ] && [ "$(date +%s)" -ge "$NEXT_UPDATE" ] || return 0
  NEXT_UPDATE=$(( $(date +%s) + UPDATE_S ))
  local m=$BASE/_cache/repo.git new=$0.new
  mkdir -p "$BASE/_locks"
  ( flock -w 30 7 && timeout 120 git -C "$m" fetch -q --prune origin ) 7> "$BASE/_locks/repo-mirror.lock" 2> /dev/null
  git -C "$m" show "refs/heads/$TRUNK:scripts/remote/slotKeeper.sh" > "$new" 2> /dev/null || { rm -f "$new"; return 0; }
  if cmp -s "$new" "$0" || ! bash -n "$new"; then rm -f "$new"; return 0; fi
  mv -f "$new" "$0"
  log "the trunk's slot keeper changed: executing it in place (the locks stay held)"
  export KEEPER_LOCK_FD=$klock KEEPER_FENCES="g:${FFD[g]:-}:${FPATH[g]:-} e:${FFD[e]:-}:${FPATH[e]:-}"
  exec bash "$0"
}

if [ "${KEEPER_DRY:-0}" = 1 ]; then
  served_at() { stat -c %Y "$D/served/$1" 2> /dev/null || echo 1; }; touch() { :; }
  read_slots; decide; write_status() { :; }
  echo "dry run: would let in ${PICK#*-}${PICK:+ → slot $PICK_SLOT}${WHY:+ (nobody: $WHY)}"; printf '%s' "$SLOTS_TXT"
  for t in "${GATES[@]}"; do ctype "$t"; echo "  gate: ${t#*-} ($CT copy)"; done; printf '%s' "$ORDER"; exit 0
fi
log "slot keeper running (pid $$, poll ${POLL}s, door ${DOOR_S}s, base $BASE)"
fences_front
while :; do
  read_slots
  watch_slots
  if [ -n "$DOOR" ]; then door_check; fi
  if [ -z "$DOOR" ]; then
    fences_front
    decide
    watch_stall
    [ -n "$PICK" ] && open_door
  else
    mapfile -t GATES < <(live "$GQ"); mapfile -t EXPS < <(live "$EQ")
  fi
  write_status
  maybe_update
  sleep "$POLL"
done
