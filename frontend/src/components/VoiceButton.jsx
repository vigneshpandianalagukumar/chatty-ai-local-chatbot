import {
  useRef,
  useState
} from "react";

import { FiMic } from "react-icons/fi";

import {
  transcribeAudio
} from "../services/transcribe";

export default function VoiceButton({
  onTranscript
}) {

  const [recording, setRecording] =
    useState(false);

  const mediaRecorderRef =
    useRef(null);

  const chunksRef =
    useRef([]);

  async function toggleRecording() {

    if (recording) {

      mediaRecorderRef.current.stop();

      return;

    }

    try {

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true
          }
        );

      const recorder =
        new MediaRecorder(
          stream
        );

      chunksRef.current = [];

      recorder.ondataavailable =
        (event) => {

          if (
            event.data.size > 0
          ) {

            chunksRef.current.push(
              event.data
            );

          }

        };

      recorder.onstop =
        async () => {

          try {

            const audioBlob =
              new Blob(
                chunksRef.current,
                {
                  type:
                    "audio/webm"
                }
              );

            const result =
              await transcribeAudio(
                audioBlob
              );

            onTranscript(
              result.transcript
            );

          }

          catch (error) {

            console.error(
              error
            );

          }

          finally {

            stream
              .getTracks()
              .forEach(
                (
                  track
                ) =>
                  track.stop()
              );

            setRecording(
              false
            );

          }

        };

      mediaRecorderRef.current =
        recorder;

      recorder.start();

      setRecording(true);

    }

    catch (error) {

      console.error(error);

      alert(
        "Microphone access denied"
      );

    }

  }

  return (

    <button
      onClick={
        toggleRecording
      }
      className={`
      p-2.5
      rounded-xl
      transition

      ${
        recording
          ? "bg-red-500 text-white"
          : "hover:bg-[#3a3a3a]"
      }
      `}
    >

      <FiMic />

    </button>

  );

}
