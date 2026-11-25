# Friday Mobile (React Native + Expo + Groq)

React Native mobile app for **Friday Personal AI Assistant**, connected to the standalone Friday Backend with **Groq API Key (BYOK)** support.

## Features

- **Settings & API Keys Window**:
  - Enter, mask/unmask, paste, verify, and clear your personal **Groq API Key** (`gsk_...`), stored encrypted on-device via `expo-secure-store`.
  - Choose your preferred **Groq Chat Model** (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, etc.) and **Vision Model** (`qwen/qwen3.8-27b`).
  - Auto-detects local LAN Backend URL on Expo Go / Android Emulator, with optional custom Backend Server URL & live connection tester.
- **Full Chat Workspace**:
  - Multiple conversations, search, rename, delete, local device persistence.
  - Attach Photos/Images (analyzed with Groq Vision) and PDF documents (relevant page excerpts extracted by backend).
  - Native Markdown & syntax code panels with 1-tap copy.

## Run

1. Start the backend first (`cd ../backend && npm run dev`).
2. Start the Expo app:

```powershell
cd mobile
npm install
npx expo start
```

Scan the QR code in **Expo Go** on your phone, or press `a` for Android Emulator / `w` for Web preview.
