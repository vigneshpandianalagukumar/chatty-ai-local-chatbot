export async function transcribeAudio(
  audioBlob
) {

  const formData =
    new FormData();

  formData.append(
    "audio",
    audioBlob,
    "recording.webm"
  );

  const response =
    await fetch(
      "http://localhost:5000/api/transcribe",
      {
        method: "POST",
        body: formData
      }
    );

  if (!response.ok) {

    throw new Error(
      "Transcription failed"
    );

  }

  return response.json();

}
