const express = require("express");

const {
  listDocuments,
  deleteDocument,
  getStoreInfo
} = require("../services/vectorStore");

const router = express.Router();

/* GET /api/documents - what is actually indexed on the server */
router.get("/", (req, res) => {
  try {
    const documents = listDocuments();

    res.json({
      success: true,
      documents: Object.entries(documents).map(([name, info]) => ({
        filename: name,
        chunks: info.chunks
      })),
      ...getStoreInfo()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* DELETE /api/documents/:filename - remove a document from the index */
router.delete("/:filename", (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const result = deleteDocument(filename);

    if (result.removedChunks === 0) {
      return res.status(404).json({
        success: false,
        error: `No indexed document named "${filename}"`
      });
    }

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
