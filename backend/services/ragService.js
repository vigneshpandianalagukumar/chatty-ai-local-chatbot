const { buildContext } = require("./retrievalService");
const { askOllamaStream } = require("./ollama");

const NOT_FOUND_MESSAGE =
  "I could not find that information in the uploaded documents.";

const NO_DOCUMENTS_MESSAGE =
  "No documents have been uploaded yet. Upload a PDF or DOCX first, then ask again.";

function buildPrompt(context, question) {
  return `You are a helpful assistant answering questions about the user's uploaded documents.

Rules:
- Answer using ONLY the context below.
- If the answer is not in the context, reply exactly: "${NOT_FOUND_MESSAGE}"
- Cite the source file name when you use a passage.
- Do not invent details that are not in the context.

==================== CONTEXT ====================
${context}
==================== END CONTEXT ====================

QUESTION: ${question}

ANSWER:`;
}

async function askWithRAG(question, model = "qwen3-8b", onChunk) {
  const { context, chunks, reason } = await buildContext(question);

  /*
   * Short-circuit: if retrieval found nothing there is no point
   * spending a full generation on an empty context.
   */
  if (!context) {
    const message = reason === "empty_store" ? NO_DOCUMENTS_MESSAGE : NOT_FOUND_MESSAGE;

    if (typeof onChunk === "function") {
      onChunk(message);
    }

    return { answer: message, sources: [] };
  }

  const prompt = buildPrompt(context, question);

  const answer = await askOllamaStream(
    model,
    [{ role: "user", content: prompt }],
    onChunk
  );

  return { answer, sources: chunks };
}

module.exports = { askWithRAG, NOT_FOUND_MESSAGE };
