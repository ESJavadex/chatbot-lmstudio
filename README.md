# Chatbot LM Studio

A modern ChatGPT-style web UI for local models running in LM Studio.

![Status](https://img.shields.io/badge/status-active-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Local First](https://img.shields.io/badge/local-first-8A2BE2)

## ✨ Features

- Clean, modern chat interface (desktop + mobile)
- Token streaming responses (live typing effect)
- Conversation persistence (local browser storage)
- Conversation sidebar with search + quick switching
- Message editing and deletion
- Model picker from LM Studio API
- Works on LAN and Tailscale

## 🧱 Stack

- React + Vite
- LM Studio OpenAI-compatible API (`/v1/chat/completions`)

## 🚀 Quick Start

### 1) Prerequisites

- LM Studio running locally with at least one loaded model
- LM Studio API enabled on `http://127.0.0.1:1234`
- Node.js 18+

### 2) Install

```bash
cd chatbot-lmstudio
npm install
```

### 3) Run

```bash
npm run dev
```

Then open:
- Local: `http://localhost:3000`
- LAN: `http://<your-ip>:3000`

## ⚙️ Configuration

By default, the app proxies LM Studio via Vite:

- Frontend -> `/v1/*`
- Proxy target -> `http://localhost:1234`

If your LM Studio endpoint changes, edit `vite.config.js`.

## 📁 Project Structure

```text
chatbot-lmstudio/
├── src/
│   ├── components/
│   ├── App.jsx
│   └── styles.css
├── public/
├── vite.config.js
├── package.json
└── README.md
```

## 🛠️ Development Notes

- Conversations are stored in browser `localStorage`.
- No cloud backend required for chat history.
- Ideal for local/private workflows.

## 🗺️ Roadmap

- [ ] Stop generation button
- [ ] Regenerate response
- [ ] Markdown + code block rendering polish
- [ ] Export / import conversation history
- [ ] Theme presets

## 📄 License

MIT

---

Built by [ESJavadex](https://github.com/ESJavadex)
