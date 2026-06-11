#!/bin/bash
# 📞 一键部署所有云函数
set -e
cd "$(dirname "$0")/miniapp"

ENV_ID="cloudbase-d6gywfjz3008a9c0b"
FNS=("ping" "generateScript" "roleplayStart" "roleplayTurn" "roleplayEnd" "getScenes" "testAI" "netTest")

for fn in "${FNS[@]}"; do
  echo "⬆️  $fn ..."
  echo "" | tcb fn deploy "$fn" \
    --env-id "$ENV_ID" \
    --dir "cloudfunctions/$fn" \
    --force 2>&1 | grep -E '✔|✖|fail|error' || true
done

echo ""
echo "✅ 全部部署完成！"
