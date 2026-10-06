const API_URL = import.meta.env.VITE_API_URL || ''

export const STYLES = [
  { id: 'gracioso', label: '😎 Gracioso' },
  { id: 'coquetear', label: '😘 Coquetear' },
  { id: 'provocativo', label: '🔥 Provocativo' },
  { id: 'enamorar', label: '😍 Enamorar' },
  { id: 'salvada', label: '🛟 Salvada épica' },
]

export const PROVIDERS = {
  gemini: { name: 'Google Gemini (free)' },
  groq: { name: 'Groq (free, rápido)' },
  openrouter: { name: 'OpenRouter (modelos free)' },
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function generateResponses(providerId, styleId, chatText, imageFile) {
  const body = { proveedor: providerId, estilo: styleId, chatTexto: chatText || '' }
  if (imageFile) {
    body.imagenBase64 = await fileToBase64(imageFile)
    body.imagenMime = imageFile.type
  }
  const res = await fetch(`${API_URL}/api/respuestas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error ${res.status}`)
  }
  const data = await res.json()
  if (!data.respuestas?.length) throw new Error('La IA no devolvió respuestas')
  return data.respuestas
}