#!/bin/bash
# 最强模拟 - 部署脚本 v3
# 使用 Cloudflare Tunnel（比 localhost.run 稳定）

cd "$(dirname "$0")"
URL_FILE="/tmp/zuihqiangmoni-url.txt"

# 杀旧进程
pkill -f 'cloudflared tunnel' 2>/dev/null
sleep 1

# 1. 确保 Python 服务器在跑
if ! lsof -i :8765 -P | grep -q LISTEN; then
    echo "🚀 启动最强模拟..."
    python3 server.py > /tmp/zuihqiangmoni.log 2>&1 &
    sleep 2
fi

# 2. 启动 Cloudflare Tunnel
echo "🔗 启动 Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:8765 > /tmp/zuihqiangmoni-cf.log 2>&1 &
sleep 8

URL=$(grep -o 'https://[a-z0-9.-]*\.trycloudflare\.com' /tmp/zuihqiangmoni-cf.log | head -1)
echo "$URL" > "$URL_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📞 最强模拟 已上线"
echo "  🌐 $URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
