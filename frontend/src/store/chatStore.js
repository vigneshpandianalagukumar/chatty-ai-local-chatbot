import { create } from "zustand";

function createChat(chatNumber = 1) {
  return {
    id: Date.now().toString(),
    title: `Chat ${chatNumber}`,
    messages: []
  };
}

function persistToLocalStorage(state) {
  const data = {
    chats: state.chats,
    currentChatId: state.currentChatId,
    fontSize: state.fontSize,
    lineSpacing: state.lineSpacing,
    chatWidth: state.chatWidth,
    theme: state.theme,
    chatMode: state.chatMode
  };
  try {
    localStorage.setItem("qwen-chat-history", JSON.stringify(data));
  } catch {}
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem("qwen-chat-history");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

const persisted = loadFromLocalStorage();

const useChatStore = create((set, get) => {
  let persistTimer = null;

  function debouncedPersist(state) {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persistToLocalStorage(state), 500);
  }

  return {
    chats: persisted?.chats || [createChat()],
    currentChatId: persisted?.currentChatId || null,
    isThinking: false,
    isGenerating: false,
    editingMessageIndex: null,
    chatMode: persisted?.chatMode || "normal",

    fontSize: persisted?.fontSize || "normal",
    lineSpacing: persisted?.lineSpacing || "normal",
    chatWidth: persisted?.chatWidth || "normal",
    theme: persisted?.theme || "dark",

    setThinking: (value) => set({ isThinking: value }),

    setGenerating: (value) => set({ isGenerating: value }),

    stopGenerationState: () => set({ isGenerating: false, isThinking: false }),

    setEditingMessageIndex: (index) => set({ editingMessageIndex: index }),

    setChatMode: (mode) => {
      set({ chatMode: mode });
      debouncedPersist(get());
    },

    setFontSize: (value) => {
      set({ fontSize: value });
      debouncedPersist(get());
    },
    setLineSpacing: (value) => {
      set({ lineSpacing: value });
      debouncedPersist(get());
    },
    setChatWidth: (value) => {
      set({ chatWidth: value });
      debouncedPersist(get());
    },
    setTheme: (theme) => {
      set({ theme });
      debouncedPersist(get());
    },

    initialize: () => {
      const chats = get().chats;
      if (!get().currentChatId && chats.length > 0) {
        set({ currentChatId: chats[0].id });
      }
    },

    createNewChat: () => {
      const state = get();
      const newChat = createChat(state.chats.length + 1);
      set({ chats: [newChat, ...state.chats], currentChatId: newChat.id });
      debouncedPersist(get());
    },

    setCurrentChat: (id) => {
      set({ currentChatId: id });
      debouncedPersist(get());
    },

    deleteChat: (id) => {
      const remainingChats = get().chats.filter((chat) => chat.id !== id);
      if (remainingChats.length === 0) {
        const newChat = createChat();
        set({ chats: [newChat], currentChatId: newChat.id });
        debouncedPersist(get());
        return;
      }
      set({ chats: remainingChats, currentChatId: remainingChats[0].id });
      debouncedPersist(get());
    },

    renameChat: (id, title) => {
      set((state) => ({
        chats: state.chats.map((chat) =>
          chat.id === id ? { ...chat, title } : chat
        )
      }));
      debouncedPersist(get());
    },

    addMessage: (message) => {
      const { chats, currentChatId } = get();
      const updatedChats = chats.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const updatedMessages = [
          ...chat.messages,
          { ...message, timestamp: Date.now() }
        ];
        let title = chat.title;
        if (chat.messages.length === 0 && message.role === "user") {
          title = message.content.slice(0, 35).trim();
        }
        return { ...chat, title, messages: updatedMessages };
      });
      set({ chats: updatedChats });
      debouncedPersist(get());
    },

    updateLastMessage: (content) => {
      const { chats, currentChatId } = get();
      const updatedChats = chats.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const messages = [...chat.messages];
        if (messages.length > 0) {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content
          };
        }
        return { ...chat, messages };
      });
      set({ chats: updatedChats });
      debouncedPersist(get());
    },

    updateMessage: (index, content) => {
      const { chats, currentChatId } = get();
      const updatedChats = chats.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const messages = [...chat.messages];
        if (messages[index]) {
          messages[index] = { ...messages[index], content };
        }
        return { ...chat, messages };
      });
      set({ chats: updatedChats });
      debouncedPersist(get());
    },

    deleteLastAssistantMessage: () => {
      const { chats, currentChatId } = get();
      const updatedChats = chats.map((chat) => {
        if (chat.id !== currentChatId) return chat;
        const messages = [...chat.messages];
        if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
          messages.pop();
        }
        return { ...chat, messages };
      });
      set({ chats: updatedChats });
      debouncedPersist(get());
    },

    getCurrentMessages: () => {
      const { chats, currentChatId } = get();
      const currentChat = chats.find((chat) => chat.id === currentChatId);
      return currentChat?.messages || [];
    }
  };
});

export default useChatStore;