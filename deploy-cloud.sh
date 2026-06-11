#!/bin/bash
# 📞 一键部署所有云函数
# 前提：跑过一次 tcb login

set -e
cd "$(dirname "$0")/miniapp"

ENV_ID="cloudbase-d6gywfjz3008a9c0b"
FNS=("ping" "generateScript" "roleplayStart" "roleplayTurn" "roleplayEnd" "getScenes" "testAI" "netTest")

echo "📦 部署云函数到 $ENV_ID"
echo ""

for fn in "${FNS[@]}"; do
  if [ -d "cloudfunctions/$fn" ]; then
    echo "⬆️  部署 $fn ..."
    tcb fn deploy "$fn" \
      --envId "$ENV_ID" \
      --path "cloudfunctions/$fn" \
      --force 2>&1 | tail -1
  fi
done

echo ""
echo "✅ 全部部署完成！共 ${#FNS[@]} 个"
