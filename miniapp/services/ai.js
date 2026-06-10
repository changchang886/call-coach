/**
 * AI 服务层
 * 优先使用微信小程序原生 AI 能力，fallback 到 DeepSeek API
 */

const AI_PROVIDER = process.env.AI_PROVIDER || 'wechat' // 'wechat' | 'deepseek'

// ── DeepSeek fallback ──
let _openai = null
function getOpenAI() {
  if (!_openai) {
    const OpenAI = require('openai')
    _openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    })
  }
  return _openai
}

/**
 * 调用微信原生 AI（小程序端直接调用，不经过云函数）
 * 微信 2024+ 版本支持 wx.ai.* 系列 API
 */
async function callWechatAI(messages, options = {}) {
  // 微信小程序端 AI 接口
  // 参考文档：https://developers.weixin.qq.com/miniprogram/dev/api/ai/wx.ai.chat.html
  if (typeof wx !== 'undefined' && wx.ai && wx.ai.chat) {
    const res = await wx.ai.chat({
      messages,
      model: options.model || 'default',
      max_tokens: options.max_tokens || 400,
      temperature: options.temperature ?? 0.7,
    })
    return res.content || res.message?.content || ''
  }
  throw new Error('微信 AI 不可用，请使用云函数模式')
}

/**
 * 调用 DeepSeek API（云函数端）
 */
async function callDeepSeek(messages, options = {}) {
  const client = getOpenAI()
  if (!client) throw new Error('DeepSeek API Key 未配置')
  const resp = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages,
    max_tokens: options.max_tokens || 400,
    temperature: options.temperature ?? 0.7,
  })
  return resp.choices[0].message.content.trim()
}

/**
 * 统一 AI 调用入口
 * @param {Array} messages - OpenAI 格式的消息列表
 * @param {Object} options - { model, max_tokens, temperature, provider }
 * @returns {string} AI 回复文本
 */
async function chat(messages, options = {}) {
  const provider = options.provider || AI_PROVIDER

  if (provider === 'wechat') {
    try {
      return await callWechatAI(messages, options)
    } catch (e) {
      console.warn('微信 AI 调用失败，fallback 到 DeepSeek:', e.message)
      return await callDeepSeek(messages, options)
    }
  }

  return await callDeepSeek(messages, options)
}

/**
 * 调用 AI 并解析 JSON 返回
 */
async function chatJSON(messages, options = {}) {
  const text = await chat(messages, { ...options, max_tokens: options.max_tokens || 1200 })
  const m = text.match(/\{[\s\S]*\}/)
  if (m) return JSON.parse(m[0])
  throw new Error('AI 返回非 JSON 格式')
}

module.exports = { chat, chatJSON }
