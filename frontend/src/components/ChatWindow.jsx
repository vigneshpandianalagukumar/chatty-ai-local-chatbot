import { useEffect, useRef, memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FiCopy, FiUser } from "react-icons/fi";
import { RiRobot2Line } from "react-icons/ri";
import CodeBlock from "./CodeBlock";
import useChatStore from "../store/chatStore";

const MemoMarkdown = memo(function MemoMarkdown({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          if (match) {
            return (
              <CodeBlock
                language={match[1]}
                value={String(children).replace(/\n$/, "")}
              />
            );
          }
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

function copyMessage(text) {
  navigator.clipboard.writeText(text);
}

const fontSizeMap = {
  small: "16px",
  normal: "18px",
  large: "20px",
  xlarge: "22px"
};

const lineSpacingMap = {
  compact: 1.68,
  normal: 1.85,
  comfortable: 2.05
};

const widthMap = {
  narrow: "950px",
  normal: "1100px",
  wide: "1400px"
};

export default function ChatWindow() {
  const chats = useChatStore((s) => s.chats);
  const currentChatId = useChatStore((s) => s.currentChatId);
  const isThinking = useChatStore((s) => s.isThinking);
  const fontSize = useChatStore((s) => s.fontSize);
  const lineSpacing = useChatStore((s) => s.lineSpacing);
  const chatWidth = useChatStore((s) => s.chatWidth);

  const currentChat = chats.find((chat) => chat.id === currentChatId);
  const messages = currentChat?.messages || [];
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="h-full flex flex-col items-center justify-center px-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-4xl font-bold mb-8">
            C
          </div>
          <h1 className="text-5xl font-bold mb-4">Chatty</h1>
          <p className="text-xl mb-10" style={{ color: "var(--text-secondary)" }}>
            How can I help you today?
          </p>
          <div className="flex flex-wrap gap-3 justify-center max-w-4xl">
            <button className="px-5 py-3 rounded-2xl transition" style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
              📄 Analyze a document
            </button>
            <button className="px-5 py-3 rounded-2xl transition" style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
              💻 Write code
            </button>
            <button className="px-5 py-3 rounded-2xl transition" style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
              📚 Explain concepts
            </button>
            <button className="px-5 py-3 rounded-2xl transition" style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
              ✨ Summarize text
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto px-8 py-10" style={{ maxWidth: widthMap[chatWidth] }}>
        {messages.map((message, index) => (
          <div key={index} className="mb-8">
            {message.role === "assistant" ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                    <RiRobot2Line size={18} />
                  </div>
                  <div className="font-medium text-lg" style={{ color: "var(--text-primary)" }}>
                    Chatty
                  </div>
                </div>
                <div className="ml-14 group relative">
                  <button
                    onClick={() => copyMessage(message.content)}
                    className="absolute -right-10 top-0 opacity-0 group-hover:opacity-100 p-2 rounded-lg transition"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <FiCopy />
                  </button>
                  <div
                    className="prose prose-invert max-w-none prose-p:mb-[10px] prose-li:mb-[5px] prose-headings:mb-3 prose-headings:mt-4 prose-headings:font-semibold prose-h1:text-[1.35em] prose-h2:text-[1.25em] prose-h3:text-[1.15em] [&_hr]:!hidden [&_hr]:!border-0 [&_hr]:!my-0 prose-pre:p-0 prose-pre:bg-transparent prose-code:before:hidden prose-code:after:hidden"
                    style={{
                      fontSize: fontSizeMap[fontSize],
                      lineHeight: lineSpacingMap[lineSpacing],
                      color: "var(--text-primary)"
                    }}
                  >
                    <MemoMarkdown content={message.content} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div className="max-w-[80%]">
                  <div className="flex justify-end items-center gap-3 mb-3">
                    <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      You
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-color)" }}>
                      <FiUser />
                    </div>
                  </div>
                  <div
                    className="rounded-[28px] px-5 py-4"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      fontSize: fontSizeMap[fontSize],
                      lineHeight: lineSpacingMap[lineSpacing]
                    }}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                <RiRobot2Line />
              </div>
              <div className="font-medium text-lg" style={{ color: "var(--text-primary)" }}>
                Chatty
              </div>
            </div>
            <div className="ml-14">
              <div className="flex gap-2 items-center">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}