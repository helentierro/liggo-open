import { useState, useEffect } from 'react'
import { generateResponses, PROVIDERS, STYLES } from './services/ai'
import './App.css'

const ENV_KEYS = {
  gemini: import.meta.env.VITE_GEMINI_KEY,
  groq: import.meta.env.VITE_GROQ_KEY,
  openrouter: import.meta.env.VITE_OPENROUTER_KEY,
}

function loadKey(id) {
  return localStorage.getItem(`key_${id}`) || ENV_KEYS[id] || ''
}

function App() {
  const [mode, setMode] = useState('imagen')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [chatText, setChatText] = useState('')
  const [style, setStyle] = useState('gracioso')
  const [provider, setProvider] = useState('gemini')
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [keys, setKeys] = useState({ gemini: loadKey('gemini'), groq: loadKey('groq'), openrouter: loadKey('openrouter') })
  const [showKeys, setShowKeys] = useState(false)

  useEffect(() => {
    fetch('/api/historial')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setHistory)
      .catch(() => {
        try {
          setHistory(JSON.parse(localStorage.getItem('historial') || '[]'))
        } catch {}
      })
  }, [])

  function saveKey(id, value) {
    localStorage.setItem(`key_${id}`, value)
    setKeys({ ...keys, [id]: value })
  }

  async function persistHistory(updated) {
    try {
      localStorage.setItem('historial', JSON.stringify(updated))
    } catch {}
    setHistory(updated)
  }

  function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function makeThumbnail(file) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 200 / img.width)
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.6))
      }
      img.src = URL.createObjectURL(file)
    })
  }

  async function saveToHistory(results, thumb) {
    const entry = {
      fecha: new Date().toLocaleString('es'),
      modo: mode,
      estilo: style,
      proveedor: provider,
      chatTexto: mode === 'texto' ? chatText : '',
      imagen: thumb || null,
      respuestas: results,
    }
    entry.id = Date.now()
    const updated = [entry, ...history].slice(0, 20)
    try {
      await fetch('/api/historial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      const r = await fetch('/api/historial')
      if (r.ok) { setHistory(await r.json()); return }
    } catch {}
    persistHistory(updated)
  }

  async function handleGenerate() {
    setError('')
    setResponses([])
    if (mode === 'imagen' && !image) return setError('Sube una captura del chat')
    if (mode === 'texto' && !chatText.trim()) return setError('Pega el chat')
    setLoading(true)
    try {
      const results = await generateResponses(
        provider,
        keys[provider],
        style,
        mode === 'texto' ? chatText : '',
        mode === 'imagen' ? image : null
      )
      setResponses(results)
      const thumb = mode === 'imagen' && image ? await makeThumbnail(image) : null
      await saveToHistory(results, thumb)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deleteEntry(id) {
    try {
      await fetch(`/api/historial/${id}`, { method: 'DELETE' })
    } catch {}
    persistHistory(history.filter((h) => h.id !== id))
  }

  async function clearHistory() {
    try {
      await fetch('/api/historial', { method: 'DELETE' })
    } catch {}
    persistHistory([])
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  const styleLabel = (id) => STYLES.find((s) => s.id === id)?.label || id

  return (
    <div className="app">
      <header>
        <h1>💬 Liggo Open</h1>
        <p className="subtitle">Respuestas con IA para tus chats</p>
        <button className="history-toggle" onClick={() => setShowHistory(!showHistory)}>
          🕘 Historial ({history.length})
        </button>
        <button className="history-toggle" onClick={() => setShowKeys(!showKeys)}>
          🔑 API keys
        </button>
      </header>

      {showKeys && (
        <div className="keys-box">
          <p>Las keys se guardan en tu navegador, nunca en la web.</p>
          {Object.keys(PROVIDERS).map((id) => (
            <input
              key={id}
              type="password"
              placeholder={`API key de ${PROVIDERS[id].name}`}
              value={keys[id]}
              onChange={(e) => saveKey(id, e.target.value)}
            />
          ))}
        </div>
      )}

      {showHistory ? (
        <div className="history">
          {history.length === 0 && <p className="empty">Sin historial todavía</p>}
          {history.length > 0 && <button className="clear" onClick={clearHistory}>Vaciar historial</button>}
          {history.map((h) => (
            <div key={h.id} className="history-item">
              <div className="history-meta">
                <span>{styleLabel(h.estilo)}</span> · <span>{h.fecha}</span>
                <button className="delete" onClick={() => deleteEntry(h.id)}>🗑️</button>
              </div>
              {h.imagen && <img src={h.imagen} alt="chat" className="thumb" />}
              {h.chatTexto && <p className="history-chat">{h.chatTexto.slice(0, 120)}{h.chatTexto.length > 120 ? '…' : ''}</p>}
              {h.respuestas.map((r, i) => (
                <div key={i} className="response small">
                  <p>{r}</p>
                  <button onClick={() => copy(r, `${h.id}-${i}`)}>{copied === `${h.id}-${i}` ? '¡Copiado!' : 'Copiar'}</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="tabs">
            <button className={mode === 'imagen' ? 'active' : ''} onClick={() => setMode('imagen')}>📷 Captura</button>
            <button className={mode === 'texto' ? 'active' : ''} onClick={() => setMode('texto')}>⌨️ Escribir chat</button>
          </div>

          {mode === 'imagen' ? (
            <div className="card">
              <input type="file" accept="image/*" onChange={handleImage} />
              {imagePreview && <img src={imagePreview} alt="preview" className="preview" />}
            </div>
          ) : (
            <textarea
              className="chat-input"
              placeholder="Pega aquí la conversación..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              rows={6}
            />
          )}

          <h3>Estilo</h3>
          <div className="styles">
            {STYLES.map((s) => (
              <button key={s.id} className={style === s.id ? 'active' : ''} onClick={() => setStyle(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          <h3>Proveedor de IA</h3>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {Object.entries(PROVIDERS).map(([id, p]) => (
              <option key={id} value={id}>{p.name}</option>
            ))}
          </select>

          <button className="generate" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generando...' : '✨ Generar respuestas'}
          </button>

          {error && <p className="error">{error}</p>}

          <div className="responses">
            {responses.map((r, i) => (
              <div key={i} className="response">
                <p>{r}</p>
                <button onClick={() => copy(r, i)}>{copied === i ? '¡Copiado!' : 'Copiar'}</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default App
