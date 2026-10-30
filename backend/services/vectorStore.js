const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const VECTOR_FILE = path.join(DATA_DIR, "vectors.json");

/* ---------------------------------------------------------
   STORAGE
   --------------------------------------------------------- */

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(VECTOR_FILE)) {
    fs.writeFileSync(VECTOR_FILE, JSON.stringify([]));
  }
}

function loadVectors() {
  ensureStorage();

  try {
    const raw = fs.readFileSync(VECTOR_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[STORE] vectors.json is unreadable, starting empty:", error.message);
    return [];
  }
}

function saveVectors(vectors) {
  ensureStorage();

  // Write to a temp file first so a crash can't corrupt the index
  const tempFile = `${VECTOR_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(vectors));
  fs.renameSync(tempFile, VECTOR_FILE);
}

/* ---------------------------------------------------------
   VALIDATION
   --------------------------------------------------------- */

function isValidEmbedding(embedding) {
  if (!Array.isArray(embedding) || embedding.length === 0) return false;
  if (embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) return false;

  // A constant vector means the embedding endpoint returned a placeholder
  if (new Set(embedding).size === 1) return false;

  return true;
}

/* ---------------------------------------------------------
   WRITE
   --------------------------------------------------------- */

function addDocumentChunks(documentName, chunks) {
  const existingVectors = loadVectors();

  const records = chunks.map((chunk) => {
    if (!isValidEmbedding(chunk.embedding)) {
      throw new Error(`Refusing to index ${documentName} ${chunk.id}: invalid embedding`);
    }

    return {
      document: documentName,
      chunkId: chunk.id,
      chunkNumber: chunk.chunkNumber,
      content: chunk.content,
      embedding: chunk.embedding
    };
  });

  // All chunks in the store must share one dimension
  const newDim = records[0]?.embedding.length;
  const existingDim = existingVectors[0]?.embedding?.length;

  if (existingDim && newDim && existingDim !== newDim) {
    throw new Error(
      `Embedding dimension mismatch: store=${existingDim}, new=${newDim}. ` +
      `Delete data/vectors.json and re-upload every document.`
    );
  }

  // Replace any previous version of the same document
  const filteredVectors = existingVectors.filter((item) => item.document !== documentName);
  const replacedCount = existingVectors.length - filteredVectors.length;

  filteredVectors.push(...records);
  saveVectors(filteredVectors);

  console.log(
    `[STORE] ${documentName}: indexed ${records.length} chunks @ ${newDim} dims` +
    (replacedCount ? ` (replaced ${replacedCount} old chunks)` : "")
  );

  return {
    document: documentName,
    chunkCount: records.length,
    replacedChunks: replacedCount,
    dimensions: newDim,
    totalChunks: filteredVectors.length
  };
}

/* ---------------------------------------------------------
   SEARCH
   --------------------------------------------------------- */

function cosineSimilarity(a, b) {
  // FIX: never score mismatched or malformed vectors - that produced NaN
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;

  const score = dot / (magA * magB);

  return Number.isFinite(score) ? score : 0;
}

function searchVectors(queryEmbedding, limit = 5) {
  const vectors = loadVectors();

  if (vectors.length === 0) return [];

  const scored = vectors.map((item) => ({
    ...item,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/* ---------------------------------------------------------
   MANAGEMENT
   --------------------------------------------------------- */

function listDocuments() {
  const vectors = loadVectors();
  const docs = {};

  for (const item of vectors) {
    if (!docs[item.document]) {
      docs[item.document] = { chunks: 0 };
    }
    docs[item.document].chunks++;
  }

  return docs;
}

function deleteDocument(documentName) {
  const vectors = loadVectors();
  const filtered = vectors.filter((item) => item.document !== documentName);
  const removed = vectors.length - filtered.length;

  saveVectors(filtered);

  console.log(`[STORE] deleted ${documentName} (${removed} chunks)`);

  return { deleted: documentName, removedChunks: removed };
}

function getStoreInfo() {
  const vectors = loadVectors();

  return {
    totalChunks: vectors.length,
    dimensions: vectors[0]?.embedding?.length || null,
    documents: listDocuments()
  };
}

module.exports = {
  addDocumentChunks,
  searchVectors,
  cosineSimilarity,
  listDocuments,
  deleteDocument,
  getStoreInfo,
  loadVectors
};
