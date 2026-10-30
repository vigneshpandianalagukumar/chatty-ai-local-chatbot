const express = require("express");
const cors = require("cors");
require("dotenv").config();

const transcribeRoute = require("./routes/transcribe");
const uploadRoute = require("./routes/upload");
const documentsRoute = require("./routes/documents");
const chatRoute = require("./routes/chat");

const { checkEmbeddingServer } = require("./services/ollama");
const { getStoreInfo } = require("./services/vectorStore");

const app = express();

/* =========================== Middleware =========================== */

app.use(cors());

// RAG prompts and base64 payloads are large
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// One line per request - tells you immediately if the frontend is
// hitting a path that does not exist
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

/* =========================== Health Check =========================== */

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend Running"
  });
});

/*
 * Full system health: chat server, embedding server, vector store.
 * The frontend badge and your curl checks both use this.
 */
app.get("/health", async (req, res) => {
  const embedding = await checkEmbeddingServer();
  const store = getStoreInfo();

  res.json({
    server: "ok",
    embeddingServer: embedding,
    vectorStore: store,
    ragReady: embedding.ok && store.totalChunks > 0
  });
});

/* =========================== Routes ===========================

   Mounted at BOTH the bare path and an /api prefix so existing
   frontend calls keep working while new code can use /api/*.

   ================================================================ */

app.use("/upload", uploadRoute);
app.use("/api/upload", uploadRoute);

app.use("/documents", documentsRoute);
app.use("/api/documents", documentsRoute);

app.use("/chat", chatRoute);
app.use("/api/chat", chatRoute);

app.use("/api/transcribe", transcribeRoute);
app.use("/transcribe", transcribeRoute);

/* =========================== 404 =========================== */

app.use((req, res) => {
  console.warn("404:", req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: `No route for ${req.method} ${req.originalUrl}`
  });
});

/* =========================== Error Handler =========================== */

app.use((error, req, res, next) => {
  console.error("UNHANDLED ERROR:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({ success: false, error: error.message });
});

/* =========================== Start Server =========================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`\nServer running on port ${PORT}`);
  console.log(`  Upload API:    http://localhost:${PORT}/upload`);
  console.log(`  Documents API: http://localhost:${PORT}/documents`);
  console.log(`  Chat API:      http://localhost:${PORT}/chat`);
  console.log(`  Health:        http://localhost:${PORT}/health`);
  console.log(`  STT API:       http://localhost:${PORT}/api/transcribe`);

  /* Startup diagnostics - shows on boot whether RAG can work */

  const embedding = await checkEmbeddingServer();
  const store = getStoreInfo();

  console.log("\n--- RAG status ---");

  if (embedding.ok) {
    console.log(`  Embedding server: OK (${embedding.dimensions} dims)`);
  } else {
    console.warn(`  Embedding server: DOWN - ${embedding.error}`);
    console.warn("  Start it with:");
    console.warn("    llama-server -m <embed-model>.gguf --embedding --pooling mean -c 512 --port 8081");
  }

  console.log(
    `  Vector store: ${store.totalChunks} chunks, ` +
    `${Object.keys(store.documents).length} documents` +
    (store.dimensions ? ` @ ${store.dimensions} dims` : "")
  );

  if (embedding.ok && store.dimensions && embedding.dimensions !== store.dimensions) {
    console.error(
      `  MISMATCH: embedding server returns ${embedding.dimensions} dims ` +
      `but the index holds ${store.dimensions}. Delete data/vectors.json and re-upload.`
    );
  }

  console.log("------------------\n");
});
