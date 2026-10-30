/**
 * Splits raw document text into overlapping chunks on sentence /
 * paragraph boundaries where possible.
 */
function chunkText(text, options = {}) {
  /*
   * 700 chars keeps chunks under the 512-token ceiling of
   * mxbai-embed-large-v1 even on dense academic PDF text
   * (which runs about 1.9 chars per token).
   */
  const chunkSize = options.chunkSize || parseInt(process.env.CHUNK_SIZE) || 700;
  const overlap = options.overlap || parseInt(process.env.CHUNK_OVERLAP) || 120;
  const minChunkLength = options.minChunkLength || 50;

  if (!text || typeof text !== "string") {
    return [];
  }

  const cleanedText = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (cleanedText.length === 0) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < cleanedText.length) {
    let end = start + chunkSize;
    let isLast = false;

    if (end >= cleanedText.length) {
      end = cleanedText.length;
      isLast = true;
    } else {
      // Prefer breaking at a sentence or paragraph boundary
      const lastPeriod = cleanedText.lastIndexOf(".", end);
      const lastNewLine = cleanedText.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewLine);

      if (breakPoint > start + Math.floor(chunkSize * 0.4)) {
        end = breakPoint + 1;
      }
    }

    const content = cleanedText.slice(start, end).trim();

    if (content.length >= minChunkLength) {
      chunks.push({
        id: `chunk_${chunks.length + 1}`,
        content,
        length: content.length,
        chunkNumber: chunks.length + 1
      });
    }

    // FIX: stop instead of emitting a duplicated tail chunk
    if (isLast) {
      break;
    }

    const nextStart = end - overlap;

    // FIX: guarantee forward progress (no infinite loop)
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}

module.exports = { chunkText };
