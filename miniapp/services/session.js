/**
 * 会话管理 —— 封装云数据库读写
 */
function getDB() {
  const cloud = require('wx-server-sdk')
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
  return cloud.database()
}

/** 创建会话 */
async function create(data) {
  const db = getDB()
  const res = await db.collection('sessions').add({
    data: { ...data, createdAt: Date.now() }
  })
  return res._id
}

/** 读取会话 */
async function get(sessionId) {
  const db = getDB()
  const doc = await db.collection('sessions').doc(sessionId).get()
  return doc.data
}

/** 更新会话 */
async function update(sessionId, data) {
  const db = getDB()
  await db.collection('sessions').doc(sessionId).update({ data })
}

/** 删除会话 */
async function remove(sessionId) {
  const db = getDB()
  await db.collection('sessions').doc(sessionId).remove()
}

module.exports = { create, get, update, remove }
