#!/bin/sh
# Install only in this folder's virtual environment, then start the local app.
set -eu
TUTOR_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$TUTOR_DIR"

if [ ! -x .venv/bin/python ]; then
    if command -v python3 >/dev/null 2>&1; then
        TUTOR_BOOTSTRAP=python3
    elif command -v python >/dev/null 2>&1; then
        TUTOR_BOOTSTRAP=python
    else
        echo "Python 3.11 or newer is required. Install Python, then run this again."
        exit 1
    fi
    "$TUTOR_BOOTSTRAP" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else "Python 3.11 or newer is required.")'
    "$TUTOR_BOOTSTRAP" -m venv .venv
fi

TUTOR_PYTHON="$TUTOR_DIR/.venv/bin/python"
"$TUTOR_PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else "This .venv needs Python 3.11 or newer. Rename it and run the launcher again.")'
if [ ! -f .venv/.adaptive-tutor-installed ] || [ pyproject.toml -nt .venv/.adaptive-tutor-installed ] || [ requirements.txt -nt .venv/.adaptive-tutor-installed ]; then
    echo "Preparing this folder's Python environment (internet needed on first run)..."
    "$TUTOR_PYTHON" -m pip install --disable-pip-version-check -e .
    touch .venv/.adaptive-tutor-installed
fi
if [ ! -f .env ]; then
    cp .env.example .env
fi

echo "Open http://127.0.0.1:${TUTOR_PORT:-8000} in your browser. Press Ctrl+C here to stop."
exec "$TUTOR_PYTHON" -m uvicorn app.main:app --host "${TUTOR_HOST:-127.0.0.1}" --port "${TUTOR_PORT:-8000}"
