/**
 * API 层 —— 云函数封装（重构版）
 * 后续可平滑迁移到微信原生 AI 直连
 */

function callCloud(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name, data: data || {} })
      .then(res => {
        if (res.result && res.result.error) {
          reject(new Error(res.result.error))
        } else {
          resolve(res.result)
        }
      })
      .catch(reject)
  })
}

module.exports = { callCloud }
