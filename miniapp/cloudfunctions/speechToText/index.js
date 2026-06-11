const https = require('https')
const crypto = require('crypto')

let SECRET_ID, SECRET_KEY
try { const keys = require('./keys'); SECRET_ID = keys.secretId || ''; SECRET_KEY = keys.secretKey || '' }
catch (_) { SECRET_ID = ''; SECRET_KEY = '' }

const ASR_HOST = 'asr.tencentcloudapi.com'

function sha256Hex(s) { return crypto.createHash('sha256').update(s).digest('hex') }
function hmacSha256(key, msg) { return crypto.createHmac('sha256', key).update(msg).digest() }

function callASR(payload) {
  return new Promise((resolve, reject) => {
    try {
      const body = JSON.stringify(payload)
      const ts = Math.floor(Date.now() / 1000)
      const date = new Date(ts * 1000).toISOString().split('T')[0]
      const ct = 'application/json'; const sh = 'content-type;host'
      const ch = `content-type:${ct}\nhost:${ASR_HOST}\n`
      const cr = `POST\n/\n\n${ch}\n${sh}\n${sha256Hex(body)}`
      const cs = `${date}/asr/tc3_request`
      const sts = `TC3-HMAC-SHA256\n${ts}\n${cs}\n${sha256Hex(cr)}`
      const kd = hmacSha256('TC3' + SECRET_KEY, date)
      const ks = hmacSha256(kd, 'asr')
      const kw = hmacSha256(ks, 'tc3_request')
      const sig = hmacSha256(kw, sts).toString('hex')
      const auth = `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${cs}, SignedHeaders=${sh}, Signature=${sig}`

      const req = https.request({
        hostname: ASR_HOST, method: 'POST',
        headers: { 'Content-Type': ct, 'Host': ASR_HOST, 'X-TC-Action': 'SentenceRecognition', 'X-TC-Version': '2019-06-14', 'X-TC-Timestamp': String(ts), 'Authorization': auth, 'Content-Length': Buffer.byteLength(body) },
        timeout: 20000
      }, res => {
        let d = ''
        res.on('data', c => d += c)
        res.on('end', () => {
          try {
            const j = JSON.parse(d)
            if (j.Response.Error) reject(new Error(j.Response.Error.Code + ': ' + j.Response.Error.Message))
            else resolve(j.Response.Result || '')
          } catch (e) { reject(new Error('解析响应失败: ' + d.slice(0,300))) }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('ASR请求超时')) })
      req.write(body); req.end()
    } catch(e) { reject(e) }
  })
}

exports.main = async (event) => {
  const { fileID } = event
  if (!fileID) return { error: '缺少 fileID' }
  if (!SECRET_ID || !SECRET_KEY) return { error: '未配置腾讯云密钥(keys.js)' }

  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const res = await cloud.downloadFile({ fileID })
    const buf = res.fileContent
    if (!buf || buf.length === 0) return { error: '音频文件为空' }

    // PCM 16kHz mono
    const text = await callASR({
      EngSerViceType: '16k_zh',
      SourceType: 1,
      VoiceFormat: 'pcm',
      Data: buf.toString('base64'),
      DataLen: buf.length
    })
    return { text }
  } catch (e) {
    return { error: '识别失败: ' + e.message }
  }
}
