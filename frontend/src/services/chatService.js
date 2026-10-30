let controller = null;

export function stopGeneration() {
  if (controller) {
    controller.abort();
    controller = null;
  }
}

export async function sendMessage(provider, model, messages, onChunk, mode = "normal") {
  controller = new AbortController();

  const response = await fetch(
    "http://localhost:5000/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ provider, model, messages, mode })
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  if (onChunk) onChunk(data.response);
  return data.response;
}