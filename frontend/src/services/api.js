/*
 * server.js mounts routes at BOTH "/chat" and "/api/chat",
 * so either base works. Bare paths are used here to match the
 * original project layout.
 */
const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:5000";

/* ---------------------------------------------------------
   HEALTH - is RAG actually able to run right now?
   --------------------------------------------------------- */

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

/* ---------------------------------------------------------
   MODELS
   --------------------------------------------------------- */

export async function fetchModels() {
  const response = await fetch(`${API_BASE}/chat/models`);
  const data = await response.json();
  return (data.data || []).map((model) => model.id);
}

/* ---------------------------------------------------------
   UPLOAD
   --------------------------------------------------------- */

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Upload failed");
  }

  return data;
}

/* ---------------------------------------------------------
   DOCUMENTS
   --------------------------------------------------------- */

export async function fetchIndexedDocuments() {
  const response = await fetch(`${API_BASE}/documents`);
  return response.json();
}

export async function deleteIndexedDocument(filename) {
  const response = await fetch(
    `${API_BASE}/documents/${encodeURIComponent(filename)}`,
    { method: "DELETE" }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Delete failed");
  }

  return data;
}

/* ---------------------------------------------------------
   CHAT (SSE streaming)

   THE RAG FIX: `mode` must be in the body. Without it the
   backend defaults to "normal" and retrieval never runs.
   --------------------------------------------------------- */

export async function sendChatMessage({
  question,
  model = "qwen3-8b",
  mode = "normal",
  onToken,
  onDone,
  onError,
  signal
}) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      question,
      model,
      stream: true,
      mode
    })
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Server error ${response.status}: ${text.slice(0, 200)}`);
    if (onError) onError(error);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let answer = "";
  let sources = [];
  let serverError = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();

      if (!payload || payload === "[DONE]") continue;

      try {
        const event = JSON.parse(payload);

        // Backend failures arrive here - do NOT ignore them,
        // that is what made RAG look like it did nothing.
        if (event.error) {
          serverError = new Error(event.error);
          if (onError) onError(serverError);
        }

        if (event.token) {
          answer += event.token;
          if (onToken) onToken(event.token);
        }

        if (event.done) {
          sources = event.sources || [];
          if (onDone) onDone({ answer, sources, error: event.error || null });
        }
      } catch {
        // partial frame - ignore
      }
    }
  }

  return { answer, sources, error: serverError };
}
