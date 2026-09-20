#!/usr/bin/env bash
set -euo pipefail

VENV="${DEMO_VENV:-$HOME/.cache/crypto-tools/kokoro-venv}"

command -v uv > /dev/null || { echo "uv is missing: brew install uv"; exit 1; }
command -v ffmpeg > /dev/null || { echo "ffmpeg is missing: brew install ffmpeg"; exit 1; }

if [ ! -d /opt/homebrew/share/espeak-ng-data ]; then
   echo "espeak-ng is missing: brew install espeak-ng"
   exit 1
fi

uv venv --python 3.12 "$VENV"
uv pip install --python "$VENV/bin/python" kokoro soundfile
VIRTUAL_ENV="$VENV" "$VENV/bin/python" -m spacy download en_core_web_sm

echo
echo "Kokoro is ready in $VENV"
echo "The model itself (~330 MB) downloads on the first render and is cached in ~/.cache/huggingface."
