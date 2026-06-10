#!/bin/bash
# 📞 Call Coach 自动提交脚本
# 监听文件变化 → 自动 add + commit + push
# 用法: ./autocommit.sh

WATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$WATCH_DIR"

echo "👀 监听中: $WATCH_DIR"
echo "   改动后自动 commit + push"
echo ""

fswatch -0 -r --exclude '.git' --exclude '__pycache__' --exclude 'node_modules' . | while read -d "" file; do
  sleep 2  # 等文件写完

  # 看看有没有实际变更
  if git diff --quiet && git diff --cached --quiet; then
    continue
  fi

  git add -A
  MSG="auto: $(date +'%m-%d %H:%M') — $(git diff --cached --stat | tail -1 | xargs)"
  git commit -m "$MSG" --no-verify
  git push 2>/dev/null && echo "✅ $MSG" || echo "❌ push 失败"
done
