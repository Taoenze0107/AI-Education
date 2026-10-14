#!/bin/sh
# macOS: double-click this file to open the launcher in Terminal.
TUTOR_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec /bin/sh "$TUTOR_DIR/start.sh"
