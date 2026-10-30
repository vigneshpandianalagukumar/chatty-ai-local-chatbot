const { generateEmbedding } = require("./ollama");
const { searchVectors, loadVectors } = require("./vectorStore");

const TOP_K = parseInt(process.env.RAG_TOP_K) || 5;
const MIN_SCORE = parseFloat(process.env.RAG_MIN_SCORE) || 0.25;
const MAX_CONTEXT_CHARS = parseInt(process.env.RAG_MAX_CONTEXT) || 6000;

/**
 * Embeds the question, searches the vector store, and assembles
 * a context block plus clean source metadata for the UI.
 */
async function buildContext(question, options = {}) {
  const topK = options.topK || TOP_K;
  const minScore = options.minScore ?? MIN_SCORE;

  const stored = loadVectors();

  if (stored.length === 0) {
    console.warn("[RAG] vector store is empty - nothing has been uploaded yet");
    return { context: "", chunks: [], reason: "empty_store" };
  }

  /* 1. Embed the query with the SAME model used at upload time */
  const queryEmbedding = await generateEmbedding(question);

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error("[RAG] generateEmbedding() returned no vector for the query");
  }

  /* 2. Fail loudly on dimension mismatch instead of scoring NaN */
  const storedDim = stored[0]?.embedding?.length;

  if (storedDim && queryEmbedding.length !== storedDim) {
    throw new Error(
      `[RAG] embedding dimension mismatch: query=${queryEmbedding.length}, index=${storedDim}. ` +
      `The index was built with a different embedding model. ` +
      `Delete data/vectors.json and re-upload your documents.`
    );
  }

  /* 3. Over-fetch so dedup still leaves enough results */
  const raw = searchVectors(queryEmbedding, topK * 3);

  console.log(
    "[RAG] top raw scores:",
    raw.slice(0, 5).map((r) => `${r.document}#${r.chunkNumber}=${r.score.toFixed(3)}`).join(", ")
  );

  /* 4. Drop weak matches and near-duplicates (same file uploaded twice) */
  const seen = new Set();
  const results = [];

  for (const item of raw) {
    if (!Number.isFinite(item.score) || item.score < minScore) continue;

    const fingerprint = item.content.slice(0, 120).replace(/\s+/g, " ").toLowerCase();
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    results.push(item);

    if (results.length >= topK) break;
  }

  if (results.length === 0) {
    console.warn(`[RAG] no chunk scored above ${minScore}`);
    return { context: "", chunks: [], reason: "no_match" };
  }

  /* 5. Assemble the context, capped by length */
  let used = 0;
  const parts = [];
  const chunks = [];

  for (const item of results) {
    const block = `[Source: ${item.document} | chunk ${item.chunkNumber}]\n${item.content}`;

    if (used + block.length > MAX_CONTEXT_CHARS) break;

    used += block.length;
    parts.push(block);

    // IMPORTANT: never send the 1024-float embedding back to the browser
    chunks.push({
      document: item.document,
      chunkNumber: item.chunkNumber,
      score: Number(item.score.toFixed(4)),
      preview: item.content.slice(0, 300)
    });
  }

  console.log(`[RAG] using ${chunks.length} chunks, ${used} chars of context`);

  return {
    context: parts.join("\n\n---\n\n"),
    chunks,
    reason: "ok"
  };
}

module.exports = { buildContext };
