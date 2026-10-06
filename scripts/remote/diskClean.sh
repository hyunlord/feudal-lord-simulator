# DGX disk upkeep for ~/fls-runs (sourced by remote-exec.sh; bash, Linux). Decision RR15.
#   clean_disk <why> [tight]     prints one "== disk:" line per action and the free space before and after
# Why (2026-10-05): the disk filled (94 %, 229 GB free) and heavy runs queued again. 161 of 169 run folders were marked
# --keep, so the count prune (10 newest) could delete none; each folder held ~4.5 GB (its own copy of the tree, output/,
# and a per-folder .git/lfs of 1.6 GB).
# Rules (a folder is never touched while its run holds its lock, while a process works in it, or when it is one of the
# 3 newest — the upload's copy source):
#   1. finished run folders older than DC_RUN_HOURS (24) go; a --keep run first has its results in _kept/<run>/
#      (copied now if missing). The results the Mac fetches stay: --fetch reads _kept/ when the folder is gone.
#   2. capacity: while the finished run folders together pass DC_RUNS_CAP_GB (250), the oldest go first.
#   3. _kept/<run>/ that no file of the trunk names (searched in the mirror) and older than DC_KEPT_DAYS (3) is packed
#      into _kept/_archive/<run>.tar.zst and removed; a run a report names stays as it is.
#   4. _clones/<run>/ left by a clean clone that is not going (lock free) goes.
#   5. the game's leftovers in $DC_TMP (/tmp, added 2026-10-06 when they held 24 GB): a source tree of a commit
#      (fls-src-<sha>-<pid>, scripts/perf/sourceTree.ts for perf:ab and the trend) goes once its process is gone and no
#      process works in it; tsx's compile cache (tsx-<uid>) loses the files nobody read for DC_TSX_DAYS (3) days (tsx
#      compiles a missing one again). /tmp is shared, so nothing else there is touched.
# tight (free space under DC_LOW_GB, 300, before a heavy run): rule 1 takes every finished folder (age 0) and rule 2
# halves the cap.
# A folder with a part this user may not write (a directory without write permission — a run's read-only copy of its
# input states — or another user's file) is left whole, by every rule: rm -rf would delete what it can and leave a
# broken folder (2026-10-06: astra-phase2-final-geometry-fd68f12 kept its 0555 state copies, lost its .remote/exit-code
# and could never age again; its "허가 거부" lines landed in the log of the render run that cleaned). Such a folder gets
# one line in the clean's own log DC_LOG (_logs/disk-clean.log), once, and nothing in the run's log. DC_FIX_READONLY=1:
# when every part is this user's, write permission is restored (u+w) first and the folder goes as usual.
DC_RUN_HOURS=${DC_RUN_HOURS:-24}
DC_RUNS_CAP_GB=${DC_RUNS_CAP_GB:-250}
DC_KEPT_DAYS=${DC_KEPT_DAYS:-3}
DC_LOW_GB=${DC_LOW_GB:-300}
DC_TRUNK=${DC_TRUNK:-codex/phase15-organic-ground}
DC_LOG=${DC_LOG:-$BASE/_logs/disk-clean.log}
DC_TMP=${DC_TMP:-/tmp}
DC_TSX_DAYS=${DC_TSX_DAYS:-3}

dc__free_gb() { if [ -n "${DC_FREE_GB:-}" ]; then echo "$DC_FREE_GB"; else df --output=avail -BG "$BASE" | tail -1 | tr -dc 0-9; fi; }
dc__locked() { [ -e "$BASE/_locks/$1.lock" ] && ! ( flock -n 9 ) 9< "$BASE/_locks/$1.lock"; }
# Run folders a process of ours works in (its working directory or an argument under the folder).
dc__in_use() {
  local pid cwd
  for pid in $(pgrep -u "$(id -u)" . 2> /dev/null); do
    cwd=$(readlink "/proc/$pid/cwd" 2> /dev/null) || continue
    case "$cwd" in "$BASE"/_clones/*) cwd=${cwd#"$BASE"/_clones/} ;; "$BASE"/*) cwd=${cwd#"$BASE"/} ;; *) cwd="" ;; esac
    [ -n "$cwd" ] && echo "${cwd%%/*}"
    tr '\0' '\n' < "/proc/$pid/cmdline" 2> /dev/null | grep -oE "$BASE/[^/ ]+" | sed "s#^$BASE/##"
  done | sort -u
}
dc__mb() { du -sm "$1" 2> /dev/null | cut -f1; }
# 0 when the whole folder can go; else one line in DC_LOG (once per folder) and 1 (see the header).
dc__removable() { # <dir> <label>
  local dir=$1 label=$2 uid part mark
  uid=$(id -u)
  if [ "${DC_FIX_READONLY:-0}" = 1 ] && [ -z "$(find "$dir" ! -user "$uid" -print -quit 2> /dev/null)" ]; then chmod -R u+w "$dir" 2> /dev/null; fi
  part=$(find "$dir" \( \( -type d ! -writable \) -o ! -user "$uid" \) -print -quit 2> /dev/null)
  [ -z "$part" ] && return 0
  mark=$BASE/_logs/disk-clean.left/$(printf '%s' "$label" | tr '/' '_')
  if [ ! -e "$mark" ]; then
    mkdir -p "${mark%/*}" 2> /dev/null && : > "$mark"
    printf '%s left %s whole: %s is not writable by %s (a read-only copy, or a file of another user; DC_FIX_READONLY=1 restores u+w when all of it is ours)\n' \
      "$(date '+%F %T')" "$label" "${part#"$dir"/}" "$(id -un)" >> "$DC_LOG" 2> /dev/null
  fi
  return 1
}
# The folder went: forget that it was left once.
dc__gone() { rm -f "$BASE/_logs/disk-clean.left/$(printf '%s' "$1" | tr '/' '_')" 2> /dev/null; }
# Hours since the run finished (its .remote/exit-code); -1 while it has not.
dc__age_h() { [ -f "$1/.remote/exit-code" ] || { echo -1; return; }; echo $(( ($(date +%s) - $(stat -c %Y "$1/.remote/exit-code")) / 3600 )); }
dc__ensure_kept() {
  local name=$1 dir=$BASE/$1 dest=$BASE/_kept/$1
  [ -f "$dir/.remote/keep" ] || return 0
  [ -d "$dest/.remote" ] && return 0
  mkdir -p "$dest/.remote" && rsync -a "$dir/.remote/" "$dest/.remote/" || return 1
  [ -s "$dir/.remote/changed-files.txt" ] && (cd "$dir" && rsync -a --files-from=.remote/changed-files.txt ./ "$dest/")
  echo "== disk: kept results of $name copied to _kept/ before its folder goes"
}
dc__remove_run() { # <name> <why>
  local name=$1 mb
  dc__removable "$BASE/$name" "$name" || return 1
  dc__ensure_kept "$name" || { echo "== disk: left $name (its results could not be copied to _kept/)"; return 1; }
  mb=$(dc__mb "$BASE/$name")
  ( flock -n 9 || exit 1; rm -rf "$BASE/${name:?}" 2>> "$DC_LOG" ) 9> "$BASE/_locks/$name.lock" || return 1
  dc__gone "$name"
  git -C "$BASE/_cache/repo.git" update-ref -d "refs/remote-runs/$name" 2> /dev/null
  rm -f "$BASE/_locks/$name.lock"
  echo "== disk: removed run folder $name (${mb:-?} MB, $2)"
}

# One clean at a time (two runs finishing together would pack the same _kept/ folder): a second one skips.
clean_disk() {
  ( flock -n 8 || { echo "== disk: another clean is going; skipped ($1)"; exit 0; }; dc__clean "$@" ) 8> "$BASE/_locks/disk-clean.lock"
}

dc__clean() {
  local why=$1 mode=${2:-normal} hours=$DC_RUN_HOURS cap=$DC_RUNS_CAP_GB before after name dir age total
  before=$(dc__free_gb)
  [ "$mode" = tight ] && { hours=0; cap=$((DC_RUNS_CAP_GB / 2)); }
  echo "== disk: ${before} GB free ($why${mode:+, $mode})"
  local inuse newest
  inuse=$(dc__in_use)
  newest=$(ls -1dt "$BASE"/*/ 2> /dev/null | sed "s#^$BASE/##; s#/\$##" | grep -v '^_' | head -3)
  dc__skip() { [ "$1" = "${RUN:-}" ] || dc__locked "$1" || printf '%s\n' "$inuse" | grep -qx "$1" || printf '%s\n' "$newest" | grep -qx "$1"; }
  # 4. clones left behind
  for dir in "$BASE"/_clones/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    dc__locked "$name" || printf '%s\n' "$inuse" | grep -qx "$name" && continue
    dc__removable "$dir" "_clones/$name" || continue
    rm -rf "${dir:?}" 2>> "$DC_LOG" && dc__gone "_clones/$name" && echo "== disk: removed _clones/$name (no clean clone is going there)"
  done
  # 1. age
  for dir in $(ls -1dtr "$BASE"/*/ 2> /dev/null); do
    name=$(basename "$dir"); case "$name" in _*) continue ;; esac
    dc__skip "$name" && continue
    age=$(dc__age_h "$BASE/$name"); [ "$age" -ge 0 ] && [ "$age" -ge "$hours" ] || continue
    dc__remove_run "$name" "finished ${age} h ago"
  done
  # 2. capacity, oldest first (summed only when space is short: du over every folder takes a while)
  total=0
  if [ "$mode" = tight ] || [ "$(dc__free_gb)" -lt $((DC_LOW_GB * 2)) ]; then
  for dir in $(ls -1dt "$BASE"/*/ 2> /dev/null); do
    name=$(basename "$dir"); case "$name" in _*) continue ;; esac
    [ "$(dc__age_h "$BASE/$name")" -ge 0 ] && total=$((total + $(dc__mb "$BASE/$name")))
  done
  for dir in $(ls -1dtr "$BASE"/*/ 2> /dev/null); do
    [ $((total / 1024)) -gt "$cap" ] || break
    name=$(basename "$dir"); case "$name" in _*) continue ;; esac
    dc__skip "$name" && continue
    [ "$(dc__age_h "$BASE/$name")" -ge 0 ] || continue
    local mb; mb=$(dc__mb "$BASE/$name")
    dc__remove_run "$name" "finished folders over ${cap} GB" && total=$((total - mb))
  done
  fi
  # 3. kept results nobody names
  dc__archive_kept
  # 5. the game's leftovers in /tmp
  dc__clean_tmp
  after=$(dc__free_gb)
  echo "== disk: ${after} GB free after cleaning ($why)"
}

dc__archive_kept() {
  local mirror=$BASE/_cache/repo.git dir name names named
  [ -d "$BASE/_kept" ] || return 0
  names=$(find "$BASE/_kept" -mindepth 1 -maxdepth 1 -type d ! -name '_*' -mtime +"$DC_KEPT_DAYS" -printf '%f\n' 2> /dev/null)
  [ -n "$names" ] || return 0
  [ -d "$mirror" ] || { echo "== disk: no mirror to look up reports in; _kept/ left as it is"; return 0; }
  ( flock 7; git -C "$mirror" fetch -q origin 2> /dev/null ) 7> "$BASE/_locks/repo-mirror.lock"
  git -C "$mirror" rev-parse -q --verify "refs/heads/$DC_TRUNK" > /dev/null || { echo "== disk: the mirror has no $DC_TRUNK; _kept/ left as it is"; return 0; }
  named=$(printf '%s\n' "$names" | git -C "$mirror" grep -h -o -F -f - "refs/heads/$DC_TRUNK" 2> /dev/null | sort -u)
  mkdir -p "$BASE/_kept/_archive"
  for name in $names; do
    printf '%s\n' "$named" | grep -qx "$name" && continue
    dir=$BASE/_kept/$name
    dc__removable "$dir" "_kept/$name" || continue
    if tar -C "$BASE/_kept" --zstd -cf "$BASE/_kept/_archive/$name.tar.zst.tmp" "$name" 2> /dev/null; then
      mv "$BASE/_kept/_archive/$name.tar.zst.tmp" "$BASE/_kept/_archive/$name.tar.zst" && rm -rf "${dir:?}" 2>> "$DC_LOG" && dc__gone "_kept/$name"
      echo "== disk: packed _kept/$name into _kept/_archive/$name.tar.zst (no report names it)"
    else
      rm -f "$BASE/_kept/_archive/$name.tar.zst.tmp"
    fi
  done
}

# A process works in the folder: its working directory or an argument is under it.
dc__tmp_busy() {
  local pid cwd
  for pid in $(pgrep -u "$(id -u)" . 2> /dev/null); do
    cwd=$(readlink "/proc/$pid/cwd" 2> /dev/null) || continue
    case "$cwd/" in "$1"/*) return 0 ;; esac
    tr '\0' '\n' < "/proc/$pid/cmdline" 2> /dev/null | grep -qF "$1/" && return 0
  done
  return 1
}
dc__clean_tmp() {
  local dir pid mb tsx files
  for dir in "$DC_TMP"/fls-src-*-*/; do
    [ -d "$dir" ] || continue
    dir=${dir%/}; pid=${dir##*-}
    case "$pid" in ''|*[!0-9]*) continue ;; esac
    [ -e "/proc/$pid" ] && continue          # its trend or perf:ab is still going
    dc__tmp_busy "$dir" && continue
    dc__removable "$dir" "tmp/${dir##*/}" || continue
    mb=$(dc__mb "$dir")
    rm -rf "${dir:?}" 2>> "$DC_LOG" && dc__gone "tmp/${dir##*/}" && echo "== disk: removed $dir (${mb:-?} MB, its process $pid is gone)"
  done
  tsx=$DC_TMP/tsx-$(id -u)
  [ -d "$tsx" ] || return 0
  # -atime +N: not read for more than N whole days (relatime moves atime at most once a day, so a file read in the last
  # N days is never taken; sizes are the blocks freed, %k). Only regular files: the folder and the live .pipe sockets stay.
  files=$(find "$tsx" -mindepth 1 -maxdepth 1 -type f -atime +"$DC_TSX_DAYS" -printf '%k\n' -delete 2> /dev/null | awk '{ n++; s += $1 } END { printf "%d %d", n, s / 1024 }')
  [ "${files%% *}" -gt 0 ] && echo "== disk: tsx cache: removed ${files%% *} file(s) not read for ${DC_TSX_DAYS} days (${files##* } MB)"
  return 0
}
