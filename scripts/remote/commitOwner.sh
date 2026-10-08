#!/usr/bin/env bash
# Whose commit it is, for the trunk clone's "first bad" notice (user order 2026-10-09): every session commits as the same
# git user, so the author names nobody. The session shows in the subject's prefix and the message's last lines:
#   EB-…  engine B (Astra)          RB-…  render B (Astra)
#   "Co-Authored-By: Claude …": a Claude session (engine, render A or infra), named by the subject's task id
#   "Confidence:" / "Scope-risk:" / "Not-tested:" lines without that: an Astra session whose prefix names no side
# (1,979 trunk commits 2026-09-25..10-09: no commit had both kinds of lines, no EB-/RB- commit a Claude line.)
# A merge is judged by the tip of the branch it merged (its second parent). Prints one line; run in the repository.
#   scripts/remote/commitOwner.sh <commit>
set -uo pipefail
sha=${1:?commit}
merged=""
if git rev-parse -q --verify "$sha^2" > /dev/null; then merged=" (a merge, judged by its branch tip $(git rev-parse --short "$sha^2"))"; sha=$(git rev-parse "$sha^2"); fi
subject=$(git log -1 --format=%s "$sha"); body=$(git log -1 --format=%B "$sha")
task=$(printf '%s' "$subject" | grep -oE '^[A-Za-z][A-Za-z0-9]*(-[A-Za-z0-9.]*[A-Za-z0-9])+' | head -1)
case "$subject" in
  EB-*) echo "engine B (Astra), by its EB- prefix$merged" ;;
  RB-*) echo "render B (Astra), by its RB- prefix$merged" ;;
  *) if printf '%s\n' "$body" | grep -qiE '^Co-Authored-By: Claude'; then echo "a Claude session${task:+, task $task}$merged"
     elif printf '%s\n' "$body" | grep -qE '^(Confidence|Scope-risk|Not-tested): '; then
       echo "an Astra session (engine B or render B: no EB-/RB- prefix)${task:+, task $task}$merged"
     else echo "unknown (no EB-/RB- prefix, no Claude or Astra lines)${task:+, task $task}$merged"; fi ;;
esac
