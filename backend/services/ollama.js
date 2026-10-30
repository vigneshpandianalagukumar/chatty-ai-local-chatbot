const http = require("http");

const CHAT_HOST = process.env.LLAMA_CHAT_HOST || "localhost";
const CHAT_PORT = parseInt(process.env.LLAMA_CHAT_PORT) || 8080;

const EMBED_HOST = process.env.LLAMA_EMBED_HOST || "localhost";
const EMBED_PORT = parseInt(process.env.LLAMA_EMBED_PORT) || 8081;

const EMBED_MODEL = process.env.EMBED_MODEL || "mxbai-embed-large";

// Set DEBUG_TOKENS=1 to log every streamed token (slow - debugging only)
const DEBUG_TOKENS = process.env.DEBUG_TOKENS === "1";

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000
});

/* =========================================================
   GENERIC LLAMA.CPP HTTP CALL
   ========================================================= */

function llamaCall(host, port, path, body, timeoutMs = 60000) {
  const postData = JSON.stringify(body);

  const options = {
    hostname: host,
    port,
    path,
    method: "POST",
    agent: httpAgent,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
      Connection: "keep-alive"
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`llama.cpp HTTP ${res.statusCode} at ${host}:${port}${path}: ${data.slice(0, 300)}`)
          );
        }

        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        return reject(
          new Error(
            `Cannot reach llama.cpp at ${host}:${port}. ` +
            `Is that server running? (chat=:${CHAT_PORT}, embeddings=:${EMBED_PORT})`
          )
        );
      }
      reject(error);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout: ${host}:${port}${path}`));
    });

    req.write(postData);
    req.end();
  });
}

/* =========================================================
   EMBEDDINGS - llama.cpp embedding server :8081
   Requires: llama-server -m <embed model> --embedding --pooling mean
   ========================================================= */

async function generateEmbedding(text) {
  const data = await llamaCall(
    EMBED_HOST,
    EMBED_PORT,
    "/v1/embeddings",
    { model: EMBED_MODEL, input: text },
    60000
  );

  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("Invalid embedding response from llama.cpp - check the --embedding flag");
  }

  // With --pooling none llama.cpp returns one vector PER TOKEN (array of arrays).
  // Mean-pool it here so the store always holds a flat vector.
  if (Array.isArray(embedding[0])) {
    const dim = embedding[0].length;
    const pooled = new Array(dim).fill(0);

    for (const row of embedding) {
      for (let i = 0; i < dim; i++) pooled[i] += row[i];
    }

    for (let i = 0; i < dim; i++) pooled[i] /= embedding.length;

    console.warn("[EMBED] server is using --pooling none; mean-pooled in Node instead");
    return pooled;
  }

  return embedding;
}

/* =========================================================
   EMBEDDING SERVER HEALTH CHECK
   ========================================================= */

async function checkEmbeddingServer() {
  try {
    const vector = await generateEmbedding("health check");
    return { ok: true, dimensions: vector.length };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/* =========================================================
   THINKING TAG REMOVAL (qwen3)
   ========================================================= */

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

/* =========================================================
   NON-STREAMING CHAT - llama.cpp :8080
   ========================================================= */

async function askOllama(model, messages) {
  const data = await llamaCall(
    CHAT_HOST,
    CHAT_PORT,
    "/v1/chat/completions",
    { model, messages, stream: false },
    180000
  );

  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("Invalid response from llama.cpp chat server");
  }

  return stripThinking(content);
}

/* =========================================================
   STREAMING CHAT - llama.cpp :8080
   ========================================================= */

async function askOllamaStream(model, messages, onChunk) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ model, messages, stream: true });

    const options = {
      hostname: CHAT_HOST,
      port: CHAT_PORT,
      path: "/v1/chat/completions",
      method: "POST",
      agent: httpAgent,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        Connection: "keep-alive"
      }
    };

    let fullResponse = "";
    let buffer = "";
    let pending = "";
    let insideThinking = false;

    /*
     * Hides <think>...</think> from the UI even when the tags
     * arrive split across several tokens.
     */
    function emit(token) {
      fullResponse += token;
      pending += token;

      while (pending.length > 0) {
        if (insideThinking) {
          const close = pending.indexOf("</think>");
          if (close === -1) {
            // keep a small tail in case the tag is split
            pending = pending.slice(-8);
            return;
          }
          pending = pending.slice(close + 8);
          insideThinking = false;
          continue;
        }

        const open = pending.indexOf("<think>");

        if (open === -1) {
          // hold back a tail that could be the start of "<think>"
          const safeLength = Math.max(0, pending.length - 7);
          const visible = pending.slice(0, safeLength);
          pending = pending.slice(safeLength);

          if (visible && typeof onChunk === "function") onChunk(visible);
          return;
        }

        const visible = pending.slice(0, open);
        if (visible && typeof onChunk === "function") onChunk(visible);

        pending = pending.slice(open + 7);
        insideThinking = true;
      }
    }

    function flush() {
      if (!insideThinking && pending && typeof onChunk === "function") {
        onChunk(pending);
      }
      pending = "";
    }

    function handleLine(line) {
      const trimmed = line.trim();

      if (!trimmed || !trimmed.startsWith("data:")) return;

      const payload = trimmed.slice(5).trim();

      if (!payload || payload === "[DONE]") return;

      try {
        const json = JSON.parse(payload);
        const token = json.choices?.[0]?.delta?.content || "";

        if (token) {
          if (DEBUG_TOKENS) console.log("TOKEN:", JSON.stringify(token));
          emit(token);
        }
      } catch (error) {
        console.error("SSE JSON parse error:", error.message, "| raw:", payload.slice(0, 200));
      }
    }

    const req = http.request(options, (res) => {
      res.setEncoding("utf8");

      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errorBody = "";
        res.on("data", (chunk) => { errorBody += chunk; });
        res.on("end", () => {
          reject(new Error(`llama.cpp HTTP ${res.statusCode}: ${errorBody.slice(0, 300)}`));
        });
        return;
      }

      res.on("data", (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) handleLine(line);
      });

      res.on("end", () => {
        if (buffer.trim()) handleLine(buffer);
        flush();

        console.log("Streaming completed. Length:", fullResponse.length);
        resolve(stripThinking(fullResponse));
      });
    });

    req.on("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        return reject(new Error(`Cannot reach llama.cpp chat server at ${CHAT_HOST}:${CHAT_PORT}`));
      }
      reject(error);
    });

    req.setTimeout(180000, () => {
      req.destroy();
      reject(new Error("llama.cpp streaming request timeout"));
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  generateEmbedding,
  checkEmbeddingServer,
  askOllama,
  askOllamaStream,
  stripThinking
};
