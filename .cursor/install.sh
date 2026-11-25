#!/usr/bin/env bash
# Idempotent bootstrap for the Vril studios workspace.
# Static sites need no packages. Little Roots expects a venv at /workspace/kidsenv
# (see little-roots-studio/env.sh), the Titan One font, and the Rhubarb binary.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

if ! python3 -c 'import ensurepip' >/dev/null 2>&1 || ! /usr/sbin/ldconfig -p | grep -q 'libEGL.so.1'; then
  sudo apt-get update
  sudo apt-get install -y python3.12-venv libegl1
fi

sudo mkdir -p /workspace
sudo chown "$(id -u):$(id -g)" /workspace

if [ ! -x /workspace/kidsenv/bin/python ]; then
  python3 -m venv /workspace/kidsenv
fi

if [ -f /agent/repos/little-roots-studio/requirements.txt ]; then
  /workspace/kidsenv/bin/pip install --disable-pip-version-check --upgrade pip
  /workspace/kidsenv/bin/pip install --disable-pip-version-check -r /agent/repos/little-roots-studio/requirements.txt
fi

FONT_FILE="/usr/share/fonts/truetype/sand-box/google/Titan One/TitanOne-Regular.ttf"
if [ ! -s "$FONT_FILE" ]; then
  sudo mkdir -p "$(dirname "$FONT_FILE")"
  tmp="$(mktemp)"
  curl -fsSL -o "$tmp" "https://github.com/google/fonts/raw/main/ofl/titanone/TitanOne-Regular.ttf"
  sudo mv "$tmp" "$FONT_FILE"
  sudo chmod 644 "$FONT_FILE"
fi

if [ -f /agent/repos/little-roots-studio/tools/get_rhubarb.sh ] && [ ! -x /workspace/tools/rhubarb/rhubarb ]; then
  bash /agent/repos/little-roots-studio/tools/get_rhubarb.sh
fi
