import { useState, useEffect } from "react";

import {
  FiMenu,
  FiTrash2,
  FiSun,
  FiMoon
} from "react-icons/fi";

import ChatWindow from "./components/ChatWindow";
import InputBox from "./components/InputBox";
import ModelSelector from "./components/ModelSelector";
import DocumentViewer from "./components/DocumentViewer";
import DocumentPanel from "./components/DocumentPanel";

import useChatStore from "./store/chatStore";
import useDocumentStore from "./store/documentStore";

import { checkHealth } from "./services/api";

function App() {

  const [selectedModel, setSelectedModel] = useState(
    "Qwen/Qwen3-8B-GGUF:Q4_K_M"
  );

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [search, setSearch] = useState("");

  /* RAG health: tells the user WHY document mode is not answering */
  const [health, setHealth] = useState(null);

  const chats = useChatStore((state) => state.chats);
  const currentChatId = useChatStore((state) => state.currentChatId);
  const createNewChat = useChatStore((state) => state.createNewChat);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const initialize = useChatStore((state) => state.initialize);

  const fontSize = useChatStore((state) => state.fontSize);
  const setFontSize = useChatStore((state) => state.setFontSize);

  const chatWidth = useChatStore((state) => state.chatWidth);
  const setChatWidth = useChatStore((state) => state.setChatWidth);

  const theme = useChatStore((state) => state.theme);
  const setTheme = useChatStore((state) => state.setTheme);

  const chatMode = useChatStore((state) => state.chatMode);
  const setChatMode = useChatStore((state) => state.setChatMode);

  const documents = useDocumentStore((state) => state.documents);
  const syncWithServer = useDocumentStore((state) => state.syncWithServer);

  useEffect(() => {
    initialize();

    // Drops any localStorage document that is no longer in the index
    syncWithServer();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  /* Poll health so the badge reflects a server you start later */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await checkHealth();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) setHealth({ ragReady: false, offline: true });
      }
    };

    load();

    const timer = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [documents.length]);

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  );

  /* ---------------- RAG status text ---------------- */

  const ragStatus = (() => {
    if (!health) return { color: "#6b7280", label: "Checking..." };
    if (health.offline) return { color: "#ef4444", label: "Backend offline" };
    if (!health.embeddingServer?.ok) return { color: "#ef4444", label: "Embedding server down (:8081)" };
    if (!health.vectorStore?.totalChunks) return { color: "#f59e0b", label: "No documents indexed" };
    return {
      color: "#22c55e",
      label: `RAG ready — ${health.vectorStore.totalChunks} chunks`
    };
  })();

  return (
    <div
      className="h-dvh flex overflow-hidden"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)"
      }}
    >

      {/* Mobile Overlay */}

      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}

      <aside
        className={`
        fixed
        md:relative
        z-40
        h-full
        w-72
        border-r
        border-[var(--border-color)]
        flex
        flex-col
        transition-all
        duration-300
        ${
          sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden"
        }
        `}
        style={{
          background: "var(--bg-sidebar)",
          color: "var(--text-primary)"
        }}
      >

        {/* Branding */}

        <div className="px-5 pt-6 pb-4">

          <h1 className="text-3xl font-bold tracking-tight">
            Chatty
          </h1>

          <p
            style={{ color: "var(--text-secondary)" }}
            className="text-sm mt-1"
          >
            Your Local AI Assistant
          </p>

        </div>

        {/* New Chat */}

        <div className="px-4 pb-4">

          <button
            onClick={createNewChat}
            className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl p-3 font-medium transition"
            style={{ color: "#ffffff" }}
          >
            + New Chat
          </button>

        </div>

        {/* Search */}

        <div className="px-4 pb-4">

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl p-3 outline-none border"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              borderColor: "var(--border-color)"
            }}
          />

        </div>

        {/* Chat List */}

        <div className="flex-1 overflow-y-auto px-3">

          <div
            className="text-xs px-2 mb-3 tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            RECENT CHATS
          </div>

          {filteredChats.map((chat) => (

            <div
              key={chat.id}
              className="flex items-center justify-between p-3 rounded-xl mb-1 cursor-pointer transition"
              style={{
                background:
                  currentChatId === chat.id
                    ? "var(--bg-selected)"
                    : "transparent"
              }}
              onMouseEnter={(e) => {
                if (currentChatId !== chat.id) {
                  e.currentTarget.style.background = "var(--bg-hover)";
                }
              }}
              onMouseLeave={(e) => {
                if (currentChatId !== chat.id) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >

              <div
                onClick={() => setCurrentChat(chat.id)}
                className="truncate flex-1"
              >
                {chat.title}
              </div>

              <button
                onClick={() => {
                  const ok = window.confirm(`Delete "${chat.title}" ?`);
                  if (ok) deleteChat(chat.id);
                }}
                className="p-1 hover:text-red-400 transition"
                style={{ color: "var(--text-secondary)" }}
              >
                <FiTrash2 />
              </button>

            </div>

          ))}

        </div>

        {/* Documents

            NOTE: if your DocumentViewer already renders
            <DocumentPanel />, delete this block so the list
            does not appear twice. */}

        <div className="border-t border-[var(--border-color)] pt-3 pb-2 max-h-64 overflow-y-auto">

          <div
            className="text-xs px-5 mb-2 tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            DOCUMENTS
          </div>

          <DocumentPanel />

        </div>

        {/* RAG status */}

        <div
          className="px-5 py-3 border-t border-[var(--border-color)] flex items-center gap-2 text-xs"
          style={{ color: "var(--text-secondary)" }}
          title={
            health?.embeddingServer?.error ||
            "Chat server :8080, embedding server :8081"
          }
        >

          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: ragStatus.color }}
          />

          <span className="truncate">
            {ragStatus.label}
          </span>

        </div>

      </aside>

      {/* Main */}

      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}

        <div
          className="h-16 border-b border-[var(--border-color)] flex items-center justify-between px-6 shrink-0"
          style={{
            background: "var(--bg-sidebar)",
            color: "var(--text-primary)"
          }}
        >

          <div className="flex items-center gap-4">

            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg transition"
              style={{ backgroundColor: "transparent" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-selected)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <FiMenu size={20} />
            </button>

            <div>

              <div className="text-lg font-semibold">
                Chatty
              </div>

              <div
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                {selectedModel}
              </div>

            </div>

          </div>

          <div className="flex items-center gap-3">

            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm border outline-none"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor: "var(--border-color)"
              }}
            >
              <option value="small">A-</option>
              <option value="normal">Normal</option>
              <option value="large">A+</option>
              <option value="xlarge">A++</option>
            </select>

            <select
              value={chatWidth}
              onChange={(e) => setChatWidth(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm border outline-none"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor: "var(--border-color)"
              }}
            >
              <option value="narrow">Narrow</option>
              <option value="normal">Normal</option>
              <option value="wide">Wide</option>
            </select>

            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-xl transition"
              style={{ color: "var(--text-primary)" }}
            >
              {theme === "dark" ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            <select
              value={chatMode}
              onChange={(e) => setChatMode(e.target.value)}
              className="rounded-xl px-3 py-2 text-sm border outline-none"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                borderColor:
                  chatMode === "rag" && health && !health.ragReady
                    ? "#f59e0b"
                    : "var(--border-color)"
              }}
            >
              <option value="normal">Normal</option>
              <option value="rag">Document (RAG)</option>
            </select>

            <ModelSelector
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
            />

          </div>

        </div>

        {/* Warning banner when RAG is selected but cannot work */}

        {chatMode === "rag" && health && !health.ragReady && (
          <div
            className="px-6 py-2 text-xs shrink-0"
            style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}
          >
            Document mode is on, but {ragStatus.label.toLowerCase()}.
            {!health.embeddingServer?.ok &&
              " Start the embedding server on port 8081 with --embedding --pooling mean."}
          </div>
        )}

        {/* Chat */}

        <ChatWindow />

        {/* Input */}

        <InputBox
          selectedModel={selectedModel}
          chatMode={chatMode}
        />

        {/* Document Viewer */}

        <DocumentViewer />

      </main>

    </div>
  );
}

export default App;
