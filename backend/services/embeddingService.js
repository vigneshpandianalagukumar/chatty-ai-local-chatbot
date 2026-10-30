const { generateEmbedding } = require("./ollama");

// llama.cpp handles a few parallel requests well; 197 at once does not.
const CONCURRENCY = parseInt(process.env.EMBED_CONCURRENCY) || 4;
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedWithRetry(text, attempt = 0) {
  try {
    const embedding = await generateEmbedding(text);

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("empty embedding returned");
    }

    // Catches a silent placeholder vector like [0.1, 0.1, 0.1, ...]
    if (new Set(embedding).size === 1) {
      throw new Error("constant embedding returned - the embedding server failed");
    }

    return embedding;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await sleep(500 * (attempt + 1));
      return embedWithRetry(text, attempt + 1);
    }

    throw new Error(`Embedding failed after ${MAX_RETRIES + 1} attempts: ${error.message}`);
  }
}

/**
 * Embeds every chunk with bounded concurrency.
 * Returns the chunks with an `embedding` field added.
 */
async function generateEmbeddings(chunks, onProgress) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return [];
  }

  const results = new Array(chunks.length);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < chunks.length) {
      const index = cursor++;
      const chunk = chunks[index];

      const embedding = await embedWithRetry(chunk.content);
      results[index] = { ...chunk, embedding };

      completed++;

      if (completed % 20 === 0 || completed === chunks.length) {
        console.log(`[EMBED] ${completed}/${chunks.length}`);
      }

      if (typeof onProgress === "function") {
        onProgress(completed, chunks.length);
      }
    }
  }

  const workerCount = Math.min(CONCURRENCY, chunks.length);

  await Promise.all(Array.from({ length: workerCount }, worker));

  const dims = new Set(results.map((item) => item.embedding.length));

  if (dims.size > 1) {
    throw new Error(`Inconsistent embedding dimensions in one document: ${[...dims].join(", ")}`);
  }

  console.log(`[EMBED] done - ${results.length} chunks @ ${[...dims][0]} dims`);

  return results;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings
};
