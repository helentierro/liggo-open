const STYLE_PROMPTS = {
  gracioso: "gracioso y con humor, capaz de arrancar una risa sin parecer forzado",
  coquetear: "coqueto y atractivo, con sutileza y confianza",
  provocativo: "provocativo y atrevido, sin pasarse de la raya",
  enamorar: "cariñoso y dulce, mostrando interés genuino",
  salvada: "una salvada épica que recupere la conversación con ingenio",
}

export const STYLES = [
  { id: 'gracioso', label: '😎 Gracioso' },
  { id: 'coquetear', label: '😘 Coquetear' },
  { id: 'provocativo', label: '🔥 Provocativo' },
  { id: 'enamorar', label: '😍 Enamorar' },
  { id: 'salvada', label: '🛟 Salvada épica' },
]

function buildPrompt(styleId, chatText) {
  const style = STYLE_PROMPTS[styleId] || STYLE_PROMPTS.gracioso
  return `Eres un experto en conversaciones de apps de citas (Tinder, Instagram, WhatsApp). Analiza el siguiente chat${chatText ? '' : ' de la imagen adjunta'} y genera exactamente 4 respuestas distintas en español, en un tono ${style}. Cada respuesta debe sonar natural y humana, lista para copiar y enviar. Devuelve solo las 4 respuestas, una por línea, numeradas del 1 al 4, sin explicaciones.${chatText ? `\n\nCHAT:\n${chatText}` : ''}`
}

export function parseResponses(text) {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)\-:]\s*/, '').trim())
    .filter((l) => l.length > 2)
    .slice(0, 6)
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function callGemini(apiKey, styleId, chatText, imageFile) {
  const parts = [{ text: buildPrompt(styleId, chatText) }]
  if (imageFile) {
    parts.push({ inline_data: { mime_type: imageFile.type, data: await fileToBase64(imageFile) } })
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Error de Gemini')
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callOpenAICompatible(url, apiKey, model, styleId, chatText, imageFile, extraHeaders = {}) {
  const content = [{ type: 'text', text: buildPrompt(styleId, chatText) }]
  if (imageFile) {
    const b64 = await fileToBase64(imageFile)
    content.push({ type: 'image_url', image_url: { url: `data:${imageFile.type};base64,${b64}` } })
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.9,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Error ${res.status}`)
  return data.choices?.[0]?.message?.content || ''
}

export const PROVIDERS = {
  gemini: {
    name: 'Google Gemini (free)',
    envKey: 'VITE_GEMINI_KEY',
    model: 'gemini-3.8-flash',
    run: (key, styleId, chatText, img) => callGemini(key, styleId, chatText, img),
  },
  groq: {
    name: 'Groq (free, rápido)',
    envKey: 'VITE_GROQ_KEY',
    model: 'qwen/qwen3.8-27b',
    run: (key, styleId, chatText, img) =>
      callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', key, 'qwen/qwen3.8-27b', styleId, chatText, img),
  },
  openrouter: {
    name: 'OpenRouter (modelos free)',
    envKey: 'VITE_OPENROUTER_KEY',
    model: 'qwen/qwen3.8-27b:free',
    run: (key, styleId, chatText, img) =>
      callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', key, 'qwen/qwen3.8-27b:free', styleId, chatText, img, { 'HTTP-Referer': 'http://localhost' }),
  },
}

export async function generateResponses(providerId, apiKey, styleId, chatText, imageFile) {
  const provider = PROVIDERS[providerId]
  if (!provider) throw new Error('Proveedor desconocido')
  if (!apiKey) throw new Error(`Falta la API key (${provider.envKey} en .env)`)
  const raw = await provider.run(apiKey, styleId, chatText, imageFile)
  const responses = parseResponses(raw)
  if (responses.length === 0) throw new Error('La IA no devolvió respuestas')
  return responses
}
