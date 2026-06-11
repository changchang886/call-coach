const https = require('https')
const crypto = require('crypto')

// 从 keys.js 读取密钥（不会被提交到 git）
let SECRET_ID, SECRET_KEY
try {
  const keys = require('./keys')
  SECRET_ID  = keys.secretId  || ''
  SECRET_KEY = keys.secretKey || ''
} catch (_) {
  SECRET_ID = ''; SECRET_KEY = ''
}

const ASR_HOST = 'asr.tencentcloudapi.com'

function sha256Hex(s) { return crypto.createHash('sha256').update(s).digest('hex') }
function hmacSha256(key, msg) { return crypto.createHmac('sha256', key).update(msg).digest() }

function tc3Sign(key, date, svc, str) {
  const k = hmacSha256(hmacSha256(hmacSha256('TC3' + key, date), svc), 'tc3_request')
  return hmacSha256(k, str).toString('hex')
}

function callASR(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const ts = Math.floor(Date.now() / 1000)
    const date = new Date(ts * 1000).toISOString().split('T')[0]
    const ct = 'application/json'
    const sh = 'content-type;host'
    const ch = `content-type:${ct}\nhost:${ASR_HOST}\n`
    const hp = sha256Hex(body)
    const cr = `POST\n/\n\n${ch}\n${sh}\n${hp}`
    const cs = `${date}/asr/tc3_request`
    const sts = `TC3-HMAC-SHA256\n${ts}\n${cs}\n${sha256Hex(cr)}`
    const sig = tc3Sign(SECRET_KEY, date, 'asr', sts)
    const auth = `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${cs}, SignedHeaders=${sh}, Signature=${sig}`

    const req = https.request({
      hostname: ASR_HOST, method: 'POST',
      headers: {
        'Content-Type': ct, 'Host': ASR_HOST,
        'X-TC-Action': 'SentenceRecognition', 'X-TC-Version': '2019-06-14',
        'X-TC-Timestamp': String(ts), 'Authorization': auth,
        'Content-Length': Buffer.byteLength(body)
      }, timeout: 15000
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(d)
          if (j.Response.Error) reject(new Error(j.Response.Error.Message))
          else resolve(j.Response.Result || '')
        } catch (e) { reject(new Error('解析失败')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')) })
    req.write(body); req.end()
  })
}

exports.main = async (event) => {
  const { fileID } = event
  if (!fileID) return { error: '缺少 fileID' }
  if (!SECRET_ID || !SECRET_KEY) return { error: '请先配置腾讯云语音识别密钥' }

  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    const res = await cloud.downloadFile({ fileID })
    const buf = res.fileContent
    if (!buf || buf.length === 0) return { error: '音频为空' }

    const text = await callASR({
      EngSerViceType: '16k_zh', SourceType: 1,
      VoiceFormat: 'mp3', Data: buf.toString('base64'), DataLen: buf.length
    })
    return { text }
  } catch (e) {
    return { error: '识别失败: ' + e.message }
  }
}
