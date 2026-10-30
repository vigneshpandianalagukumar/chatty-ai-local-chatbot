# Chatty — Local AI Chatbot with Document RAG

A **local-first AI chat application** that runs entirely on your own machine. It pairs a React + Vite frontend with a Node.js/Express backend and uses **llama.cpp** servers for both chat and embeddings, so no cloud API or API key is needed.

You can chat with the model directly, or switch to **Document (RAG) mode**: upload a PDF, DOCX, TXT or Markdown file and ask questions answered only from its content, with the source chunks shown alongside.

## Features

| Feature | Implementation |
|---|---|
| **Chat modes** | Normal (direct LLM) and Document RAG mode |
| **Streaming** | Server-Sent Events with token-by-token rendering |
| **RAG pipeline** | Upload → Chunk → Embed → Vector store → Retrieve → Generate |
| **Document support** | PDF, DOCX, TXT, MD (via `pdf-parse` and `mammoth`) |
| **Vector store** | Local JSON file with cosine similarity, no database needed |
| **Voice input** | Browser MediaRecorder → whisper.cpp speech-to-text on the backend |
| **Model selection** | Lists available models from llama.cpp `/v1/models` |
| **Persistence** | Chats and settings in localStorage; documents synced with the server |
| **Theming** | Dark and light mode with CSS variables |
| **Health monitoring** | `/health` polled every 30 s; shows a RAG-readiness badge |

## Architecture

```
┌──────────────────── FRONTEND (React + Vite, :5173) ────────────────────┐
│  ChatWindow · Message · CodeBlock   InputBox · VoiceButton · ModelSelector │
│  DocumentPanel · DocumentViewer · StopButton                            │
│                     │                                                   │
│            Zustand stores (chatStore, documentStore)                    │
│                     │                                                   │
│              services/api.js  (SSE client)                              │
└─────────────────────┬──────────────────────────────────────────────────┘
                      │ HTTP / SSE
┌─────────────────────▼──────────── BACKEND (Express, :5000) ─────────────┐
│  routes: /chat  /upload  /documents  /api/transcribe  /health           │
│                                                                          │
│  ragService → retrievalService → vectorStore (data/vectors.json)         │
│  embeddingService → llama.cpp embeddings (:8081)                         │
│  ollama.js / ollamaService → llama.cpp chat (:8080)                      │
│  chunkingService · whisperService (speech-to-text)                       │
└───────────────┬──────────────────────────────────┬──────────────────────┘
                ▼                                  ▼
     llama.cpp chat server :8080        llama.cpp embedding server :8081
        (Qwen3-8B GGUF)                    (mxbai-embed-large-v1 GGUF)
```

The frontend never talks to llama.cpp directly; everything goes through the backend, which handles CORS, SSE streaming and the RAG logic.

### RAG pipeline

1. **Upload** (`POST /upload`): extract text, split into ~700-character chunks with 120-character overlap on sentence/paragraph boundaries, embed each chunk on the embedding server, and store in `backend/data/vectors.json`.
2. **Retrieve** (`retrievalService.buildContext`): embed the question with the same model, run a cosine-similarity search (top-K × 3, deduplicated by content), keep matches scoring ≥ 0.25, and cap the context at 6000 characters.
3. **Generate** (`ragService.askWithRAG`): build a strict "answer only from the context" prompt, stream the answer from the chat server, and return it with its sources (document, chunk number, score, preview).

### Design decisions

| Area | Decision | Why |
|---|---|---|
| Vector store | JSON file, not a database | Zero setup, portable, works offline |
| Embeddings | llama.cpp `--embedding --pooling mean` | Runs locally, no OpenAI key |
| Streaming protocol | Custom SSE events: `token`, `done`, `error`, `sources` | Simple over plain HTTP, no WebSockets |
| Thinking tags | Stripped during streaming | Qwen3 emits reasoning the UI shouldn't show |
| Dimension check | Fail fast on embedding-size mismatch | Prevents silent `NaN` scores |
| Persistence | localStorage writes debounced to 500 ms | Keeps typing smooth |

## Project structure

```
chatty_AI_Local_chatbot/
├── package.json            # root scripts: install:all, llama, dev
├── scripts/
│   └── start-llama.sh      # starts both llama.cpp servers
├── backend/
│   ├── server.js           # Express entry point
│   ├── .env.example        # copy to .env
│   ├── routes/             # chat, upload, documents, transcribe
│   └── services/           # rag, retrieval, vectorStore, embedding, chunking, ollama, whisper
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── components/     # ChatWindow, InputBox, DocumentPanel, ...
        ├── store/          # chatStore.js, documentStore.js (Zustand)
        └── services/       # api.js (SSE), upload.js, transcribe.js, ...
```

## Getting started

### Prerequisites

- **Node.js 18+** and npm
- **llama.cpp**, built so that `llama-server` is on your PATH ([build guide](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md))
- *Optional, for voice input:* **ffmpeg** and **whisper.cpp** (see [Voice input](#voice-input-optional))

### 1. Download the models

Model files are not stored in this repository. Download them into a `models/` folder at the project root:

| Role | Hugging Face repo | File |
|---|---|---|
| Chat | [Qwen/Qwen3-8B-GGUF](https://huggingface.co/Qwen/Qwen3-8B-GGUF) | `Qwen3-8B-Q4_K_M.gguf` (~5 GB) |
| Embeddings | [ChristianAzinn/mxbai-embed-large-v1-gguf](https://huggingface.co/ChristianAzinn/mxbai-embed-large-v1-gguf) | `mxbai-embed-large-v1.Q4_0.gguf` |

If you keep them somewhere else, set `CHAT_MODEL_PATH` and `EMBED_MODEL_PATH` in `backend/.env`.

### 2. Install dependencies

```bash
git clone https://github.com/vigneshpandianalagukumar/chatty-ai-local-chatbot.git
cd chatty-ai-local-chatbot
npm run install:all
cp backend/.env.example backend/.env
```

### 3. Run it

The app runs as four processes. Use two terminals:

```bash
# Terminal 1: both llama.cpp servers (chat :8080 + embeddings :8081)
npm run llama

# Terminal 2: backend (:5000) + frontend (:5173)
npm run dev
```

Then open **http://localhost:5173**.

| Process | Purpose | Port |
|---|---|---|
| llama.cpp chat server | LLM inference | 8080 |
| llama.cpp embedding server | Vectors for RAG | 8081 |
| Backend (`npm start`) | Express API, RAG, uploads | 5000 |
| Frontend (`npm run dev`) | React + Vite dev server | 5173 |

<details>
<summary>Prefer separate terminals? Run each process by hand</summary>

```bash
llama-server -m models/Qwen3-8B-Q4_K_M.gguf -c 8192 --port 8080
llama-server -m models/mxbai-embed-large-v1.Q4_0.gguf --embedding --pooling mean -c 512 --port 8081
cd backend && npm start
cd frontend && npm run dev
```
</details>

When the backend starts you should see:

```
Server running on port 5000
--- RAG status ---
  Embedding server: OK (1024 dims)
  Vector store: 0 chunks, 0 documents
```

## Using Document (RAG) mode

1. Click **+ New Chat**.
2. In the header, switch the mode to **Document (RAG)**; a purple badge appears.
3. Click **Attach** and pick a PDF, DOCX, TXT or MD file.
4. Press **Enter** to upload and index it.
5. Ask questions about the document. Answers come with their source chunks.

## Voice input (optional)

Voice input records audio in the browser and transcribes it on the backend with [whisper.cpp](https://github.com/ggml-org/whisper.cpp).

1. Install `ffmpeg`.
2. Clone and build whisper.cpp at the project root (`./whisper.cpp`), and download the `ggml-base.en.bin` model into `whisper.cpp/models/`.
3. If whisper.cpp lives elsewhere, set `WHISPER_CLI_PATH` and `WHISPER_MODEL_PATH` in `backend/.env`.

## Configuration

All backend settings are optional and documented in [`backend/.env.example`](backend/.env.example): ports and hosts for both llama.cpp servers, chunk size and overlap, top-K, minimum similarity score, context limit, and model paths.

The frontend calls the backend at `http://localhost:5000` by default; set `VITE_API_URL` in `frontend/.env` to change it.

## Troubleshooting

If the RAG badge shows **"Backend offline"** or **"Embedding server down"**:

- Check that both llama.cpp servers are running on ports 8080 and 8081.
- Look at the backend console for connection errors.
- Open http://localhost:5000/health to see the JSON status.
- If the backend reports an embedding **dimension mismatch**, you changed the embedding model after indexing. Delete `backend/data/vectors.json` and upload your documents again.

## Tech stack

**Frontend:** React 19, Vite, Zustand, Tailwind CSS, Framer Motion, react-markdown, react-syntax-highlighter
**Backend:** Node.js, Express 5, Multer, pdf-parse, mammoth, dotenv
**AI:** llama.cpp (Qwen3-8B chat, mxbai-embed-large embeddings), whisper.cpp

## Author

**Vignesh Pandian A** — [@vigneshpandianalagukumar](https://github.com/vigneshpandianalagukumar)
