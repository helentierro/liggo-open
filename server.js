import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, 'historial.json')
const PORT = process.env.PORT || 3001
const app = express()
app.use(express.json({ limit: '15mb' }))

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const STYLE_PROMPTS = {
  gracioso: 'gracioso y con humor, capaz de arrancar una risa sin parecer forzado',
  coquetear: 'coqueto y atractivo, con sutileza y confianza',
  provocativo: 'provocativo y atrevido, sin pasarse de la raya',
  enamorar: 'cariñoso y dulce, mostrando interés genuino',
  salvada: 'una salvada épica que recupere la conversación con ingenio',
}

function buildPrompt(styleId, chatText) {
  const style = STYLE_PROMPTS[styleId] || STYLE_PROMPTS.gracioso
  return `Eres un experto en conversaciones de apps de citas (Tinder, Instagram, WhatsApp). Analiza el siguiente chat${chatText ? '' : ' de la imagen adjunta'} y genera exactamente 4 respuestas distintas en español, en un tono ${style}. Cada respuesta debe sonar natural y humana, lista para copiar y enviar. Devuelve solo las 4 respuestas, una por línea, numeradas del 1 al 4, sin explicaciones.${chatText ? `\n\nCHAT:\n${chatText}` : ''}`
}

function parseResponses(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)\-:]\s*/, '').trim())
    .filter((l) => l.length > 2)
    .slice(0, 6)
}

async function callGemini(apiKey, prompt, image) {
  const parts = [{ text: prompt }]
  if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.base64 } })
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Error de Gemini')
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callOpenAICompatible(url, apiKey, model, prompt, image, extraHeaders = {}) {
  const content = [{ type: 'text', text: prompt }]
  if (image) content.push({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...extraHeaders },
    body: JSON.stringify({ model, messages: [{ role: 'user', content }], temperature: 0.9 }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Error ${res.status}`)
  return data.choices?.[0]?.message?.content || ''
}

const PROVIDERS = {
  gemini: { key: () => process.env.GEMINI_KEY || process.env.VITE_GEMINI_KEY },
  groq: { key: () => process.env.GROQ_KEY || process.env.VITE_GROQ_KEY },
  openrouter: { key: () => process.env.OPENROUTER_KEY || process.env.VITE_OPENROUTER_KEY },
}

app.post('/api/respuestas', async (req, res) => {
  const { proveedor, estilo, chatTexto, imagenBase64, imagenMime } = req.body || {}
  const image = imagenBase64 ? { base64: imagenBase64, mime: imagenMime || 'image/jpeg' } : null
  try {
    const prompt = buildPrompt(estilo, chatTexto || '')
    let text = ''
    if (proveedor === 'gemini') {
      text = await callGemini(PROVIDERS.gemini.key(), prompt, image)
    } else if (proveedor === 'groq') {
      text = await callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', PROVIDERS.groq.key(), 'qwen/qwen3.8-27b', prompt, image)
    } else if (proveedor === 'openrouter') {
      text = await callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', PROVIDERS.openrouter.key(), 'qwen/qwen3.8-27b:free', prompt, image, { 'HTTP-Referer': 'http://localhost' })
    } else {
      return res.status(400).json({ error: 'Proveedor desconocido' })
    }
    const respuestas = parseResponses(text)
    if (respuestas.length === 0) return res.status(502).json({ error: 'La IA no devolvió respuestas' })
    res.json({ respuestas })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const historialOn = process.env.HISTORIAL === '1'

if (historialOn) {
  const DB_BAK = path.join(__dirname, 'historial.backup.json')
  const MAX_ITEMS = 50

  function readDb() {
    try {
      return JSON.parse(fs.readFileSync(DB, 'utf-8'))
    } catch (err) {
      if (err.code !== 'ENOENT') {
        try {
          const backup = JSON.parse(fs.readFileSync(DB_BAK, 'utf-8'))
          console.log('historial.json corrupto: recuperado desde historial.backup.json')
          return backup
        } catch {
          console.log('historial.json ilegible y sin respaldo: se empieza de cero')
        }
      }
      return []
    }
  }

  function writeDb(data) {
    if (fs.existsSync(DB)) fs.copyFileSync(DB, DB_BAK)
    fs.writeFileSync(DB, JSON.stringify(data, null, 2))
  }

  app.get('/api/historial', (req, res) => res.json(readDb()))
  app.post('/api/historial', (req, res) => {
    const items = readDb()
    const total = items.length + 1
    items.unshift({ ...req.body, id: Date.now() })
    writeDb(items.slice(0, MAX_ITEMS))
    res.json({ ok: true, total, guardadas: Math.min(total, MAX_ITEMS) })
  })
  app.delete('/api/historial/:id', (req, res) => {
    writeDb(readDb().filter((i) => String(i.id) !== req.params.id))
    res.json({ ok: true })
  })
  app.delete('/api/historial', (req, res) => {
    writeDb([])
    res.json({ ok: true })
  })
} else {
  app.get('/api/historial', (req, res) => res.status(404).end())
  app.post('/api/historial', (req, res) => res.status(404).end())
  app.delete('/api/historial', (req, res) => res.status(404).end())
}

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Liggo Open server en http://localhost:${PORT}`))