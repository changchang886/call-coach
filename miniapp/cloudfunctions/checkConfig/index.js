const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  try {
    // 列出所有集合
    const cols = await db.listCollections()
    // 读 config 集合所有文档
    let configDocs = []
    try {
      const res = await db.collection("config").get()
      configDocs = res.data
    } catch (e) {
      return { ok: false, error: "读config失败: " + e.message }
    }
    return {
      ok: true,
      collections: cols.collections.map(c => c.name),
      configDocs: configDocs
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
