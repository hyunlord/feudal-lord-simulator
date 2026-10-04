# Dev servers that always stop, for capture and audit scripts (sourced, bash):
#   . scripts/remote/devServers.sh
#   fls_serve <log> [--in <dir>] <vite args…>   starts node_modules/.bin/vite (in <dir>, default here) in the background;
#                                               FLS_SERVE_PID is the server, which leads its own process group
#   fls_on_exit '<command>'                     a cleanup to run at exit, after the servers have stopped
# On any exit of the script — success, a failure under set -e, Ctrl-C, or TERM/HUP when the run is stopped — the trap
# stops every server it started (TERM to the whole group, KILL after 5 s), then runs the registered cleanups.
# Why (2026-10-03): the NAT-4/NAT-5 capture scripts started Vite through a shell function ("serve … &"), so $! was the
# function's subshell; their trap killed only that and Vite stayed — 24 were left on the DGX. Here the subshell execs
# the server (setsid where there is one, so its children go with it) and $! is the server itself.
# The script must not set its own EXIT/INT/TERM/HUP traps after sourcing this; use fls_on_exit.
FLS_SERVE_PID=""
FLS_SERVE_PIDS=""
FLS_ON_EXIT=""

fls_serve() {
  local log=$1 dir=. session=""
  shift
  if [ "${1:-}" = --in ]; then dir=$2; shift 2; fi
  command -v setsid > /dev/null 2>&1 && session=setsid
  (cd "$dir" && exec $session node_modules/.bin/vite "$@") > "$log" 2>&1 &
  FLS_SERVE_PID=$!
  FLS_SERVE_PIDS="$FLS_SERVE_PIDS $FLS_SERVE_PID"
}

fls_on_exit() { FLS_ON_EXIT="$FLS_ON_EXIT$1
"; }

# A finished child stays a zombie until waited for; it counts as gone.
fls__alive() { kill -0 "$1" 2> /dev/null && [ "$(ps -o stat= -p "$1" 2> /dev/null | cut -c1)" != Z ]; }

fls_stop_servers() {
  local pid tries
  for pid in $FLS_SERVE_PIDS; do kill -TERM -- "-$pid" 2> /dev/null || kill -TERM "$pid" 2> /dev/null || true; done
  for pid in $FLS_SERVE_PIDS; do
    tries=0
    while fls__alive "$pid" && [ "$tries" -lt 10 ]; do sleep 0.5; tries=$((tries + 1)); done
    fls__alive "$pid" && { kill -KILL -- "-$pid" 2> /dev/null || kill -KILL "$pid" 2> /dev/null || true; }
  done
  FLS_SERVE_PIDS=""
}

fls__exit() {
  local rc=$?
  trap - EXIT
  set +e
  fls_stop_servers
  eval "$FLS_ON_EXIT"
  exit "$rc"
}
trap fls__exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
