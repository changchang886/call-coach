#!/bin/bash
# 最强模拟 - 部署脚本
# 启动本地服务器 + 公网隧道

cd "$(dirname "$0")"

# 1. 启动 Python 服务器
echo "🚀 启动最强模拟..."
python3 server.py > /tmp/zuihqiangmoni.log 2>&1 &
SERVER_PID=$!
sleep 2

# 2. 启动公网隧道
echo "🔗 连接公网隧道..."
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 \
    -R 80:localhost:8765 nokey@localhost.run \
    > /tmp/zuihqiangmoni-tunnel.log 2>&1 &
TUNNEL_PID=$!
sleep 5

# 3. 获取 URL
URL=$(sed 's/\x1b\[[0-9;]*m//g' /tmp/zuihqiangmoni-tunnel.log | grep -o 'https://[a-z0-9.-]*\.lhr\.life' | head -1)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📞 最强模拟 已上线"
echo "  🌐 $URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "PID: server=$SERVER_PID tunnel=$TUNNEL_PID"
echo "Stop: kill $SERVER_PID $TUNNEL_PID"
echo ""

wait
