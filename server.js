import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB = path.join(__dirname, 'historial.json')
const app = express()
app.use(express.json({ limit: '15mb' }))

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB, 'utf-8'))
  } catch {
    return []
  }
}

function writeDb(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2))
}

app.get('/api/historial', (req, res) => res.json(readDb()))

app.post('/api/historial', (req, res) => {
  const items = readDb()
  items.unshift({ ...req.body, id: Date.now() })
  writeDb(items.slice(0, 20))
  res.json({ ok: true })
})

app.delete('/api/historial/:id', (req, res) => {
  writeDb(readDb().filter((i) => String(i.id) !== req.params.id))
  res.json({ ok: true })
})

app.delete('/api/historial', (req, res) => {
  writeDb([])
  res.json({ ok: true })
})

app.listen(3001, () => console.log('Historial server en http://localhost:3001'))
