#!/usr/bin/env bash
# Build a single-file executable of the Earth Monitor app (macOS).
# Result: dist/EarthMonitor — send this one file to another macOS user.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt pyinstaller

rm -rf build dist EarthMonitor.spec

pyinstaller \
  --onefile \
  --windowed \
  --name EarthMonitor \
  --add-data "static:static" \
  --collect-all uvicorn \
  --collect-all webview \
  --hidden-import uvicorn.logging \
  --hidden-import uvicorn.loops \
  --hidden-import uvicorn.loops.auto \
  --hidden-import uvicorn.protocols \
  --hidden-import uvicorn.protocols.http \
  --hidden-import uvicorn.protocols.http.auto \
  --hidden-import uvicorn.protocols.websockets \
  --hidden-import uvicorn.protocols.websockets.auto \
  --hidden-import uvicorn.lifespan \
  --hidden-import uvicorn.lifespan.on \
  app.py

echo
echo "Done. Artifact:"
ls -lh dist/
