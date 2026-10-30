let controller = null;

const chatUrl = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/chat`;


/* =========================================================
   STOP GENERATION
   ========================================================= */

export function stopGeneration() {
  if (controller) {
    controller.abort();
    controller = null;
  }
}


/* =========================================================
   SEND CHAT MESSAGE
   ========================================================= */

export async function sendMessage(
  model,
  messages,
  onChunk,
  mode = "normal"
) {

  controller = new AbortController();

  try {

    const question =
      messages[messages.length - 1]?.content || "";


    if (!question.trim()) {
      throw new Error("Question is empty");
    }


    console.log("========== FRONTEND CHAT ==========");
    console.log("Model:", model);
    console.log("Mode:", mode);
    console.log("Question:", question);
    console.log("===================================");


    const response = await fetch(
      chatUrl,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },

        signal: controller.signal,

        body: JSON.stringify({
          question,
          model,
          stream: true,
          mode
        })
      }
    );


    if (!response.ok) {

      let errorText = "";

      try {
        errorText = await response.text();
      } catch (e) {
        errorText = "";
      }

      throw new Error(
        `Chat API Error: ${response.status} ${errorText}`
      );
    }


    if (!response.body) {
      throw new Error(
        "Chat API returned no response body"
      );
    }


    const reader =
      response.body.getReader();

    const decoder =
      new TextDecoder("utf-8");


    let fullResponse = "";
    let buffer = "";
    let sources = [];


    while (true) {

      const {
        done,
        value
      } = await reader.read();


      if (done) {
        break;
      }


      buffer += decoder.decode(
        value,
        {
          stream: true
        }
      );


      const lines =
        buffer.split(/\r?\n/);


      buffer =
        lines.pop() || "";


      for (const rawLine of lines) {

        const line =
          rawLine.trim();


        if (!line) {
          continue;
        }


        if (!line.startsWith("data:")) {
          continue;
        }


        const data =
          line
            .slice(5)
            .trim();


        if (!data) {
          continue;
        }


        if (data === "[DONE]") {
          continue;
        }


        let json;


        try {

          json =
            JSON.parse(data);

        } catch (error) {

          console.error(
            "SSE JSON parse error:",
            error
          );

          console.error(
            "Raw SSE data:",
            data
          );

          continue;
        }


        if (
          typeof json.token === "string" &&
          json.token.length > 0
        ) {

          fullResponse +=
            json.token;


          console.log(
            "Frontend token:",
            JSON.stringify(json.token)
          );


          if (
            typeof onChunk === "function"
          ) {

            onChunk(
              json.token
            );

          }

        }


        if (json.error) {

          throw new Error(
            json.error
          );

        }


        if (json.done === true) {

          console.log(
            "Frontend received DONE"
          );

          console.log(
            "Final response length:",
            fullResponse.length
          );

          if (json.sources) {
            sources = json.sources;
            console.log("RAG Sources received:", sources.length);
          }

          controller = null;

          return { answer: fullResponse, sources };
        }

      }

    }


    buffer += decoder.decode();


    if (buffer.trim()) {

      const finalLines =
        buffer.split(/\r?\n/);


      for (
        const rawLine
        of finalLines
      ) {

        const line =
          rawLine.trim();


        if (
          !line.startsWith("data:")
        ) {
          continue;
        }


        const data =
          line
            .slice(5)
            .trim();


        if (
          !data ||
          data === "[DONE]"
        ) {
          continue;
        }


        try {

          const json =
            JSON.parse(data);


          if (
            typeof json.token === "string"
          ) {

            fullResponse +=
              json.token;


            if (
              typeof onChunk === "function"
            ) {

              onChunk(
                json.token
              );

            }

          }

          if (json.done === true && json.sources) {
            sources = json.sources;
          }

        } catch (error) {

          console.error(
            "Final SSE parse error:",
            error
          );

        }

      }

    }


    controller = null;


    console.log(
      "Stream ended."
    );

    console.log(
      "Final response:",
      fullResponse
    );


    return { answer: fullResponse, sources };


  } catch (error) {

    controller = null;


    if (
      error.name === "AbortError"
    ) {

      console.log(
        "Generation stopped."
      );

      return null;
    }


    console.error(
      "Chat API Error:",
      error
    )


    throw error;
  }

}
