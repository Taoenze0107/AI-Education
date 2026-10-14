#!/bin/sh
TUTOR_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$TUTOR_DIR" || exit 1
if curl --silent --fail --max-time 2 http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1; then
    echo "实验网站已经在运行。请打开 http://127.0.0.1:8000"
    open http://127.0.0.1:8000
    exit 0
fi
exec /bin/sh "$TUTOR_DIR/start.sh"
