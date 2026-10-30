const express = require("express");
const http = require("http");

const { askWithRAG } = require("../services/ragService");
const { askOllamaStream, checkEmbeddingServer } = require("../services/ollama");
const { getStoreInfo } = require("../services/vectorStore");

const router = express.Router();

const CHAT_HOST = process.env.LLAMA_CHAT_HOST || "localhost";
const CHAT_PORT = parseInt(process.env.LLAMA_CHAT_PORT) || 8080;

function llamaGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CHAT_HOST,
      port: CHAT_PORT,
      path,
      method: "GET",
      headers: { "Content-Type": "application/json" }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); }
      });
    });

    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

/* ---------------------------------------------------------
   GET /api/chat/models
   --------------------------------------------------------- */

router.get("/models", async (req, res) => {
  try {
    const data = await llamaGet("/v1/models");
    res.json(data);
  } catch (error) {
    console.error("MODELS ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------------------
   GET /api/chat/health
   Tells you instantly whether RAG can work at all.
   --------------------------------------------------------- */

router.get("/health", async (req, res) => {
  const embed = await checkEmbeddingServer();

  let chat = { ok: false };
  try {
    const models = await llamaGet("/v1/models");
    chat = { ok: true, models: (models.data || []).map((m) => m.id) };
  } catch (error) {
    chat = { ok: false, error: error.message };
  }

  const store = getStoreInfo();

  res.json({
    chatServer: chat,
    embeddingServer: embed,
    vectorStore: store,
    ragReady: chat.ok && embed.ok && store.totalChunks > 0
  });
});

/* ---------------------------------------------------------
   POST /api/chat
   --------------------------------------------------------- */

router.post("/", async (req, res) => {
  // Shows exactly what the frontend sent - check `mode` here
  console.log("CHAT BODY:", {
    ...req.body,
    question: String(req.body?.question || "").slice(0, 80)
  });

  try {
    const {
      question,
      model = "qwen3-8b",
      stream = true,
      mode = "normal"
    } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Question required" });
    }

    const isRAG = mode === "rag";

    console.log(`[CHAT] mode=${mode} rag=${isRAG} model=${model} stream=${stream}`);

    /* ---------------- STREAMING ---------------- */

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const sendChunk = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        let result;

        if (isRAG) {
          result = await askWithRAG(question, model, (token) => sendChunk({ token }));
        } else {
          const messages = [{ role: "user", content: question }];
          const answer = await askOllamaStream(model, messages, (token) => sendChunk({ token }));
          result = { answer, sources: [] };
        }

        sendChunk({ done: true, sources: result.sources || [] });
        res.end();
      } catch (streamError) {
        console.error("STREAM ERROR:", streamError.message);

        // Surface the failure IN the chat instead of closing silently
        sendChunk({ token: `\n\n[Error] ${streamError.message}` });
        sendChunk({ done: true, sources: [], error: streamError.message });
        res.end();
      }

      return;
    }

    /* ---------------- NON-STREAMING ---------------- */

    let result;

    if (isRAG) {
      result = await askWithRAG(question, model);
    } else {
      const messages = [{ role: "user", content: question }];
      const answer = await askOllamaStream(model, messages);
      result = { answer, sources: [] };
    }

    res.json({
      success: true,
      answer: result.answer,
      sources: result.sources || []
    });
  } catch (error) {
    console.error("CHAT ERROR:", error);

    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ token: `\n\n[Error] ${error.message}` })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, sources: [], error: error.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
