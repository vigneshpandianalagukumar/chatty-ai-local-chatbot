#!/usr/bin/env bash
# Starts both llama.cpp servers that Chatty needs:
#   - chat model      on port 8080
#   - embedding model on port 8081 (required for Document/RAG mode)
#
# Model paths come from backend/.env (CHAT_MODEL_PATH, EMBED_MODEL_PATH)
# or from the environment. Relative paths are resolved from the project root.
# Press Ctrl+C to stop both servers.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -f backend/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source backend/.env
  set +a
fi

CHAT_MODEL_PATH="${CHAT_MODEL_PATH:-./models/Qwen3-8B-Q4_K_M.gguf}"
EMBED_MODEL_PATH="${EMBED_MODEL_PATH:-./models/mxbai-embed-large-v1.Q4_0.gguf}"
CHAT_PORT="${LLAMA_CHAT_PORT:-8080}"
EMBED_PORT="${LLAMA_EMBED_PORT:-8081}"
LLAMA_SERVER="${LLAMA_SERVER:-llama-server}"

for f in "$CHAT_MODEL_PATH" "$EMBED_MODEL_PATH"; do
  if [ ! -f "$f" ]; then
    echo "Model not found: $f"
    echo "Download it (see README) or set CHAT_MODEL_PATH / EMBED_MODEL_PATH in backend/.env"
    exit 1
  fi
done

if ! command -v "$LLAMA_SERVER" >/dev/null 2>&1; then
  echo "'$LLAMA_SERVER' not found. Build llama.cpp and add it to PATH, or set LLAMA_SERVER=/path/to/llama-server"
  exit 1
fi

trap 'kill 0' EXIT

echo "Chat server      -> http://localhost:$CHAT_PORT  ($CHAT_MODEL_PATH)"
"$LLAMA_SERVER" -m "$CHAT_MODEL_PATH" -c 8192 --port "$CHAT_PORT" &

echo "Embedding server -> http://localhost:$EMBED_PORT  ($EMBED_MODEL_PATH)"
"$LLAMA_SERVER" -m "$EMBED_MODEL_PATH" --embedding --pooling mean -c 512 --port "$EMBED_PORT" &

wait
