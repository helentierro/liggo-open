# Liggo Open

Web app estilo Liggo: sube una captura de un chat (o escribe/pega la conversación), elige un estilo de respuesta y la IA genera varias respuestas listas para copiar.

## Arquitectura

```
Web (GitHub Pages)  →  /api/respuestas  →  server.js  →  Gemini / Groq / OpenRouter
Acceso directo (tu PC)  →  server.js local  →  mismas IAs
```

Las API keys viven **solo en el servidor** (`.env` en local, variables de entorno en Render). Nunca se envían al navegador.

## Uso local (Windows)

Doble clic en `Abrir Liggo Open.bat` o en el acceso directo del escritorio. Abre http://localhost:5173/liggo-open/

Arranca Vite (puerto 5173) y el servidor de API (puerto 3001) a la vez.

## Configurar las keys (local)

Edita `.env` en esta carpeta:

```
GEMINI_KEY=...
GROQ_KEY=...
OPENROUTER_KEY=...
HISTORIAL=1
```

`HISTORIAL=1` activa el guardado del historial en `historial.json` (esta carpeta). Sin esa variable, el historial solo vive en el navegador.

### Dónde conseguir cada key

- **Gemini** — https://aistudio.google.com/apikey (free)
- **Groq** — https://console.groq.com/keys (free)
- **OpenRouter** — https://openrouter.ai/keys (modelos free)

## Deploy en Render (conecta la web pública con el servidor)

1. Crea cuenta en https://render.com con GitHub.
2. **New → Web Service** → conecta el repo `helentierro/liggo-open`.
3. Runtime: Node. Build command: (vacío). Start command: `node server.js`.
   - También puedes usar el botón "Blueprint" con el `render.yaml` incluido.
4. Añade las variables de entorno (secretas, visibles solo para ti):
   - `GEMINI_KEY`, `GROQ_KEY`, `OPENROUTER_KEY`
   - `ALLOWED_ORIGIN` = `https://helentierro.github.io`
   - `HISTORIAL` = *(vacío, así el historial no se guarda en la nube)*
5. Deploy. Copia la URL del servicio, ej. `https://liggo-open-api.onrender.com`.
6. Añade `VITE_API_URL=https://liggo-open-api.onrender.com` y recompila/publica Pages.

Nota: el plan free de Render se duerme tras ~15 min sin uso; la primera respuesta tras un rato puede tardar unos segundos.

## Scripts

- `npm run dev` — Vite + servidor de API
- `npm run build` — genera `dist/`
- `npm start` — solo el servidor (para hosting)
- `npm run lint` — oxlint