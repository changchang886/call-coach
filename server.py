#!/usr/bin/env python3
"""
📞 打电话话术教练 - Call Coach
选场景 → AI 生成完整话术剧本 → 分叉脚本 + 语气提示
"""

import json
import os
import re
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from openai import OpenAI

# ── AI Setup ──
def get_ai_client():
    api_key = os.environ.get("DEEPSEEK_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

    if not api_key:
        config_path = Path.home() / "ai-chat-loop" / "config.yaml"
        if config_path.exists():
            try:
                import yaml
                with open(config_path) as f:
                    cfg = yaml.safe_load(f)
                api_key = cfg.get("deepseek", {}).get("api_key", "")
            except Exception:
                pass

    if not api_key:
        raise RuntimeError("No API key found")
    return OpenAI(api_key=api_key, base_url=base_url), model


ai_client, ai_model = get_ai_client()

# ── Scene Definitions ──
SCENES = {
    "salary": {
        "name": "💰 谈薪资",
        "emoji": "💰",
        "goal": "和领导谈加薪/谈期望薪资",
        "persona": "领导/HR",
        "vibe": "自信而不冒犯，用数据说话",
    },
    "resign": {
        "name": "🚪 提离职",
        "emoji": "🚪",
        "goal": "体面地提出离职",
        "persona": "领导",
        "vibe": "坚定但不敌对，感恩但明确",
    },
    "debt": {
        "name": "💸 催还款",
        "emoji": "💸",
        "goal": "催朋友/同事还欠款",
        "persona": "朋友/同事",
        "vibe": "不伤和气但让对方无法推脱",
    },
    "leave": {
        "name": "📅 请假",
        "emoji": "📅",
        "goal": "向领导请假（事假/病假/年假）",
        "persona": "领导",
        "vibe": "合理合法，提前安排好工作交接",
    },
    "overtime": {
        "name": "❌ 拒绝加班",
        "emoji": "❌",
        "goal": "拒绝不合理加班要求",
        "persona": "领导/同事",
        "vibe": "坚定但有替代方案，不说'不想'说'不能'",
    },
    "deposit": {
        "name": "🏠 退押金",
        "emoji": "🏠",
        "goal": "向房东要回租房押金",
        "persona": "房东",
        "vibe": "有理有据，引用合同/法律，不卑不亢",
    },
}


def generate_script(scene_key: str) -> dict:
    """Generate a complete phone call script for the given scene"""
    scene = SCENES[scene_key]

    prompt = f"""你是一个电话沟通教练。用户需要打一个电话：

场景：{scene['goal']}
对象：{scene['persona']}
基调：{scene['vibe']}

请生成一份完整的话术剧本，用 JSON 格式返回：

{{
  "opening": "开场白（第一句话，带【语气】标注）",
  "main_script": "主体话术（3-4句话，每句带【语气】标注和停顿提示）",
  "branches": [
    {{
      "if": "如果对方这样说...",
      "reply": "你这样回...（带【语气】标注）"
    }}
  ],
  "closing": "结尾话术（带【语气】标注）",
  "tips": ["打电话前的准备提示", "语气提醒", "禁忌事项"]
}}

要求：
- 话术要口语化，能直接念出来，不要书面语
- 【语气】标注要具体：【平稳坚定】【微笑】【停顿1秒】【语速放缓】【压低声音】
- branch 至少给 3 个对方可能的反应及应对
- 整体要自然，听起来不像念稿子"""

    try:
        response = ai_client.chat.completions.create(
            model=ai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.7,
        )
        text = response.choices[0].message.content.strip()

        # Extract JSON
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"AI error: {e}")

    # Fallback script
    return {
        "opening": "您好，想占用您几分钟时间聊一件事。【平稳】",
        "main_script": ["第一点，我想跟您反馈一下...【语气放缓】", "基于以上情况，我希望...【停顿1秒】【平稳坚定】"],
        "branches": [
            {"if": "如果对方说需要再考虑", "reply": "我理解需要时间，您看方便给我一个大概的时间节点吗？【礼貌追问】"},
        ],
        "closing": "感谢您的时间，期待您的回复。【微笑】",
        "tips": ["选择对方心情好的时候打", "准备好数据支撑", "不要在电话里情绪化"],
    }


# ── HTML Template ──
HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📞 打电话话术教练</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    min-height: 100vh; color: #e2e8f0;
  }
  .container { max-width: 680px; margin: 0 auto; padding: 24px 20px; }
  header { text-align: center; padding: 40px 0 32px; }
  header h1 { font-size: 2rem; margin-bottom: 8px; }
  header p { color: #94a3b8; font-size: 0.95rem; }

  .scenes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 32px; }
  .scene-btn {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 18px 14px; cursor: pointer; transition: all 0.2s;
    text-align: left; color: #e2e8f0; font-size: 1rem;
  }
  .scene-btn:hover { background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.3); transform: translateY(-1px); }
  .scene-btn.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; }
  .scene-btn .emoji { font-size: 1.5rem; display: block; margin-bottom: 6px; }
  .scene-btn .goal { color: #94a3b8; font-size: 0.8rem; margin-top: 4px; }

  .generate-btn {
    width: 100%; padding: 16px; border: none; border-radius: 12px;
    background: linear-gradient(135deg, #38bdf8, #818cf8); color: #fff;
    font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
  }
  .generate-btn:hover { opacity: 0.9; }
  .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .loading { display:none; text-align:center; padding:40px; }
  .loading.show { display:block; }
  .spinner { width:40px; height:40px; border:3px solid rgba(255,255,255,0.1); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .result { display:none; }
  .result.show { display:block; }

  .script-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px; padding: 24px; margin-bottom: 16px;
  }
  .script-card h3 { font-size: 0.85rem; color: #38bdf8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .script-line {
    padding: 10px 14px; margin-bottom: 8px; border-radius: 8px;
    background: rgba(255,255,255,0.03); line-height: 1.7; font-size: 0.95rem;
  }
  .script-line.hero { background: rgba(56,189,248,0.1); border-left: 3px solid #38bdf8; font-size: 1.05rem; }
  .tone { color: #fbbf24; font-size: 0.8rem; margin-left: 4px; }
  .branch-item {
    padding: 12px 14px; margin-bottom: 10px; border-radius: 8px;
    background: rgba(129,140,248,0.06); border: 1px solid rgba(129,140,248,0.15);
  }
  .branch-if { color: #f87171; font-size: 0.85rem; margin-bottom: 6px; }
  .branch-reply { color: #e2e8f0; font-size: 0.95rem; line-height: 1.6; }
  .tips-list { padding-left: 20px; }
  .tips-list li { color: #94a3b8; margin-bottom: 6px; font-size: 0.9rem; line-height: 1.5; }

  .footer { text-align: center; padding: 40px 0; color: #475569; font-size: 0.8rem; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>📞 打电话话术教练</h1>
    <p>选一个场景，生成能直接念的剧本</p>
  </header>

  <div class="scenes" id="scenes"></div>

  <button class="generate-btn" id="generate" disabled>选场景后点此生成话术 ⚡</button>

  <div class="loading" id="loading">
    <div class="spinner"></div>
    <p style="color:#94a3b8">AI 正在写话术...</p>
  </div>

  <div class="result" id="result"></div>
</div>
<div class="footer">AI Phone Call Coach · 话术仅供参考</div>

<script>
const SCENES = """ + json.dumps(SCENES) + r""";
let selectedScene = null;

// Render scene cards
const scenesEl = document.getElementById('scenes');
Object.entries(SCENES).forEach(([key, scene]) => {
  const btn = document.createElement('button');
  btn.className = 'scene-btn';
  btn.innerHTML = `<span class="emoji">${scene.emoji}</span>${scene.name}<div class="goal">${scene.goal}</div>`;
  btn.onclick = () => {
    document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedScene = key;
    document.getElementById('generate').disabled = false;
    document.getElementById('generate').textContent = `生成「${scene.name.replace(/[🎯💡]/g,'')}」话术 ⚡`;
  };
  scenesEl.appendChild(btn);
});

// Generate button
document.getElementById('generate').onclick = async () => {
  if (!selectedScene) return;
  document.getElementById('loading').classList.add('show');
  document.getElementById('result').classList.remove('show');
  document.getElementById('generate').disabled = true;

  try {
    const res = await fetch('/api/generate?scene=' + selectedScene);
    const data = await res.json();

    if (data.error) {
      document.getElementById('result').innerHTML = `<div class="script-card"><p style="color:#f87171">${data.error}</p></div>`;
    } else {
      renderScript(data);
    }
  } catch(e) {
    document.getElementById('result').innerHTML = `<div class="script-card"><p style="color:#f87171">生成失败，请重试</p></div>`;
  }

  document.getElementById('loading').classList.remove('show');
  document.getElementById('result').classList.add('show');
  document.getElementById('generate').disabled = false;
};

function renderScript(data) {
  const lines = Array.isArray(data.main_script) ? data.main_script : [data.main_script];

  let html = '';

  // Opening
  if (data.opening) {
    html += `<div class="script-card">
      <h3>🎤 开场白</h3>
      <div class="script-line hero">${formatTone(data.opening)}</div>
    </div>`;
  }

  // Main script
  html += `<div class="script-card">
    <h3>📜 主体话术</h3>
    ${lines.map(l => `<div class="script-line">${formatTone(l)}</div>`).join('')}
  </div>`;

  // Branches
  if (data.branches && data.branches.length) {
    html += `<div class="script-card">
      <h3>🔀 如果对方说...</h3>
      ${data.branches.map(b => `
        <div class="branch-item">
          <div class="branch-if">👉 ${b.if}</div>
          <div class="branch-reply">💬 ${formatTone(b.reply)}</div>
        </div>`).join('')}
    </div>`;
  }

  // Closing
  if (data.closing) {
    html += `<div class="script-card">
      <h3>👋 结尾</h3>
      <div class="script-line">${formatTone(data.closing)}</div>
    </div>`;
  }

  // Tips
  if (data.tips && data.tips.length) {
    html += `<div class="script-card">
      <h3>💡 温馨提示</h3>
      <ol class="tips-list">${data.tips.map(t => `<li>${t}</li>`).join('')}</ol>
    </div>`;
  }

  document.getElementById('result').innerHTML = html;
}

function formatTone(text) {
  // Replace 【tone】 with styled spans
  return text.replace(/【([^】]+)】/g, '<span class="tone">【$1】</span>');
}
</script>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/" or parsed.path == "/index.html":
            self._serve_html()
        elif parsed.path == "/api/generate":
            self._api_generate(parsed)
        else:
            self.send_error(404)

    def _serve_html(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(HTML.encode("utf-8"))

    def _api_generate(self, parsed):
        params = parse_qs(parsed.query)
        scene = params.get("scene", [None])[0]

        if not scene or scene not in SCENES:
            self._json({"error": "请选择一个场景"})
            return

        print(f"Generating script for: {scene}")
        data = generate_script(scene)

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def log_message(self, format, *args):
        print(f"[{args[0]}] {args[1]} {args[2]}")


if __name__ == "__main__":
    port = 8765
    print(f"\n📞 打电话话术教练启动！")
    print(f"   浏览器打开 → http://localhost:{port}\n")
    server = HTTPServer(("0.0.0.0", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Bye!")
        server.shutdown()
