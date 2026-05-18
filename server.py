#!/usr/bin/env python3
"""
📞 最强模拟 — 选场景 · 练真话 · 拿剧本 · 播出去
"""

import json
import os
import re
import time
import uuid
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
            import yaml
            with open(config_path) as f:
                cfg = yaml.safe_load(f)
            api_key = cfg.get("deepseek", {}).get("api_key", "")
    if not api_key:
        raise RuntimeError("No API key found")
    return OpenAI(api_key=api_key, base_url=base_url), model

ai_client, ai_model = get_ai_client()

# ── Community Storage ──
DATA_FILE = Path(__file__).parent / "community.json"

def load_community():
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {"scripts": [], "stories": []}

def save_community(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ── Scenes ──
SCENES = {
    "salary": {"name": "💰 谈薪资", "goal": "和领导谈加薪/谈期望薪资", "persona": "领导/HR", "vibe": "自信而不冒犯"},
    "resign": {"name": "🚪 提离职", "goal": "体面地提出离职", "persona": "领导", "vibe": "坚定但不敌对"},
    "debt": {"name": "💸 催还款", "goal": "催朋友/同事还欠款", "persona": "朋友/同事", "vibe": "不伤和气但无法推脱"},
    "leave": {"name": "📅 请假", "goal": "向领导请假", "persona": "领导", "vibe": "合理合法，提前安排交接"},
    "overtime": {"name": "❌ 拒绝加班", "goal": "拒绝不合理加班", "persona": "领导/同事", "vibe": "坚定但有替代方案"},
    "deposit": {"name": "🏠 退押金", "goal": "向房东要回押金", "persona": "房东", "vibe": "有理有据，引用合同"},
}

# ── Role-Play Sessions (in-memory) ──
ROLEPLAY_SESSIONS = {}
PUBLIC_SESSIONS = {}  # share_code → {sid, scene, history, coach_tips, viewers}

def roleplay_start(scene_key, share=False):
    """Start a role-play session. AI plays the other person."""
    scene = SCENES[scene_key]
    sid = str(uuid.uuid4())[:8]
    share_code = None
    
    system_prompt = f"""你现在正在扮演{scene['persona']}。

这是一个模拟电话通话。对方打电话给你，话题是：{scene['goal']}。

你的角色设定：
- 你的态度基调：{scene['vibe']}
- 你是真实的普通人，不是NPC。你不会说"好的我同意"——你有自己的顾虑、立场和情绪
- 你的反应要合理：有时犹豫、有时反问、有时拒绝、有时讨价还价
- 不要一次说太多，每次回1-3句话，像真实通话
- 对话开头你接起电话，说一声"喂？"或类似的"""

    history = [{"role": "system", "content": system_prompt}]
    
    try:
        resp = ai_client.chat.completions.create(
            model=ai_model, messages=history + [{"role": "user", "content": "电话铃声响了，请接起电话。只说开场白。"}],
            max_tokens=100, temperature=0.9)
        opening_line = resp.choices[0].message.content.strip()
        history.append({"role": "assistant", "content": opening_line})
    except Exception as e:
        opening_line = "喂？哪位？"
        history.append({"role": "assistant", "content": opening_line})

    ROLEPLAY_SESSIONS[sid] = {"scene": scene_key, "history": history, "turn": 0, "share_code": None}
    
    if share:
        share_code = str(uuid.uuid4())[:6].upper()
        ROLEPLAY_SESSIONS[sid]["share_code"] = share_code
        PUBLIC_SESSIONS[share_code] = {
            "sid": sid, "scene": scene_key, "persona": scene['persona'],
            "history": list(history), "coach_tips": [], "active": True
        }
    
    return {"session": sid, "role": scene['persona'], "message": opening_line, "scene": scene_key, "share_code": share_code}

def roleplay_turn(sid, user_msg):
    """User speaks, AI (as the other person) responds."""
    if sid not in ROLEPLAY_SESSIONS:
        return {"error": "会话已过期，请重新开始"}
    sess = ROLEPLAY_SESSIONS[sid]
    sess["history"].append({"role": "user", "content": user_msg})
    sess["turn"] += 1

    try:
        resp = ai_client.chat.completions.create(
            model=ai_model, messages=sess["history"],
            max_tokens=150, temperature=0.9)
        reply = resp.choices[0].message.content.strip()
    except Exception as e:
        reply = "嗯，你继续说。（信号不太好）"

    sess["history"].append({"role": "assistant", "content": reply})
    
    # Sync to public session if shared
    sc = sess.get("share_code")
    if sc and sc in PUBLIC_SESSIONS:
        ps = PUBLIC_SESSIONS[sc]
        ps["history"] = list(sess["history"])
    
    return {"message": reply, "turn": sess["turn"], "coach_tips": PUBLIC_SESSIONS.get(sc, {}).get("coach_tips", []) if sc else []}

def roleplay_end(sid):
    """End role-play and get feedback."""
    if sid not in ROLEPLAY_SESSIONS:
        return {"error": "会话已过期"}
    sess = ROLEPLAY_SESSIONS.pop(sid)

    # Build feedback prompt
    dialogue = "\n".join([f"{'对方' if m['role']=='assistant' else '你'}: {m['content']}"
                          for m in sess["history"] if m["role"] != "system"])
    scene = SCENES[sess["scene"]]

    try:
        resp = ai_client.chat.completions.create(
            model=ai_model,
            messages=[{
                "role": "user",
                "content": f"""你是电话沟通教练。评估以下模拟通话：

场景：{scene['goal']}
对象：{scene['persona']}

通话记录：
{dialogue}

请用 JSON 格式返回评估结果：
{{"score": 8, "good": ["做得好的点1", "点2"], "improve": ["需要改进的点1", "点2"], "summary": "一句话总结"}}

score 满分10分"""
            }],
            max_tokens=400, temperature=0.7)
        text = resp.choices[0].message.content.strip()
        m = re.search(r'\{[\s\S]*\}', text)
        if m: return json.loads(m.group())
    except Exception:
        pass

    return {"score": 7, "good": ["你敢于开口了"], "improve": ["可以更自信一些"], "summary": "再接再厉！"}

def roleplay_share(sid):
    """Make an existing session public and return share code."""
    if sid not in ROLEPLAY_SESSIONS:
        return {"error": "会话不存在"}
    sess = ROLEPLAY_SESSIONS[sid]
    if sess.get("share_code"):
        return {"share_code": sess["share_code"]}
    share_code = str(uuid.uuid4())[:6].upper()
    sess["share_code"] = share_code
    scene = SCENES[sess["scene"]]
    PUBLIC_SESSIONS[share_code] = {
        "sid": sid, "scene": sess["scene"], "persona": scene['persona'],
        "history": list(sess["history"]), "coach_tips": [], "active": True
    }
    return {"share_code": share_code}

def coach_watch(code):
    """Coach watches a public session."""
    if code not in PUBLIC_SESSIONS:
        return {"error": "会话不存在或已结束"}
    ps = PUBLIC_SESSIONS[code]
    msgs = []
    for m in ps["history"]:
        if m["role"] == "system":
            continue
        role = "对方" if m["role"] == "assistant" else "求助者"
        msgs.append({"role": role, "content": m["content"]})
    return {
        "scene": ps["scene"],
        "persona": ps["persona"],
        "messages": msgs,
        "coach_tips": ps["coach_tips"],
        "active": ps["active"]
    }

def coach_tip(code, message):
    """Coach sends a tip to the trainee."""
    if code not in PUBLIC_SESSIONS:
        return {"error": "会话不存在"}
    ps = PUBLIC_SESSIONS[code]
    ps["coach_tips"].append({"message": message, "time": time.time()})
    return {"ok": True}

# ── Script Generation ──
def generate_script(scene_key):
    scene = SCENES[scene_key]
    prompt = f"""你是电话沟通教练。生成话术剧本，JSON格式：

场景：{scene['goal']} | 对象：{scene['persona']} | 基调：{scene['vibe']}

返回JSON：
{{
  "opening": "开场白（带【语气】标注，口语化能直接念）",
  "main_script": ["话术1（带【语气】）", "话术2", "话术3"],
  "branches": [{{"if": "如果对方说...", "reply": "你这样回...（带【语气】）"}}],
  "closing": "结尾（带【语气】）",
  "tips": ["提示1", "提示2", "提示3"]
}}
- 话术要口语，不书面
- branches至少3个
- 语气标注：【平稳】【微笑】【停顿1秒】【语速放缓】【坚定】"""

    try:
        response = ai_client.chat.completions.create(
            model=ai_model, messages=[{"role": "user", "content": prompt}],
            max_tokens=1200, temperature=0.7)
        text = response.choices[0].message.content.strip()
        m = re.search(r'\{[\s\S]*\}', text)
        if m: return json.loads(m.group())
    except Exception as e:
        print(f"AI error: {e}")

    return {
        "opening": "您好，想占用您几分钟时间聊一件事。【平稳】",
        "main_script": ["第一点，我想跟您反馈一下...【语气放缓】"],
        "branches": [{"if": "如果对方说需要再考虑", "reply": "我理解需要时间，您看方便给我一个大概的时间节点吗？【礼貌追问】"}],
        "closing": "感谢您的时间。【微笑】",
        "tips": ["选对方心情好的时候打", "准备好数据支撑"]
    }

# ── HTML ──
HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📞 最强模拟</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;color:#e2e8f0}
.container{max-width:720px;margin:0 auto;padding:24px 20px}
header{text-align:center;padding:32px 0 24px}
header h1{font-size:1.8rem;margin-bottom:6px}
header p{color:#94a3b8;font-size:.9rem}

/* Tabs */
.tabs{display:flex;gap:4px;margin-bottom:24px;background:rgba(255,255,255,.04);border-radius:12px;padding:4px}
.tab{flex:1;padding:10px;text-align:center;border-radius:10px;cursor:pointer;font-size:.9rem;color:#94a3b8;transition:all .2s;border:none;background:none}
.tab:hover{background:rgba(255,255,255,.05);color:#e2e8f0}
.tab.active{background:rgba(56,189,248,.2);color:#38bdf8;font-weight:600}

/* Tab panels */
.panel{display:none}
.panel.active{display:block}

/* Scene cards */
.scenes{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px}
.scene-btn{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px 12px;cursor:pointer;transition:all .2s;text-align:left;color:#e2e8f0;font-size:.95rem}
.scene-btn:hover{background:rgba(56,189,248,.1);border-color:rgba(56,189,248,.3);transform:translateY(-1px)}
.scene-btn.active{background:rgba(56,189,248,.15);border-color:#38bdf8}
.scene-btn .emj{font-size:1.3rem;display:block;margin-bottom:4px}
.scene-btn .goal{color:#94a3b8;font-size:.75rem;margin-top:2px}

.btn{width:100%;padding:14px;border:none;border-radius:12px;cursor:pointer;font-size:1rem;font-weight:600;transition:opacity .2s}
.btn:hover{opacity:.9}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn-primary{background:linear-gradient(135deg,#38bdf8,#818cf8);color:#fff}
.btn-outline{background:transparent;border:1px solid rgba(56,189,248,.3);color:#38bdf8}

.loading{display:none;text-align:center;padding:30px}
.loading.show{display:block}
.spinner{width:32px;height:32px;border:3px solid rgba(255,255,255,.1);border-top-color:#38bdf8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px}
@keyframes spin{to{transform:rotate(360deg)}}

.result{display:none}
.result.show{display:block}

.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;margin-bottom:14px}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.card-header h3{font-size:.85rem;color:#38bdf8;text-transform:uppercase;letter-spacing:1px}
.script-line{padding:10px 14px;margin-bottom:6px;border-radius:8px;background:rgba(255,255,255,.03);line-height:1.7;font-size:.9rem}
.script-line.hero{background:rgba(56,189,248,.1);border-left:3px solid #38bdf8;font-size:1rem}
.tone{color:#fbbf24;font-size:.78rem;margin-left:2px}
.branch-item{padding:10px 14px;margin-bottom:8px;border-radius:8px;background:rgba(129,140,248,.06);border:1px solid rgba(129,140,248,.15)}
.branch-if{color:#f87171;font-size:.82rem;margin-bottom:4px}
.branch-reply{color:#e2e8f0;font-size:.9rem;line-height:1.6}
.tips-list{padding-left:18px}
.tips-list li{color:#94a3b8;margin-bottom:4px;font-size:.85rem;line-height:1.5}

.actions{display:flex;gap:8px;margin-top:14px}
.actions .btn{font-size:.85rem;padding:10px}

/* Community */
.feed-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px;margin-bottom:12px}
.feed-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.feed-scene{background:rgba(56,189,248,.15);color:#38bdf8;padding:2px 10px;border-radius:12px;font-size:.8rem}
.feed-time{color:#64748b;font-size:.78rem}
.feed-script{color:#e2e8f0;font-size:.9rem;line-height:1.6;margin-bottom:8px;white-space:pre-wrap}
.feed-footer{display:flex;gap:16px;align-items:center}
.feed-btn{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:.82rem;padding:4px 8px;border-radius:6px;transition:all .15s}
.feed-btn:hover{background:rgba(255,255,255,.05);color:#e2e8f0}
.feed-btn .num{color:#38bdf8;margin-left:3px}
.feed-btn.replayed{color:#a78bfa}

/* Story */
.story-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px;margin-bottom:12px}
.story-content{color:#e2e8f0;font-size:.92rem;line-height:1.7;margin-bottom:8px}
.story-footer{display:flex;justify-content:space-between;align-items:center}
.story-scene{color:#38bdf8;font-size:.78rem}
.story-time{color:#64748b;font-size:.78rem}

/* Toast */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#38bdf8;color:#fff;padding:10px 24px;border-radius:20px;font-size:.9rem;opacity:0;transition:opacity .3s;z-index:99}
.toast.show{opacity:1}

/* Share modal */
.modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);z-index:100;align-items:center;justify-content:center}
.modal.show{display:flex}
.modal-box{background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;max-width:480px;width:90%}
.modal-box textarea{width:100%;height:120px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;color:#e2e8f0;font-size:.9rem;resize:vertical;font-family:inherit}
.modal-box .actions{margin-top:14px}

.empty-state{text-align:center;padding:40px 20px;color:#64748b}
.empty-state .icon{font-size:3rem;margin-bottom:12px}

.footer{text-align:center;padding:40px 0;color:#475569;font-size:.78rem}
</style>
</head>
<body>
<div class="container">
<header><h1>📞 最强模拟</h1><p>选场景 · 练真话 · 拿剧本 · 播出去</p></header>

<div class="tabs">
  <button class="tab active" onclick="switchTab('generate')">⚡ 生成话术</button>
  <button class="tab" onclick="switchTab('community')">🔥 话术广场</button>
  <button class="tab" onclick="switchTab('stories')">💬 成功故事</button>
  <button class="tab" onclick="switchTab('roleplay')">🎭 角色演练</button>
</div>

<!-- TAB 1: Generate -->
<div class="panel active" id="panel-generate">
  <div class="scenes" id="scenes"></div>
  <div id="gen-actions" style="display:none;margin-bottom:16px">
    <button class="btn btn-primary" onclick="startTraining()" style="margin-bottom:8px">🎯 实战训练 — 先练再拿剧本（推荐）</button>
    <button class="btn btn-outline" onclick="generateDirect()">⚡ 直接生成 — 跳过练习</button>
    <p style="color:#64748b;font-size:.78rem;text-align:center;margin-top:6px">实战训练：AI 扮演对方，练完后解锁完整话术+评分</p>
  </div>
  <div class="loading" id="loading"><div class="spinner"></div><p style="color:#94a3b8">AI 正在写话术...</p></div>
  <div class="result" id="result"></div>
  <!-- Training inline -->
  <div id="training-chat" style="display:none;margin-top:14px"></div>
</div>

<!-- TAB 2: Community Script Wall -->
<div class="panel" id="panel-community">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h3 style="color:#38bdf8;font-size:.95rem">🔥 热门话术</h3>
    <button class="btn btn-outline" style="width:auto;padding:8px 16px" onclick="refreshFeed()">🔄 刷新</button>
  </div>
  <div id="feed"></div>
</div>

<!-- TAB 3: Success Stories -->
<div class="panel" id="panel-stories">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
    <h3 style="color:#38bdf8;font-size:.95rem">💬 匿名成功故事</h3>
    <button class="btn btn-outline" style="width:auto;padding:8px 16px" onclick="showStoryModal()">✏️ 写故事</button>
  </div>
  <div id="story-feed"></div>
</div>

<!-- TAB 4: Role-Play Simulation -->
<div class="panel" id="panel-roleplay">
  <!-- Coach Join Card -->
  <div class="card" style="margin-bottom:14px;border:1px dashed rgba(251,191,36,.3);background:rgba(251,191,36,.04)" id="coach-join">
    <h3 style="color:#fbbf24;font-size:.85rem;margin-bottom:8px">👀 观看他人训练（教练模式）</h3>
    <p style="color:#94a3b8;font-size:.78rem;margin-bottom:10px">输入分享码，实时观看求助者的演练并发送提示</p>
    <div style="display:flex;gap:8px">
      <input id="coach-code-input" type="text" placeholder="输入6位分享码" maxlength="6" style="flex:1;padding:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;font-size:.85rem;text-transform:uppercase">
      <button class="btn btn-primary" style="width:auto;padding:10px 18px;font-size:.85rem" onclick="joinCoach()">进入观看</button>
    </div>
  </div>
  <div id="coach-view" style="display:none">
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="color:#fbbf24;font-size:.8rem">👀 教练模式</span>
        <button class="btn btn-outline" style="width:auto;padding:4px 12px;font-size:.7rem" onclick="leaveCoach()">退出</button>
      </div>
      <div id="coach-msgs" style="max-height:300px;overflow-y:auto;margin-bottom:10px"></div>
      <div style="display:flex;gap:8px">
        <input id="coach-tip-input" type="text" placeholder="发送提示给求助者..." style="flex:1;padding:8px;background:rgba(255,255,255,.05);border:1px solid rgba(251,191,36,.2);border-radius:8px;color:#fbbf24;font-size:.82rem" onkeydown="if(event.key==='Enter')sendCoachTip()">
        <button class="btn btn-primary" style="width:auto;padding:8px 14px;font-size:.82rem;background:#f59e0b" onclick="sendCoachTip()">💡 提示</button>
      </div>
    </div>
  </div>

  <div class="card" style="margin-bottom:14px" id="rp-setup">
    <h3 style="color:#38bdf8;font-size:.9rem;margin-bottom:10px">🎭 选择场景开始演练</h3>
    <select id="rp-scene" style="width:100%;padding:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;font-size:.9rem;margin-bottom:10px">
      ${Object.entries(SCENES).map(([k,s])=>`<option value="${k}">${s.name} — ${s.persona}</option>`).join('')}
    </select>
    <button class="btn btn-primary" onclick="startRoleplay()">📞 开始通话</button>
  </div>

  <div id="rp-chat" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="color:#94a3b8;font-size:.85rem" id="rp-info"></span>
      <button class="btn btn-outline" style="width:auto;padding:6px 14px;font-size:.8rem" onclick="endRoleplay()">📊 结束并评分</button>
    </div>
    <div id="rp-messages" style="max-height:400px;overflow-y:auto;margin-bottom:12px"></div>
    <div style="display:flex;gap:8px">
      <input id="rp-input" type="text" placeholder="输入你要说的话..." style="flex:1;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#e2e8f0;font-size:.9rem" onkeydown="if(event.key==='Enter')sendRoleplayTurn()">
      <button class="btn btn-primary" style="width:auto;padding:12px 20px" onclick="sendRoleplayTurn()">发送</button>
    </div>
  </div>

  <div id="rp-feedback" style="display:none"></div>
</div>

</div>

<div class="toast" id="toast"></div>

<!-- Story modal -->
<div class="modal" id="storyModal">
  <div class="modal-box">
    <h3 style="color:#38bdf8;margin-bottom:14px">✏️ 分享你的故事（匿名）</h3>
    <textarea id="storyText" placeholder="比如：用了谈薪话术，涨了30%，匿了..."></textarea>
    <div class="actions">
      <button class="btn btn-outline" style="flex:1" onclick="closeStoryModal()">取消</button>
      <button class="btn btn-primary" style="flex:1" onclick="postStory()">发布</button>
    </div>
  </div>
</div>

<div class="footer">最强模拟 · 话术仅供参考</div>

<script>
const SCENES = """ + json.dumps(SCENES) + r""";
let selectedScene = null;
let currentScript = null;

// ── Tab switching ──
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const idx = tab==='generate'?1:tab==='community'?2:tab==='stories'?3:4;
  document.querySelector(`.tab:nth-child(${idx})`).classList.add('active');
  document.getElementById('panel-'+tab).classList.add('active');
  if (tab==='community') refreshFeed();
  if (tab==='stories') refreshStories();
}

// ── Scene buttons ──
const scenesEl = document.getElementById('scenes');
Object.entries(SCENES).forEach(([key, scene]) => {
  const btn = document.createElement('button');
  btn.className = 'scene-btn';
  btn.innerHTML = `<span class="emj">${scene.name.slice(0,2)}</span>${scene.name.slice(2)}<div class="goal">${scene.goal}</div>`;
  btn.onclick = () => {
    document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); selectedScene = key;
    document.getElementById('gen-actions').style.display='block';
    document.getElementById('result').classList.remove('show');
    document.getElementById('result').innerHTML='';
    document.getElementById('training-chat').style.display='none';
    document.getElementById('training-chat').innerHTML='';
  };
  scenesEl.appendChild(btn);
});

// ── Generate ──
// ── Direct generate (skip training) ──
async function generateDirect() {
  if (!selectedScene) return;
  document.getElementById('gen-actions').style.display='none';
  document.getElementById('loading').classList.add('show');
  document.getElementById('result').classList.remove('show');
  try {
    const res = await fetch('/api/generate?scene='+selectedScene);
    currentScript = await res.json();
    if (currentScript.error) {
      document.getElementById('result').innerHTML = `<div class="card"><p style="color:#f87171">${currentScript.error}</p></div>`;
    } else {
      document.getElementById('result').innerHTML = renderScriptHTML(currentScript);
    }
  } catch(e) {
    document.getElementById('result').innerHTML = `<div class="card"><p style="color:#f87171">生成失败</p></div>`;
  }
  document.getElementById('loading').classList.remove('show');
  document.getElementById('result').classList.add('show');
}

// ── Guided Training: practice first, unlock script ──
let trainSession = null;
let trainTurnCount = 0;
const MAX_TRAIN_TURNS = 5;

async function startTraining() {
  if (!selectedScene) return;
  document.getElementById('gen-actions').style.display='none';
  document.getElementById('result').classList.remove('show');
  const chat = document.getElementById('training-chat');
  chat.style.display='block';
  chat.innerHTML = '<div class="loading show"><div class="spinner"></div><p style="color:#94a3b8">接通中...</p></div>';

  try {
    const res = await fetch('/api/roleplay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',scene:selectedScene})});
    const data = await res.json();
    trainSession = data.session;
    trainTurnCount = 0;
    const persona = SCENES[selectedScene]?.persona||'对方';
    chat.innerHTML = `
      <div style="text-align:center;margin-bottom:12px">
        <span style="background:rgba(56,189,248,.15);color:#38bdf8;padding:4px 12px;border-radius:12px;font-size:.8rem">🎯 实战训练 · ${persona}已接通</span>
        <span id="train-share-btn" style="margin-left:8px"><button class="btn btn-outline" style="width:auto;padding:3px 10px;font-size:.7rem" onclick="shareTraining()">🔗 分享给教练</button></span>
        <span id="train-code-display" style="display:none;color:#fbbf24;font-size:.75rem;margin-left:8px">码：<b id="train-code"></b></span>
      </div>
      <div id="train-coach-tips" style="display:none;margin-bottom:8px"></div>
      <div id="train-msgs" style="max-height:350px;overflow-y:auto;margin-bottom:10px">
        <div style="margin-bottom:8px">
          <div style="color:#94a3b8;font-size:.7rem;margin-bottom:2px">✆ ${persona}</div>
          <div style="background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.15);border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:.9rem;line-height:1.6">${data.message}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" style="flex:1;font-size:.85rem;padding:10px" onclick="endTraining()">📊 结束训练</button>
        <input id="train-input" type="text" placeholder="说你的台词..." style="flex:2;padding:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#e2e8f0;font-size:.85rem" onkeydown="if(event.key==='Enter')sendTrainTurn()">
        <button class="btn btn-primary" style="width:auto;padding:10px 16px;font-size:.85rem" onclick="sendTrainTurn()">发送</button>
      </div>`;
    document.getElementById('train-input').focus();
  } catch(e) { chat.innerHTML = '<p style="color:#f87171;text-align:center">连接失败</p>'; }
}

async function sendTrainTurn() {
  const input = document.getElementById('train-input');
  const msg = input.value.trim();
  if (!msg || !trainSession) return;
  input.value=''; input.disabled=true;
  trainTurnCount++;

  const msgs = document.getElementById('train-msgs');
  const persona = SCENES[selectedScene]?.persona||'对方';
  msgs.innerHTML += `<div style="margin-bottom:8px;text-align:right"><div style="color:#38bdf8;font-size:.7rem;margin-bottom:2px">你</div><div style="background:rgba(56,189,248,.08);border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:.9rem;text-align:left;display:inline-block">${msg}</div></div>`;
  msgs.innerHTML += '<div class="loading show" style="padding:4px"><div class="spinner" style="width:16px;height:16px;border-width:2px"></div></div>';
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const res = await fetch('/api/roleplay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'turn',session:trainSession,message:msg})});
    const data = await res.json();
    document.querySelector('#train-msgs .loading')?.remove();
    if (data.error) { toast(data.error); input.disabled=false; return; }
    msgs.innerHTML += `<div style="margin-bottom:8px"><div style="color:#94a3b8;font-size:.7rem;margin-bottom:2px">✆ ${persona}</div><div style="background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.15);border-radius:8px;padding:10px 12px;color:#e2e8f0;font-size:.9rem;line-height:1.6">${data.message}</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;

    // Show coach tips
    if (data.coach_tips && data.coach_tips.length > 0) {
      const tipsDiv = document.getElementById('train-coach-tips');
      tipsDiv.style.display='block';
      tipsDiv.innerHTML = data.coach_tips.map(t => `<div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.2);border-radius:6px;padding:5px 10px;margin-bottom:3px;color:#fbbf24;font-size:.76rem">💡 教练：${t.message}</div>`).join('');
    }

    // Auto-prompt to end after a few turns
    if (trainTurnCount >= MAX_TRAIN_TURNS) {
      msgs.innerHTML += `<div style="text-align:center;margin-top:10px;padding:8px;background:rgba(251,191,36,.1);border-radius:8px;color:#fbbf24;font-size:.8rem">💡 已经练了${trainTurnCount}轮，点击「结束训练」查看评分和完整剧本</div>`;
    }
  } catch(e) { toast('发送失败'); }
  input.disabled=false; input.focus();
}

async function endTraining() {
  if (!trainSession) return;
  const chat = document.getElementById('training-chat');
  chat.innerHTML = '<div class="loading show"><div class="spinner"></div><p style="color:#94a3b8">AI 正在评估你的表现并生成优化剧本...</p></div>';

  try {
    // Get feedback
    const fbRes = await fetch('/api/roleplay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end',session:trainSession})});
    const fb = await fbRes.json();
    trainSession = null;

    // Get the optimized script
    const scriptRes = await fetch('/api/generate?scene='+selectedScene);
    currentScript = await scriptRes.json();

    chat.style.display='none';
    const res = document.getElementById('result');
    const scoreColor = fb.score>=8?'#4ade80':fb.score>=6?'#fbbf24':'#f87171';
    const persona = SCENES[selectedScene]?.persona||'对方';

    res.innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:3rem;color:${scoreColor};font-weight:bold">${fb.score}<span style="font-size:1rem;color:#94a3b8">/10</span></div>
        <p style="color:#e2e8f0;margin-top:6px">${fb.summary||''}</p>
      </div>
      <div class="card">
        <h3 style="color:#4ade80;font-size:.8rem">👍 做得好的</h3>
        <ul class="tips-list">${(fb.good||[]).map(g=>`<li>${g}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h3 style="color:#f87171;font-size:.8rem">🔧 可以改进</h3>
        <ul class="tips-list">${(fb.improve||[]).map(i=>`<li>${i}</li>`).join('')}</ul>
      </div>
      <div class="card" id="phone-card" style="border:1px dashed rgba(251,191,36,.3);background:rgba(251,191,36,.04)">
        <h3 style="color:#fbbf24;font-size:.85rem;margin-bottom:8px">📱 保存你的训练记录</h3>
        <p style="color:#94a3b8;font-size:.8rem;margin-bottom:10px">留下手机号，我们会记录你的练习进度。新场景上线第一时间通知你。</p>
        <div style="display:flex;gap:8px">
          <input id="phone-input" type="tel" placeholder="输入手机号（选填）" style="flex:1;padding:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#e2e8f0;font-size:.85rem">
          <button class="btn btn-primary" style="width:auto;padding:10px 18px;font-size:.85rem" onclick="savePhone()">保存</button>
        </div>
        <p style="color:#64748b;font-size:.7rem;text-align:center;margin-top:6px;cursor:pointer" onclick="skipPhone()">跳过 → 直接看剧本</p>
      </div>
      <div id="script-reveal" style="display:none">
        <div style="text-align:center;padding:16px 0 8px">
          <div style="color:#38bdf8;font-size:.9rem;margin-bottom:8px">🔓 完整话术剧本已解锁 ↓</div>
        </div>
        ${renderScriptHTML(currentScript)}
      </div>
    `;
    res.classList.add('show');
  } catch(e) {
    chat.innerHTML = '<p style="color:#f87171;text-align:center">评估失败</p>';
  }
}

function renderScriptHTML(data) {
  const lines = Array.isArray(data.main_script) ? data.main_script : [data.main_script];
  let html = '';
  if (data.opening) html += `<div class="card"><div class="card-header"><h3>🎤 开场白</h3></div><div class="script-line hero">${fmt(data.opening)}</div></div>`;
  html += `<div class="card"><div class="card-header"><h3>📜 主体话术</h3></div>${lines.map(l=>`<div class="script-line">${fmt(l)}</div>`).join('')}</div>`;
  if (data.branches&&data.branches.length) html += `<div class="card"><div class="card-header"><h3>🔀 如果对方说...</h3></div>${data.branches.map(b=>`<div class="branch-item"><div class="branch-if">👉 ${b.if}</div><div class="branch-reply">💬 ${fmt(b.reply)}</div></div>`).join('')}</div>`;
  if (data.closing) html += `<div class="card"><div class="card-header"><h3>👋 结尾</h3></div><div class="script-line">${fmt(data.closing)}</div></div>`;
  if (data.tips&&data.tips.length) html += `<div class="card"><div class="card-header"><h3>💡 温馨提示</h3></div><ol class="tips-list">${data.tips.map(t=>`<li>${t}</li>`).join('')}</ol></div>`;
  html += `<div class="actions"><button class="btn btn-outline" style="flex:1" onclick="shareScript()">📤 分享到广场</button><button class="btn btn-primary" style="flex:1" onclick="regenerate()">🔄 换一版</button></div>`;
  return html;
}

async function regenerate() {
  document.getElementById('loading').classList.add('show');
  document.getElementById('result').classList.remove('show');
  try {
    const res = await fetch('/api/generate?scene='+selectedScene+'&retry=1');
    currentScript = await res.json();
    document.getElementById('result').innerHTML = renderScriptHTML(currentScript);
  } catch(e) { toast('重试失败'); }
  document.getElementById('loading').classList.remove('show');
  document.getElementById('result').classList.add('show');
}

async function shareScript() {
  if (!currentScript || !selectedScene) return toast('先生成话术');
  try {
    const res = await fetch('/api/share', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({scene:selectedScene, script:currentScript})
    });
    if (res.ok) toast('✅ 已分享到广场！');
    else toast('分享失败');
  } catch(e) { toast('网络错误'); }
}

function fmt(text) { return text.replace(/【([^】]+)】/g, '<span class="tone">【$1】</span>'); }

// ── Community Feed ──
async function refreshFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
  try {
    const res = await fetch('/api/community');
    const data = await res.json();
    feed.innerHTML = '';
    const items = (data.scripts||[]).sort((a,b)=>b.votes-a.votes).slice(0,20);
    if (!items.length) {feed.innerHTML='<div class="empty-state"><div class="icon">📭</div><p>还没有人分享话术</p></div>';return;}
    items.forEach(item => {
      feed.innerHTML += `
        <div class="feed-item">
          <div class="feed-header"><span class="feed-scene">${SCENES[item.scene]?.name||item.scene}</span><span class="feed-time">${timeAgo(item.time)}</span></div>
          <div class="feed-script">${item.preview}</div>
          <div class="feed-footer">
            <button class="feed-btn" onclick="voteScript('${item.id}')">🔼 <span class="num">${item.votes}</span></button>
            <button class="feed-btn ${item.replayed?'replayed':''}" onclick="replayScript('${item.id}')">📢 转播 <span class="num">${item.replays||0}</span></button>
          </div>
        </div>`;
    });
  } catch(e) { feed.innerHTML='<div class="empty-state"><p>加载失败</p></div>'; }
}

async function voteScript(id) {
  await fetch('/api/vote', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  refreshFeed();
}

async function replayScript(id) {
  await fetch('/api/replay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  toast('📢 已转播');
  refreshFeed();
}

// ── Stories ──
async function refreshStories() {
  const feed = document.getElementById('story-feed');
  feed.innerHTML = '<div class="loading show"><div class="spinner"></div></div>';
  try {
    const res = await fetch('/api/community');
    const data = await res.json();
    feed.innerHTML = '';
    const stories = (data.stories||[]).sort((a,b)=>b.time-a.time).slice(0,30);
    if (!stories.length) {feed.innerHTML='<div class="empty-state"><div class="icon">💬</div><p>还没有成功故事，来写第一个！</p></div>';return;}
    stories.forEach(s => {
      feed.innerHTML += `<div class="story-item"><div class="story-content">${s.text}</div><div class="story-footer"><span class="story-scene">🗣️ 匿名网友</span><span class="story-time">${timeAgo(s.time)}</span></div></div>`;
    });
  } catch(e) { feed.innerHTML='<div class="empty-state"><p>加载失败</p></div>'; }
}

function showStoryModal() { document.getElementById('storyModal').classList.add('show'); }
function closeStoryModal() { document.getElementById('storyModal').classList.remove('show'); document.getElementById('storyText').value=''; }

async function postStory() {
  const text = document.getElementById('storyText').value.trim();
  if (!text) return toast('写点什么吧');
  await fetch('/api/story', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
  closeStoryModal();
  toast('✅ 已发布（匿名）');
  refreshStories();
}

// ── Role-Play Simulation ──
let rpSession = null;

async function startRoleplay() {
  const scene = document.getElementById('rp-scene').value;
  document.getElementById('rp-setup').style.display='none';
  document.getElementById('rp-chat').style.display='block';
  document.getElementById('rp-feedback').style.display='none';
  document.getElementById('rp-messages').innerHTML='<div class="loading show"><div class="spinner"></div><p style="color:#94a3b8">接通中...</p></div>';

  try {
    const res = await fetch('/api/roleplay', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'start', scene})
    });
    const data = await res.json();
    rpSession = data.session;
    document.getElementById('rp-info').textContent = `对方：${data.role}  |  场景：${SCENES[scene]?.name}`;
    document.getElementById('rp-messages').innerHTML = `
      <div style="margin-bottom:10px">
        <div style="color:#94a3b8;font-size:.75rem;margin-bottom:3px">✆ ${data.role} 接起电话</div>
        <div class="script-line" style="background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.15)">${data.message}</div>
      </div>`;
    document.getElementById('rp-input').focus();
  } catch(e) { toast('连接失败'); }
}

async function sendRoleplayTurn() {
  const input = document.getElementById('rp-input');
  const msg = input.value.trim();
  if (!msg || !rpSession) return;
  input.value=''; input.disabled=true;

  const msgs = document.getElementById('rp-messages');
  msgs.innerHTML += `<div style="margin-bottom:10px;text-align:right">
    <div style="color:#38bdf8;font-size:.75rem;margin-bottom:3px">你 说</div>
    <div class="script-line" style="background:rgba(56,189,248,.08);text-align:left;display:inline-block">${msg}</div>
  </div>`;
  msgs.innerHTML += '<div class="loading show" style="padding:8px"><div class="spinner" style="width:20px;height:20px;border-width:2px"></div></div>';
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const res = await fetch('/api/roleplay', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'turn', session:rpSession, message:msg})
    });
    const data = await res.json();
    document.querySelector('#rp-messages .loading').remove();
    if (data.error) { toast(data.error); return; }
    msgs.innerHTML += `<div style="margin-bottom:10px">
      <div style="color:#94a3b8;font-size:.75rem;margin-bottom:3px">✆ 对方 说</div>
      <div class="script-line" style="background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.15)">${data.message}</div>
    </div>`;
    msgs.scrollTop = msgs.scrollHeight;
  } catch(e) { toast('发送失败'); }
  input.disabled=false; input.focus();
}

async function endRoleplay() {
  if (!rpSession) return;
  document.getElementById('rp-input').disabled=true;
  document.getElementById('rp-messages').innerHTML += '<div class="loading show" style="padding:8px"><div class="spinner" style="width:20px;height:20px;border-width:2px"></div><p style="color:#94a3b8;font-size:.8rem">AI 正在评估...</p></div>';

  try {
    const res = await fetch('/api/roleplay', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'end', session:rpSession})
    });
    const data = await res.json();
    rpSession = null;
    document.getElementById('rp-chat').style.display='none';

    const fb = document.getElementById('rp-feedback');
    fb.style.display='block';
    const scoreColor = data.score>=8?'#4ade80':data.score>=6?'#fbbf24':'#f87171';
    fb.innerHTML = `
      <div class="card">
        <div style="text-align:center;padding:10px 0">
          <div style="font-size:3rem;color:${scoreColor};font-weight:bold">${data.score}<span style="font-size:1rem;color:#94a3b8">/10</span></div>
          <p style="color:#e2e8f0;margin-top:8px">${data.summary||''}</p>
        </div>
      </div>
      <div class="card">
        <h3 style="color:#4ade80;font-size:.85rem">👍 做得好的</h3>
        <ul class="tips-list">${(data.good||[]).map(g=>`<li style="color:#94a3b8">${g}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h3 style="color:#f87171;font-size:.85rem">🔧 可以改进</h3>
        <ul class="tips-list">${(data.improve||[]).map(i=>`<li style="color:#94a3b8">${i}</li>`).join('')}</ul>
      </div>
      <button class="btn btn-primary" onclick="resetRoleplay()">🔄 再练一次</button>
    `;
  } catch(e) { toast('评估失败'); }
}

// ── Coach 1-on-1 Relay ──
let coachCode = null;
let coachPollTimer = null;

async function shareTraining() {
  if (!trainSession) return;
  try {
    const res = await fetch('/api/roleplay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'share',session:trainSession})});
    const data = await res.json();
    if (data.share_code) {
      document.getElementById('train-code').textContent = data.share_code;
      document.getElementById('train-code-display').style.display='inline';
      document.getElementById('train-share-btn').style.display='none';
      toast('✅ 分享码：'+data.share_code);
    }
  } catch(e) { toast('分享失败'); }
}

async function joinCoach() {
  const code = document.getElementById('coach-code-input').value.trim().toUpperCase();
  if (!code) return toast('输入分享码');
  coachCode = code;
  document.getElementById('coach-join').style.display='none';
  document.getElementById('rp-setup').style.display='none';
  document.getElementById('coach-view').style.display='block';
  coachPoll();
  coachPollTimer = setInterval(coachPoll, 2000);
}

async function coachPoll() {
  if (!coachCode) return;
  try {
    const res = await fetch('/api/coach/watch?code='+coachCode);
    const data = await res.json();
    if (data.error || !data.active) {
      clearInterval(coachPollTimer);
      document.getElementById('coach-view').innerHTML = '<div class="card"><p style="color:#94a3b8;text-align:center">会话已结束</p><button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="leaveCoach()">返回</button></div>';
      return;
    }
    const msgs = document.getElementById('coach-msgs');
    msgs.innerHTML = '<div style="text-align:center;margin-bottom:6px"><span style="background:rgba(56,189,248,.15);color:#38bdf8;padding:2px 10px;border-radius:10px;font-size:.72rem">'+data.persona+' · 实时对话</span></div>';
    data.messages.forEach(m => {
      const color = m.role==='对方'?'rgba(129,140,248,.08)':'rgba(56,189,248,.08)';
      const border = m.role==='对方'?'border:1px solid rgba(129,140,248,.15)':'';
      msgs.innerHTML += `<div style="margin-bottom:6px"><span style="color:#94a3b8;font-size:.65rem">${m.role}</span><div style="background:${color};${border}border-radius:6px;padding:6px 10px;color:#e2e8f0;font-size:.82rem;line-height:1.5">${m.content}</div></div>`;
    });
    msgs.scrollTop = msgs.scrollHeight;
  } catch(e) {}
}

async function sendCoachTip() {
  const input = document.getElementById('coach-tip-input');
  const msg = input.value.trim();
  if (!msg || !coachCode) return;
  input.value='';
  await fetch('/api/roleplay', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'coach_tip',code:coachCode,message:msg})});
  toast('💡 提示已发送');
}

function leaveCoach() {
  clearInterval(coachPollTimer);
  coachCode = null;
  document.getElementById('coach-join').style.display='block';
  document.getElementById('rp-setup').style.display='block';
  document.getElementById('coach-view').style.display='none';
  document.getElementById('coach-msgs').innerHTML='';
}

function resetRoleplay() {
  rpSession = null;
  document.getElementById('rp-chat').style.display='none';
  document.getElementById('rp-feedback').style.display='none';
  document.getElementById('rp-setup').style.display='block';
  document.getElementById('rp-messages').innerHTML='';
}

// ── Phone Collection ──
async function savePhone() {
  const phone = document.getElementById('phone-input').value.trim();
  if (!phone || !/^1\d{10}$/.test(phone)) { toast('请输入有效的手机号'); return; }
  try {
    await fetch('/api/phone', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone, scene:selectedScene})});
    document.getElementById('phone-card').style.display='none';
    document.getElementById('script-reveal').style.display='block';
    toast('✅ 已保存！');
  } catch(e) { toast('保存失败'); }
}
function skipPhone() {
  document.getElementById('phone-card').style.display='none';
  document.getElementById('script-reveal').style.display='block';
}

// ── Utils ──
function timeAgo(ts) {
  const diff = Math.floor((Date.now()/1000) - ts);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff/60)+'分钟前';
  if (diff < 86400) return Math.floor(diff/3600)+'小时前';
  return Math.floor(diff/86400)+'天前';
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2000);
}
</script>
</body>
</html>"""

# ── Server ──
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        p = urlparse(self.path)
        if p.path in ["/", "/index.html"]:
            self._html(HTML)
        elif p.path == "/api/generate":
            params = parse_qs(p.query)
            scene = params.get("scene", [None])[0]
            if not scene or scene not in SCENES:
                self._json({"error": "请选择场景"})
                return
            data = generate_script(scene)
            self._json(data)
        elif p.path == "/api/community":
            self._json(load_community())
        elif p.path == "/api/coach/watch":
            params = parse_qs(p.query)
            self._json(coach_watch(params.get("code", [""])[0]))
        else:
            self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length > 0 else {}
        data = load_community()

        p = urlparse(self.path)
        if p.path == "/api/share":
            sid = str(uuid.uuid4())[:8]
            script = body.get("script", {})
            scene = body.get("scene", "")
            preview = (script.get("opening", "") + " " + " ".join(script.get("main_script", [])))[:120]
            data["scripts"].append({
                "id": sid, "scene": scene, "preview": preview,
                "votes": 0, "replays": 0, "time": time.time()
            })
            save_community(data)
            self._json({"ok": True, "id": sid})
        elif p.path == "/api/vote":
            for s in data["scripts"]:
                if s["id"] == body.get("id"):
                    s["votes"] = s.get("votes", 0) + 1
            save_community(data)
            self._json({"ok": True})
        elif p.path == "/api/replay":
            for s in data["scripts"]:
                if s["id"] == body.get("id"):
                    s["replays"] = s.get("replays", 0) + 1
            save_community(data)
            self._json({"ok": True})
        elif p.path == "/api/story":
            data["stories"].append({"text": body.get("text", ""), "time": time.time()})
            save_community(data)
            self._json({"ok": True})
        elif p.path == "/api/phone":
            phone = body.get("phone", "").strip()
            scene = body.get("scene", "")
            data.setdefault("phones", [])
            data["phones"].append({"phone": phone, "scene": scene, "time": time.time()})
            save_community(data)
            self._json({"ok": True, "count": len(data["phones"])})
        elif p.path == "/api/roleplay":
            action = body.get("action", "")
            if action == "start":
                self._json(roleplay_start(body.get("scene", "salary"), body.get("share", False)))
            elif action == "turn":
                self._json(roleplay_turn(body.get("session", ""), body.get("message", "")))
            elif action == "end":
                self._json(roleplay_end(body.get("session", "")))
            elif action == "share":
                self._json(roleplay_share(body.get("session", "")))
            elif action == "coach_tip":
                self._json(coach_tip(body.get("code", ""), body.get("message", "")))
            else:
                self._json({"error": "Unknown action"})
        else:
            self.send_error(404)

    def _html(self, content):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(content.encode("utf-8"))

    def _json(self, data):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def log_message(self, format, *args):
        print(f"[{args[0]}] {args[1]} {args[2]}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    print(f"\n📞 最强模拟 启动！")
    print(f"   浏览器打开 → http://localhost:{port}")
    print(f"   社区数据: {DATA_FILE}\n")
    server = HTTPServer(("0.0.0.0", port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Bye!")
        server.shutdown()
