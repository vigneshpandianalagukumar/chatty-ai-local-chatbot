export async function uploadDocument(
  file
) {
  const formData = new FormData();

  formData.append(
    "file",
    file
  );

  const response =
    await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/upload`,
      {
        method: "POST",
        body: formData
      }
    );

  return response.json();
}
