const express = require("express");
const multer = require("multer");

const {
  transcribeAudio
} = require(
  "../services/whisperService"
);

const router = express.Router();

const upload = multer({
  dest: "uploads/audio/"
});

router.post(
  "/",
  upload.single("audio"),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          error: "No audio uploaded"
        });

      }

      const transcript =
        await transcribeAudio(
          req.file.path
        );

      res.json({
        transcript
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Transcription failed"
      });

    }

  }
);

module.exports = router;
