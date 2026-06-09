# 最强模拟 — 测试说明

## 测试环境

| 项 | 值 |
|---|---|
| 服务端 | `python3 server.py`，端口默认 8765 |
| 公网隧道 | `./deploy.sh`，URL 每次重启会变 |
| 小程序 | 微信开发者工具导入 `miniapp/` 目录 |
| AI 后端 | DeepSeek API (`deepseek-chat`) |

---

## 一、服务端测试

### 1.1 基础启动

| 用例 | 操作 | 预期 |
|---|---|---|
| 无 API Key 启动 | `DEEPSEEK_API_KEY="" python3 server.py` | 报错退出，提示 "No API key found" |
| 有 API Key 启动 | 正常启动 | 打印端口号和服务地址 |
| 浏览器访问 | 打开 `http://localhost:8765` | 显示场景列表页面，14 个场景 |
| 404 处理 | `curl http://localhost:8765/xyz` | 返回 404 |

### 1.2 场景 API

| 用例 | 操作 | 预期 |
|---|---|---|
| 有效场景 | `GET /api/generate?scene=salary` | 返回 JSON：`opening`、`main_script`、`branches`（≥3个）、`closing`、`tips` |
| 无效场景 | `GET /api/generate?scene=xxx` | 返回 `{"error": "请选择场景"}` |
| 缺少参数 | `GET /api/generate` | 返回 `{"error": "请选择场景"}` |
| 全部 14 个场景 | 逐个调用 `/api/generate?scene=` | 每个都能成功返回话术 |

### 1.3 角色扮演 API

| 用例 | 操作 | 预期 |
|---|---|---|
| 开始会话 | `POST /api/roleplay` `{"action":"start","scene":"salary"}` | 返回 `session`（8位ID）、`role`、`message`（AI开场白） |
| 发送消息 | `POST /api/roleplay` `{"action":"turn","session":"<sid>","message":"我想谈谈加薪"}` | 返回 AI 回复 `message`，`turn` 递增 |
| 结束会话 | `POST /api/roleplay` `{"action":"end","session":"<sid>"}` | 返回 `score`（0-10）、`good`、`improve`、`summary` |
| 无效 session | `POST /api/roleplay` `{"action":"turn","session":"fake","message":"hi"}` | 返回 `{"error": "会话已过期，请重新开始"}` |
| 空消息 | `POST /api/roleplay` `{"action":"turn","session":"<sid>","message":""}` | AI 正常回复（空消息也发给 AI） |
| 连续多轮 | 同一 session 发 10 轮对话 | 每轮正常回复，`turn` 从 1 到 10 |

### 1.4 Demo 对话 API

| 用例 | 操作 | 预期 |
|---|---|---|
| 正常生成 | `GET /api/demo?scene=debt` | 返回 11 条 `transcript`，speaker 交替 |
| 缺省值 | `GET /api/demo` | 默认使用 `salary` 场景 |
| 无效场景 | `GET /api/demo?scene=xyz` | 返回 `{"error": "生成失败"}` 或正常 JSON |
| 线程安全 | 同时发 5 个 `/api/demo` 请求 | 每个独立完成，不串不崩 |

### 1.5 分享与社区 API

| 用例 | 操作 | 预期 |
|---|---|---|
| 分享话术 | `POST /api/share` `{"scene":"salary","script":{...}}` | 返回 `{"ok":true,"id":"<8位>"}` |
| 获取社区 | `GET /api/community` | 返回 `{"scripts":[...],"stories":[...]}` |
| 投票 | `POST /api/vote` `{"id":"<分享ID>"}` | 返回 `{"ok":true}` |
| 投票不存在的 ID | `POST /api/vote` `{"id":"fake"}` | 正常返回 `{"ok":true}`（静默忽略） |
| 成功故事 | `POST /api/story` `{"text":"搞定！"}` | `{"ok":true}` |
| 手机号收集 | `POST /api/phone` `{"phone":"13800138000","scene":"salary"}` | `{"ok":true,"count":<N>}` |

### 1.6 一对一教练 API

| 用例 | 操作 | 预期 |
|---|---|---|
| 创建共享 | `POST /api/roleplay` `{"action":"share","session":"<sid>"}` | 返回 6 位 `share_code` |
| 教练观看 | `GET /api/coach/watch?code=<share_code>` | 返回完整对话历史 + `coach_tips` |
| 教练发提示 | `POST /api/roleplay` `{"action":"coach_tip","code":"<share_code>","message":"注意语气"}` | `{"ok":true}` |
| 错误分享码 | `GET /api/coach/watch?code=WRONG` | `{"error":"会话不存在或已结束"}` |

### 1.7 并发测试

| 用例 | 操作 | 预期 |
|---|---|---|
| 10 并发角色扮演 | 10 个线程同时 start→3 轮 turn→end | 每个 session 独立，不串话 |
| 并发社区写入 | 5 个线程同时 POST `/api/share` | 无数据丢失，`community.json` 不损坏 |
| 并发投票 | 10 个线程对同一个 ID 投票 | 票数正确累加 |

### 1.8 错误处理

| 用例 | 操作 | 预期 |
|---|---|---|
| AI API 超时 | 断网后调用 `/api/generate` | 返回默认话术（fallback），不报 500 |
| AI API 返回非 JSON | Mock AI 返回乱文 | `generate_script` 走 fallback，`roleplay_end` 走 fallback score=7 |
| 请求体非 JSON | `curl -X POST -d "notjson" /api/roleplay` | 返回 500 或解析错误（建议加 try） |

---

## 二、Web 前端测试

### 2.1 场景选择页

| 用例 | 操作 | 预期 |
|---|---|---|
| 页面加载 | 打开首页 | 14 个场景卡片，微信风格列表展示 |
| 自适应 | 手机/PC 浏览器缩放 | 宽度自适应，`max-width:500px` |
| 首次加载 | 等 500ms 后 | 自动触发第一个场景的 Demo |

### 2.2 Demo 示范模式

| 用例 | 操作 | 预期 |
|---|---|---|
| 点击场景 | 点击任意场景卡片 | 进入 Demo 视图，显示加载动画 |
| AI 对话展示 | Demo 加载完成 | 逐条展示 11 句对话，对方前有"正在输入..." |
| 打字动画 | 观察消息出现顺序 | 对方消息间隔 ~800ms，我方 ~600ms |
| 手动关闭 | 点击返回按钮 ‹ | 回到场景列表 |
| 切换场景 | 关闭 → 点另一个场景 | 新 Demo 正常加载 |
| 「试试」按钮 | 点击 🎯 | 跳转到角色扮演模式 |
| Demo 超时 | 网络断开时点场景 | 25 秒后显示"请求超时" |

### 2.3 角色扮演聊天

| 用例 | 操作 | 预期 |
|---|---|---|
| 从 Demo 进入 | 点 🎯 试试 | 显示微信风格聊天界面，AI 已发开场白 |
| 发送消息 | 输入文字 → 回车/发送 | 消息气泡（绿底右侧），AI 回复（白底左侧） |
| 空消息 | 点发送（输入框为空） | 不发送 |
| 多轮对话 | 连续发 5+ 条 | 对话正常滚动，自动滚动到底部 |
| 结束对话 | 点击 📊 按钮 | 加载评分结果 + 生成话术 |
| 返回 | 点击 ‹ | 回到场景列表 |

### 2.4 结果页（评分 + 话术）

| 用例 | 操作 | 预期 |
|---|---|---|
| 评分显示 | 对话结束后 | 大号彩色分数（≥8 绿 / 6-7 橙 / <6 红） |
| 话术渲染 | 查看结果 | 开场白、主体话术、分支、结尾、小贴士完整 |
| 语气标注 | 查看话术 | `【平稳】【微笑】` 等标注绿色高亮 |
| 再来一次 | 点击 🔄 | 回到场景列表 |

### 2.5 截图导出

| 用例 | 操作 | 预期 |
|---|---|---|
| 导出 Demo | Demo 页点 📱 | 下载 PNG 图片 |
| 导出聊天 | 聊天页点 📱 | 下载完整对话截图 |
| 导出结果 | 结果页点 📱 | 下载话术截图 |

### 2.6 分享

| 用例 | 操作 | 预期 |
|---|---|---|
| 分享话术 | 结果页点 📤 | Toast 提示"已分享到广场" |

---

## 三、微信小程序测试

### 3.1 基础

| 用例 | 操作 | 预期 |
|---|---|---|
| 编译导入 | 微信开发者工具导入 `miniapp/` | 编译成功，无报错 |
| 场景列表 | 首页加载 | 14 个场景卡片正常显示 |
| 场景数据 | 对比小程序和 Web | 场景名称、数量一致 |

### 3.2 角色扮演

| 用例 | 操作 | 预期 |
|---|---|---|
| 开始训练 | 点击场景 | 进入聊天界面，AI 发开场白 |
| 发送消息 | 输入文字点发送 | 气泡显示，AI 回复 |
| 网络异常 | API 不可达时发消息 | Toast "发送失败"，不清空输入 |
| 结束训练 | 点击结束 | 跳转结果页，显示评分 + 脚本 |
| 直接拿剧本 | 跳过对话 | 跳转结果页，无评分只有脚本 |

### 3.3 API 地址更新

| 用例 | 操作 | 预期 |
|---|---|---|
| 隧道重启 | 运行 `deploy.sh`，获取新 URL | 更新 `api.js` 和 `index.js` 中的 `API_BASE` 后小程序正常通信 |
| 地址过期 | 不更新 API_BASE | 请求失败，Toast 提示错误 |

### 3.4 适配

| 用例 | 操作 | 预期 |
|---|---|---|
| 不同机型 | iPhone SE / 14 Pro Max / Android 中等屏 | 布局不错乱 |
| 真机预览 | 扫码真机调试 | 功能正常 |

---

## 四、部署测试

### 4.1 本地部署

| 用例 | 操作 | 预期 |
|---|---|---|
| 默认端口 | `python3 server.py` | 端口 8765 |
| 指定端口 | `PORT=3000 python3 server.py` | 端口 3000 |
| 停止服务 | Ctrl+C | 打印 "Bye!"，进程退出 |

### 4.2 隧道部署

| 用例 | 操作 | 预期 |
|---|---|---|
| 部署脚本 | `bash deploy.sh` | 启动 server + 隧道，打印公网 URL |
| 公网访问 | 浏览器打开隧道 URL | 功能完整 |
| 隧道断开重连 | kill tunnel 进程 → 重跑 deploy.sh | URL 变更，服务恢复 |
| 停止 | `kill <server_pid> <tunnel_pid>` | 进程退出 |

### 4.3 数据持久化

| 用例 | 操作 | 预期 |
|---|---|---|
| 社区数据 | 分享话术后重启服务 | 之前分享的数据仍在 `community.json` 中 |
| 会话数据 | 角色扮演中途重启服务 | session 丢失（in-memory），重新训练正常 |

---

## 五、回归检查清单

每次发版前快速过一遍：

- [ ] `python3 server.py` 正常启动
- [ ] Web 首页加载，场景列表正常
- [ ] Demo 对话能跑通（至少 3 个场景）
- [ ] 角色扮演：开始 → 3 轮对话 → 结束 → 评分 + 话术正常
- [ ] 话术生成：至少测 salary / debt / ex 三个场景
- [ ] 小程序编译成功，基础流程走通
- [ ] `deploy.sh` 部署成功，公网可访问
- [ ] 社区读写不丢数据
