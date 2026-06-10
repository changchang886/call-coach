# 📞 最强模拟 (Call Coach)

选场景 · 练真话 · 拿剧本 · 播出去

AI 模拟真实对话训练，先练再拿剧本。支持微信小程序 + Web 双端。

## 架构（重构版 v2）

```
call-coach/
├── server.py              # Python Web 后端（可选）
├── miniapp/
│   ├── app.js             # 小程序入口（微信AI检测）
│   ├── config/
│   │   └── scenes.js      # 🟢 场景统一定义 + scenes.json
│   ├── services/
│   │   ├── ai.js          # AI 服务层（微信AI / DeepSeek 双通道）
│   │   ├── prompts.js     # Prompt 模板集中管理
│   │   └── session.js     # 会话存储封装
│   ├── utils/
│   │   └── api.js         # 云函数调用封装
│   ├── cloudfunctions/    # 5 个云函数（每个内含自包含 common.js）
│   │   ├── getScenes/     # 场景列表（无 AI 依赖）
│   │   ├── generateScript/# 生成话术
│   │   ├── roleplayStart/ # 开始角色演练
│   │   ├── roleplayTurn/  # 对话回合
│   │   └── roleplayEnd/   # 结束 + 评分
│   └── pages/
│       ├── index/         # 场景选择 + 对话
│       └── result/        # 评分 + 剧本展示
└── .env.example           # 环境变量模板
```

## 重构改进

| 改进项 | 之前 | 之后 |
|--------|------|------|
| 场景定义 | 6 处硬编码 | `config/scenes.js` 统一定义 |
| API Key | 4 个云函数硬编码 `sk-...` | 环境变量 `DEEPSEEK_API_KEY` |
| 云函数 | 各自重复 `getClient()` | 每个内含 `common.js` |
| AI 调用 | 仅 DeepSeek | 微信原生 AI + DeepSeek 双通道 |
| Prompt | 散落各处 | `services/prompts.js` 集中管理 |

## 快速启动

### Web 端

```bash
export DEEPSEEK_API_KEY=sk-your-key
pip install openai pyyaml
python server.py
# 打开 http://localhost:8765
```

### 微信小程序

1. 下载[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入 `miniapp/` 目录
3. 配置云环境：修改 `app.js` 中的 `CLOUD_ENV`
4. 配置 API Key：在云函数环境变量中设置 `DEEPSEEK_API_KEY`
5. 部署云函数：右键每个云函数 → 上传并部署
6. 创建数据库集合：`sessions`

## 功能

| 模块 | 说明 |
|------|------|
| 🎯 实战训练 | 选场景 → AI 扮演对方 → 先练再解锁剧本 |
| 🎭 角色演练 | AI 扮演真人，你来对话，结束评分 |
| ⚡ 直接生成 | 跳过练习，直接生成话术剧本 |
| 🔥 话术广场 | 分享话术 · 投票 · 转播（Web 端） |
| 💬 成功故事 | 匿名分享（Web 端） |

## 技术栈

- **前端**：微信原生小程序 + 云开发
- **AI**：DeepSeek API / 微信原生 AI
- **后端**：Python (Flask-free, stdlib only)
- **数据库**：云开发数据库 + 本地 JSON

## 核心理念

不是给你看答案，是你考完再看答案。
一次投入，一次回报。分享即增长。
