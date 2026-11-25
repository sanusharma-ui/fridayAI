# Friday Backend (Node.js + Express + Groq)

Standalone TypeScript backend replacing the Google Colab notebook. Supports **Bring Your Own Key (BYOK)** so every mobile app user can set up their own Groq API key from the app's Settings screen.

## Setup & Run

```powershell
cd backend
npm install
npm run dev
```

The server listens on `http://0.0.0.0:4000` (accessible from `localhost:4000`, Android Emulator `10.0.2.2:4000`, and any phone on the same Wi-Fi LAN).

## Endpoints

- `GET /api/health` — Server status, default models, and curated Groq models
- `POST /api/verify-key` — Verifies a user's Groq API key (`X-Groq-Api-Key` header) and fetches live models from Groq
- `GET /api/models` — Lists available Groq chat & vision models
- `POST /api/chat` — Multi-turn chat + PDF text extraction + Image vision analysis via Groq
