import { useState, useRef, useCallback } from "react";
import { FiPaperclip, FiArrowUp, FiSquare, FiX } from "react-icons/fi";

import useChatStore from "../store/chatStore";
import useDocumentStore from "../store/documentStore";

/*
 * IMPORTANT: this now goes through services/api.js, which posts to the
 * Express backend at /chat with `mode` in the body. The old
 * services/ollama.js + services/upload.js are no longer used here.
 */
import { sendChatMessage, uploadDocument } from "../services/api";

import VoiceButton from "./VoiceButton";

export default function InputBox({ selectedModel, chatMode }) {
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const chats = useChatStore((s) => s.chats);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateLastMessage = useChatStore((s) => s.updateLastMessage);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const setThinking = useChatStore((s) => s.setThinking);
  const setGenerating = useChatStore((s) => s.setGenerating);
  const stopGenerationState = useChatStore((s) => s.stopGenerationState);
  const fontSize = useChatStore((s) => s.fontSize);

  const addDocument = useDocumentStore((s) => s.addDocument);

  const currentChat = chats.find((chat) => chat.id === currentChatId);
  const messages = currentChat?.messages || [];

  const throttledUpdateRef = useRef(null);
  const lastStreamedContentRef = useRef("");

  const throttledUpdate = useCallback(
    (content) => {
      lastStreamedContentRef.current = content;

      if (!throttledUpdateRef.current) {
        throttledUpdateRef.current = setTimeout(() => {
          throttledUpdateRef.current = null;
          updateLastMessage(lastStreamedContentRef.current);
        }, 50);
      }
    },
    [updateLastMessage]
  );

  function flushThrottle() {
    if (throttledUpdateRef.current) {
      clearTimeout(throttledUpdateRef.current);
      throttledUpdateRef.current = null;
    }
  }

  function autoResize() {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height =
      Math.min(textareaRef.current.scrollHeight, 220) + "px";
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    setSelectedFile(file);
  }

  function removeFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleStop() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopGenerationState();
  }

  /* ---------------------------------------------------------
     UPLOAD
     --------------------------------------------------------- */

  async function handleUpload() {
    addMessage({
      role: "user",
      type: "document",
      content: `Uploaded: ${selectedFile.name}`
    });

    addMessage({
      role: "assistant",
      content: `Indexing **${selectedFile.name}**...`
    });

    setUploadProgress("Indexing...");

    try {
      const info = await uploadDocument(selectedFile);

      addDocument({
        id: info.id,
        filename: info.filename,
        fileType: info.fileType,
        textLength: info.textLength,
        chunkCount: info.chunkCount,
        preview: info.preview,
        uploadedAt: info.uploadedAt
      });

      updateLastMessage(
        `### Document indexed\n\n` +
        `**File:** ${info.filename}\n\n` +
        `**Characters:** ${info.textLength.toLocaleString()}\n\n` +
        `**Chunks:** ${info.chunkCount} (${info.dimensions}-dim vectors)\n\n` +
        `Switch the mode selector to **Document (RAG)** and ask a question about it.\n\n` +
        `---\n\n${info.preview}`
      );
    } catch (error) {
      updateLastMessage(`Upload failed: ${error.message}`);
    } finally {
      setUploadProgress(null);
      removeFile();
    }
  }

  /* ---------------------------------------------------------
     SEND
     --------------------------------------------------------- */

  async function handleSend() {
    if (isSending) return;

    try {
      setIsSending(true);

      if (selectedFile) {
        await handleUpload();
        return;
      }

      if (!input.trim()) return;

      const question = input.trim();

      addMessage({ role: "user", content: question });

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      setThinking(true);
      setGenerating(true);

      addMessage({ role: "assistant", content: "" });

      let streamedContent = "";
      let failed = false;

      const controller = new AbortController();
      abortRef.current = controller;

      const { sources } = await sendChatMessage({
        question,

        model: selectedModel,

        // THE RAG FIX: the backend defaults to "normal" without this
        mode: chatMode === "rag" ? "rag" : "normal",

        signal: controller.signal,

        onToken: (token) => {
          streamedContent += token;
          throttledUpdate(streamedContent);
        },

        onError: (error) => {
          failed = true;
          console.error("Chat error:", error.message);
        }
      });

      flushThrottle();

      if (!failed && sources && sources.length > 0) {
        const sourcesText = sources
          .map(
            (source, index) =>
              `[${index + 1}] ${source.document} — chunk ${source.chunkNumber}` +
              (source.score !== undefined ? ` (score ${source.score})` : "")
          )
          .join("\n");

        streamedContent += `\n\n---\n**Sources:**\n${sourcesText}`;
      }

      updateLastMessage(streamedContent);
    } catch (error) {
      flushThrottle();

      if (error.name === "AbortError") {
        updateLastMessage(lastStreamedContentRef.current + "\n\n_(stopped)_");
      } else {
        console.error(error);
        updateLastMessage(`Error: ${error.message}`);
      }
    } finally {
      abortRef.current = null;
      setThinking(false);
      setGenerating(false);
      setIsSending(false);
    }
  }

  const fontSizeMap = {
    small: "14px",
    normal: "16px",
    large: "18px",
    xlarge: "20px"
  };

  const isRAG = chatMode === "rag";

  return (
    <div className="px-4 pb-8">
      <div className="chat-width mx-auto">

        <div
          className="rounded-[30px] px-4 pt-2 pb-2 shadow-2xl border"
          style={{
            background: "var(--bg-card)",
            borderColor: isRAG ? "#8b5cf6" : "var(--border-color)"
          }}
        >

          {selectedFile && (
            <div
              className="mb-3 flex items-center justify-between rounded-xl px-4 py-2.5 border"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border-color)"
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">📄</span>
                <div>
                  <div className="text-sm" style={{ color: "var(--text-primary)" }}>
                    {selectedFile.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {uploadProgress || "Ready to upload"}
                  </div>
                </div>
              </div>

              <button
                onClick={removeFile}
                disabled={isSending}
                className="p-1 rounded-lg transition disabled:opacity-40"
                style={{ color: "var(--text-secondary)" }}
              >
                <FiX size={14} />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            placeholder={
              isRAG ? "Ask about your documents..." : "Message Chatty..."
            }
            rows="1"
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="w-full bg-transparent resize-none outline-none placeholder-gray-500 max-h-[240px] py-0"
            style={{
              fontSize: fontSizeMap[fontSize],
              lineHeight: 3.0,
              color: "var(--text-primary)"
            }}
          />

          <div className="flex items-center justify-between mt-3">

            <div className="flex items-center gap-2">

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl transition"
                style={{ color: "var(--text-secondary)" }}
                title="Attach a PDF, DOCX, TXT or MD file"
              >
                <FiPaperclip size={18} />
              </button>

              {/* Only formats the backend can actually index */}
              <input
                hidden
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileSelect}
              />

              {isRAG && (
                <span
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa" }}
                >
                  Document mode
                </span>
              )}

            </div>

            <div className="flex items-center gap-2">

              <VoiceButton
                onTranscript={(transcript) => {
                  setInput((prev) => (prev ? prev + " " + transcript : transcript));
                  setTimeout(autoResize, 50);
                }}
              />

              <button
                disabled={!isGenerating && !input.trim() && !selectedFile}
                onClick={() => {
                  if (isGenerating) {
                    handleStop();
                    return;
                  }
                  handleSend();
                }}
                className={`
                w-9 h-9 rounded-full flex items-center justify-center transition
                ${
                  isGenerating || input.trim() || selectedFile
                    ? "bg-white hover:bg-gray-200 text-black"
                    : "bg-[#4a4a4a] text-gray-500 cursor-not-allowed"
                }
                `}
              >
                {isGenerating ? <FiSquare size={12} /> : <FiArrowUp size={16} />}
              </button>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
