#!/usr/bin/env bash
# Serve each static app. Safe to run again: an existing tmux session is left alone.
set -euo pipefail

serve() {
  local name="$1" dir="$2" port="$3"
  if [ ! -d "$dir" ]; then
    echo "skip ${name}: ${dir} is not checked out"
    return 0
  fi
  if tmux has-session -t "$name" 2>/dev/null; then
    echo "already up: ${name} on ${port}"
    READY_PORTS+=("$port")
    return 0
  fi
  tmux new-session -d -s "$name" "cd '$dir' && exec python3 -m http.server ${port} --bind 0.0.0.0"
  echo "started ${name} on ${port}"
  READY_PORTS+=("$port")
}

READY_PORTS=()
serve ccs /agent/repos/content-creation-studio 4173
serve lens /agent/repos/normies-lens 4174
serve snap /agent/repos/snap-count/www 4175

if [ -f /agent/repos/vrilsolutions00.github.io/site.zip ]; then
  io_root=/tmp/vril-github-io
  mkdir -p "$io_root"
  unzip -qo /agent/repos/vrilsolutions00.github.io/site.zip -d "$io_root"
  serve io "$io_root" 4176
fi

for port in "${READY_PORTS[@]}"; do
  ready=0
  for _ in $(seq 1 40); do
    if curl -sf -o /dev/null "http://127.0.0.1:${port}/"; then
      ready=1
      break
    fi
    sleep 0.25
  done
  if [ "$ready" != 1 ]; then
    echo "port ${port} did not respond" >&2
    exit 1
  fi
  echo "ready ${port}"
done
