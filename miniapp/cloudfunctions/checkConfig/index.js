// 🔍 一键诊断云函数 —— 检查所有配置
exports.main = async () => {
  const results = []

  // 1. 检查云开发初始化
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    results.push({ check: '云开发初始化', status: '✅', detail: cloud.DYNAMIC_CURRENT_ENV || 'ok' })
  } catch (e) {
    results.push({ check: '云开发初始化', status: '❌', detail: e.message })
    return { results, summary: '云开发初始化失败，请检查云环境' }
  }

  // 2. 检查数据库连接
  let db
  try {
    const cloud2 = require('wx-server-sdk')
    cloud2.init({ env: cloud2.DYNAMIC_CURRENT_ENV })
    db = cloud2.database()
    await db.collection('config').count()
    results.push({ check: '数据库连接', status: '✅', detail: '连接正常' })
  } catch (e) {
    results.push({ check: '数据库连接', status: '❌', detail: e.message })
    return { results, summary: '数据库不可用' }
  }

  // 3. 检查 config 集合
  try {
    const c = await db.collection('config').count()
    results.push({ check: 'config 集合', status: '✅', detail: `存在, ${c.total} 条记录` })
  } catch (e) {
    results.push({ check: 'config 集合', status: '❌', detail: '集合不存在，需创建' })
  }

  // 4. 检查 ai 文档
  try {
    const doc = await db.collection('config').doc('ai').get()
    if (doc.data && doc.data.apiKey) {
      results.push({ check: 'config/ai 文档', status: '✅', detail: 'apiKey=' + doc.data.apiKey.slice(0, 10) + '...' })
    } else {
      results.push({ check: 'config/ai 文档', status: '⚠️', detail: '文档存在但缺少 apiKey 字段' })
    }
  } catch (e) {
    results.push({ check: 'config/ai 文档', status: '❌', detail: '文档不存在，需手动添加 _id="ai"' })
  }

  // 5. 检查 sessions 集合
  try {
    await db.collection('sessions').count()
    results.push({ check: 'sessions 集合', status: '✅', detail: '存在' })
  } catch (e) {
    results.push({ check: 'sessions 集合', status: '❌', detail: '需创建' })
  }

  // 6. 检查 OpenAI 包
  try {
    require('openai')
    results.push({ check: 'openai 依赖', status: '✅', detail: '已安装' })
  } catch (e) {
    results.push({ check: 'openai 依赖', status: '❌', detail: '需云端安装依赖' })
  }

  // 7. 测试 AI 调用
  try {
    const OpenAI = require('openai')
    const ai = new OpenAI({
      apiKey: 'sk-98dc6f4f0a0f4f819c3575546396f86c',
      baseURL: 'https://api.deepseek.com'
    })
    const resp = await ai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '回复一个字：好' }],
      max_tokens: 10
    })
    results.push({ check: 'AI API 连通', status: '✅', detail: 'DeepSeek 响应正常' })
  } catch (e) {
    results.push({ check: 'AI API 连通', status: '❌', detail: e.message.slice(0, 80) })
  }

  const failCount = results.filter(r => r.status === '❌').length
  return {
    results,
    summary: failCount === 0 ? '🎉 全部通过！' : `⚠️ ${failCount} 项异常`
  }
}
