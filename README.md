# Friday — Colab-powered Personal AI Assistant

Responsive, dark-mode Next.js chatbot frontend designed to work with the **existing** Google Colab + FastAPI + Ngrok setup. The included Colab notebook runs a vision-language model for chat, images, and PDFs.

## Requirements

- Node.js 20.9+ (Node.js 22/24 recommended)
- A running Google Colab notebook with an Ngrok tunnel
- The updated `colab/friday_backend.ipynb` running on a GPU-enabled Colab runtime
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
- Image understanding using the Colab vision model; PDF text extraction and relevant page excerpts, with limited visual analysis of scanned PDFs
- Conversation context: up to the latest 12 messages, plus the most recently attached files for follow-up questions
- Chat history saved with browser `localStorage`
- Markdown + code blocks with copy buttons
- Loading feedback, retry option and connection status (`GET /health`)
- Browser sends requests to `/api/chat` on Next.js **only**
- Next.js server forwards requests to `${NGROK_BASE_URL}/chat`, adding `X-API-Key` privately
- Language follows the model behavior and the persona configured in the notebook

## Important limitations

- Run the updated notebook and reconnect after this upgrade; an older backend cannot provide these features. The notebook downloads `Qwen/Qwen2-VL-2B-Instruct` and requires a compatible GPU, sufficient VRAM, and the listed Python dependencies.
- Only the latest 12 prior messages are sent; each is limited to 3,000 characters. The most recent attachments are resent for follow-up questions, if still available in browser storage. Reattach files if storage has discarded them.
- PDFs are limited to 200 pages. For text PDFs, up to eight keyword-selected page excerpts are included, with a per-page and total text limit; this is not comprehensive document retrieval. Scanned PDFs send at most their first three pages as images. Extraction and model interpretation can be imperfect; verify important details.
- Up to four attachments and 25 MB per request are supported; each file is limited to 20 MB and up to six total images or scanned pages can be processed. Large requests can be slow or exceed available GPU memory.
- Colab runtimes and Ngrok URLs can expire or rotate. If the Ngrok URL changes, edit `.env.local` and restart `npm run dev`.
- Conversations are stored in your **current browser/device only**, not in a cloud database. Clearing browser storage deletes them.
- If the server is made publicly reachable, **add user authentication, rate limits and abuse protection** first. A server-only API key protects the upstream token from browser disclosure but does not prevent users of your public web app from invoking your proxy.
- Ngrok is a tunnel, not a permanent model host. The model must be loaded and running in Colab.

## Project layout

```
app/
  api/chat/route.ts      Server-only proxy for conversation context and files
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
