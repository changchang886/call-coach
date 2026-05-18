# 📞 最强模拟

选场景 · 练真话 · 拿剧本 · 播出去

## Quick Start

```bash
python server.py
# 打开 http://localhost:8765
```

## 场景

- 💰 谈薪资 | 🚪 提离职 | 💸 催还款
- 📅 请假 | ❌ 拒绝加班 | 🏠 退押金

## 功能

| 模块 | 说明 |
|------|------|
| 🎯 实战训练 | 选场景 → AI 扮演对方 → 先练再解锁剧本 |
| 🎭 角色演练 | AI 扮演真人，你来对话 |
| 🔗 一对一转播 | 分享码实时观看 + 教练实时提示 |
| 🔥 话术广场 | 分享话术 · 投票 · 转播 |
| 💬 成功故事 | 匿名分享打完电话的结果 |
| 📱 手机收集 | 训练完成后收集，增长飞轮 |

## 核心理念

不是给你看答案，是你考完再看答案。
一次投入，一次回报。分享即增长。

## 技术栈

Python · DeepSeek API · Vanilla JS · 零依赖前端

### 微信小程序

`/miniapp` 目录为完整微信小程序源码。

**导入方式：**
1. 下载[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开工具 → 导入项目 → 选择 `miniapp/` 目录
3. 修改 `project.config.json` 中的 `appid` 为你的 AppID
4. 修改 `utils/api.js` 中的 `API_BASE` 为你的后端地址

**页面结构：**
- `pages/index` — 场景选择
- `pages/training` — 实战训练 + 语音模式
- `pages/result` — 评分 + 剧本解锁
- `pages/community` — 话术广场 + 成功故事
- `pages/coach` — 教练观看模式
