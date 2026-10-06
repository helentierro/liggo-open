# Liggo Open

Web app estilo Liggo: sube una captura de un chat (o escribe/pega la conversación), elige un estilo de respuesta y la IA genera varias respuestas listas para copiar.

## Arrancar

```
npm install
npm run dev
```

Abre http://localhost:5173

El historial se guarda en `historial.json` dentro de esta carpeta (disco D). El botón de acceso directo arranca Vite y el servidor del historial a la vez. Los backups del código anterior están en `src/App.jsx.bak` y `src/App.css.bak`.

## API keys

Edita el archivo `.env` y pega tu key en el proveedor que uses (no hace falta llenar todas):

- `VITE_GEMINI_KEY` — https://aistudio.google.com/apikey (gratis, recomendado)
- `VITE_GROQ_KEY` — https://console.groq.com/keys (gratis, muy rápido)
- `VITE_OPENROUTER_KEY` — https://openrouter.ai/keys (modelos free)

Las keys se guardan en `.env` y persisten entre sesiones. Reinicia `npm run dev` después de editarlas.
