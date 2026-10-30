const express = require("express");
const multer = require("multer");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse/lib/pdf-parse");
const fs = require("fs");
const path = require("path");

const { chunkText } = require("../services/chunkingService");
const { generateEmbeddings } = require("../services/embeddingService");
const { addDocumentChunks } = require("../services/vectorStore");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }
});

function cleanup(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.warn("Could not delete temp file:", error.message);
    }
  }
}

router.post("/", upload.single("file"), async (req, res) => {
  const file = req.file;

  try {
    console.log("========== UPLOAD START ==========");

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File:", file.originalname);

    const extension = path.extname(file.originalname).toLowerCase();
    let extractedText = "";

    if (extension === ".pdf") {
      console.log("Processing PDF");
      const buffer = fs.readFileSync(file.path);
      const pdf = await pdfParse(buffer);
      extractedText = pdf.text;
    } else if (extension === ".docx") {
      console.log("Processing DOCX");
      const result = await mammoth.extractRawText({ path: file.path });
      extractedText = result.value;
    } else if (extension === ".txt" || extension === ".md") {
      console.log("Processing plain text");
      extractedText = fs.readFileSync(file.path, "utf8");
    } else {
      cleanup(file.path);
      return res.status(400).json({ error: "Only PDF, DOCX, TXT and MD are supported" });
    }

    console.log("Text Length:", extractedText.length);

    if (!extractedText || extractedText.trim().length < 50) {
      cleanup(file.path);
      return res.status(400).json({
        error:
          "No readable text found. If this is a scanned PDF it needs OCR before it can be indexed."
      });
    }

    const chunks = chunkText(extractedText);
    console.log("Chunks:", chunks.length);

    if (chunks.length === 0) {
      cleanup(file.path);
      return res.status(400).json({ error: "Document produced no usable chunks" });
    }

    const embeddedChunks = await generateEmbeddings(chunks);
    console.log("Embeddings generated");

    const result = addDocumentChunks(file.originalname, embeddedChunks);
    console.log("Vector store updated");

    cleanup(file.path);

    const preview =
      extractedText.slice(0, 500) + (extractedText.length > 500 ? "..." : "");

    console.log("========== UPLOAD DONE ==========");

    res.json({
      success: true,

      // FIX: the frontend needs a stable id, otherwise deleting one
      // document deletes every row in the panel
      id: `${Date.now()}_${file.originalname}`,

      filename: file.originalname,
      fileType: extension.replace(".", "").toUpperCase(),

      textLength: extractedText.length,
      chunkCount: result.chunkCount,
      dimensions: result.dimensions,
      totalChunks: result.totalChunks,
      replacedChunks: result.replacedChunks,

      indexed: true,
      uploadedAt: new Date().toISOString(),
      preview
    });
  } catch (error) {
    console.error("UPLOAD ERROR:", error.message);

    cleanup(file?.path);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
