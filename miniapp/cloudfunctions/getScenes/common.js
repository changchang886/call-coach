// 云函数共享代码（自包含）
const SCENES = {
  salary:   { emoji: '💰', name: '💰 谈薪资',   goal: '和领导谈加薪/谈期望薪资', persona: '领导/HR',   vibe: '自信而不冒犯' },
  resign:   { emoji: '🚪', name: '🚪 提离职',   goal: '体面地提出离职',         persona: '领导',       vibe: '坚定但不敌对' },
  debt:     { emoji: '💸', name: '💸 催还款',   goal: '催朋友/同事还欠款',     persona: '朋友/同事',  vibe: '不伤和气但无法推脱' },
  leave:    { emoji: '📅', name: '📅 请假',     goal: '向领导请假',             persona: '领导',       vibe: '合理合法，提前安排交接' },
  overtime: { emoji: '❌', name: '❌ 拒绝加班', goal: '拒绝不合理加班',         persona: '领导/同事',  vibe: '坚定但有替代方案' },
  deposit:  { emoji: '🏠', name: '🏠 退押金',   goal: '向房东要回押金',         persona: '房东',       vibe: '有理有据，引用合同' },
}

function getScene(key) { return SCENES[key] || null }

// ─── AI 配置：优先数据库，兜底硬编码 ───
const FALLBACK_KEY  = 'sk-98dc6f4f0a0f4f819c3575546396f86c'
const FALLBACK_URL  = 'https://api.deepseek.com'
const FALLBACK_MODEL = 'deepseek-chat'

let _configCache = null
let _configSource = null  // 'db' | 'fallback'

async function getConfig() {
  if (_configCache && _configCache.apiKey) return _configCache

  // 尝试从数据库读取
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const db = cloud.database()
    const res = await db.collection('config').doc('ai').get()
    if (res.data && res.data.apiKey) {
      _configCache = res.data
      _configSource = 'db'
      console.log('✅ AI Key 来源：云数据库 config/ai')
      return _configCache
    }
    console.warn('⚠️ config/ai 文档缺少 apiKey 字段')
  } catch (e) {
    console.warn('⚠️ 数据库读取失败，使用兜底 Key:', e.message)
  }

  // 兜底：硬编码
  _configCache = { apiKey: FALLBACK_KEY, baseURL: FALLBACK_URL, model: FALLBACK_MODEL }
  _configSource = 'fallback'
  console.log('⚡ AI Key 来源：硬编码兜底')
  return _configCache
}

let _openai = null
async function getOpenAI() {
  if (!_openai) {
    const cfg = await getConfig()
    const OpenAI = require('openai')
    _openai = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL || FALLBACK_URL
    })
    console.log('🔗 OpenAI 客户端已初始化, 来源:', _configSource)
  }
  return _openai
}

async function aiChat(messages, opts = {}) {
  const cfg = await getConfig()
  const ai = await getOpenAI()
  console.log('📡 调用 AI, model:', cfg.model || FALLBACK_MODEL)
  const resp = await ai.chat.completions.create({
    model: cfg.model || FALLBACK_MODEL,
    messages,
    max_tokens: opts.max_tokens || 400,
    temperature: opts.temperature ?? 0.7,
  })
  return resp.choices[0].message.content.trim()
}

async function aiChatJSON(messages, opts = {}) {
  const text = await aiChat(messages, { ...opts, max_tokens: opts.max_tokens || 1200 })
  const m = text.match(/\{[\s\S]*\}/)
  if (m) return JSON.parse(m[0])
  throw new Error('JSON 解析失败')
}

module.exports = { SCENES, getScene, aiChat, aiChatJSON }
