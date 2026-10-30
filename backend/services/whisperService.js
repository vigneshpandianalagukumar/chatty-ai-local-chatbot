const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

// whisper.cpp is expected at the project root (../../whisper.cpp from here).
// Override either path in backend/.env if you keep it elsewhere.
const WHISPER_ROOT = path.join(__dirname, "../../whisper.cpp");

const WHISPER_CLI =
  process.env.WHISPER_CLI_PATH ||
  path.join(WHISPER_ROOT, "build/bin/whisper-cli");

const WHISPER_MODEL =
  process.env.WHISPER_MODEL_PATH ||
  path.join(WHISPER_ROOT, "models/ggml-base.en.bin");

function transcribeAudio(audioPath) {

  return new Promise(
    (resolve, reject) => {

      const wavPath =
        `${audioPath}.wav`;

      execFile(
        "ffmpeg",
        [
          "-y",
          "-i",
          audioPath,
          "-ar",
          "16000",
          "-ac",
          "1",
          wavPath
        ],
        (ffmpegError) => {

          if (ffmpegError) {

            reject(ffmpegError);

            return;

          }

          execFile(
            WHISPER_CLI,
            [
              "-m",
              WHISPER_MODEL,
              "-f",
              wavPath,
              "--no-timestamps"
            ],
            {
              maxBuffer:
                1024 * 1024 * 20
            },
            (
              whisperError,
              stdout
            ) => {

              try {

                fs.unlinkSync(
                  audioPath
                );

                fs.unlinkSync(
                  wavPath
                );

              } catch {}

              if (
                whisperError
              ) {

                reject(
                  whisperError
                );

                return;

              }

              resolve(
                stdout
              );

            }
          );

        }
      );

    }
  );

}

module.exports = {
  transcribeAudio
};
