# Friday — Colab-powered Personal AI Assistant

Responsive, dark-mode Next.js chatbot frontend designed to work with the **existing** Google Colab + FastAPI + Ngrok setup. No backend model or prompt changes are required.

## Requirements

- Node.js 20.9+ (Node.js 22/24 recommended)
- A running Google Colab notebook with an Ngrok tunnel
- Your **existing** FastAPI `POST /chat` route accepting `{ "message": "..." }` and returning `{ "response": "..." }`
- Your FastAPI `GET /health` route for the status indicator
- The X-API-Key value from your Colab cell

## Run on Windows

Open a terminal in the extracted `friday-assistant` folder:

```powershell
npm install
Copy-Item .env.example .env.local
```

Edit `.env.local`:

```env
NGROK_BASE_URL=https://YOUR-ADDRESS.ngrok-free.app
COLAB_API_KEY=YOUR_COLAB_API_KEY
```

**Use just the Ngrok base URL, not `/chat` at the end.** The key is the server-side `API_KEY` printed in your earlier Colab code, not the Ngrok authtoken.

```powershell
npm run dev
```

Visit **http://localhost:3000**.

## Features

- Responsive desktop/mobile dark UI; collapsible mobile sidebar
- Multiple conversations, rename, delete, local search
- File and media uploads: attach PDFs and images directly from the message box via paperclip button, drag & drop, or clipboard paste (`Ctrl+V`)
- High-fidelity image previews and full-screen lightbox modal with download
- PDF document viewer cards and automatic text extraction
- Chat history saved with browser `localStorage`
- Markdown + code blocks with copy buttons
- Loading feedback, retry option and connection status (`GET /health`)
- Browser sends requests to `/api/chat` on Next.js **only**
- Next.js server forwards requests to `${NGROK_BASE_URL}/chat`, adding `X-API-Key` privately
- Auto-detect language **by model behavior**: frontend sends the user's original message unchanged; no system/persona prompting added

## Important limitations

- The app **displays/saves** past conversations but the existing Colab backend accepts **only one message** at a time. Previous chat turns are **not sent to the model**. Multi-turn context requires a future backend change.
- Colab runtimes and Ngrok URLs can expire or rotate. If the Ngrok URL changes, edit `.env.local` and restart `npm run dev`.
- Conversations are stored in your **current browser/device only**, not in a cloud database. Clearing browser storage deletes them.
- If the server is made publicly reachable, **add user authentication, rate limits and abuse protection** first. A server-only API key protects the upstream token from browser disclosure but does not prevent users of your public web app from invoking your proxy.
- Ngrok is a tunnel, not a permanent model host. The model must be loaded and running in Colab.

## Project layout

```
app/
  api/chat/route.ts      Server-only secure proxy
  api/status/route.ts    Connection health check
  globals.css           Responsive custom dark theme
  layout.tsx            Page metadata
  page.tsx              Chat UI + client-side state
components/
  markdown-message.tsx  Markdown renderer and code-copy UI
  sidebar.tsx           Conversation navigation/search
lib/
  storage.ts            localStorage save/load helpers
  types.ts              Shared types
```

## Test / production build

```powershell
npm run typecheck
npm run build
npm run start
```
