#!/bin/sh
if ! curl --silent --fail --max-time 2 http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1; then
    echo "请先双击「启动实验网站.command」，等待网站启动。"
    read -r TUTOR_WAIT
    exit 1
fi
if command -v ngrok >/dev/null 2>&1; then
    TUTOR_NGROK=$(command -v ngrok)
elif [ -x /opt/homebrew/bin/ngrok ]; then
    TUTOR_NGROK=/opt/homebrew/bin/ngrok
elif [ -x /usr/local/bin/ngrok ]; then
    TUTOR_NGROK=/usr/local/bin/ngrok
else
    echo "未找到 ngrok。请先安装 ngrok 并配置账号。"
    read -r TUTOR_WAIT
    exit 1
fi
echo "使用 Forwarding 后面的 HTTPS 地址。保持此窗口运行，按 Ctrl+C 可停止。"
exec "$TUTOR_NGROK" http 8000
