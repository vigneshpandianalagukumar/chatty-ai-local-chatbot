export default function Message({ role, content }) {
  const isUser = role === "user";

  return (
    <div
      className={`w-full flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`
          max-w-[80%]
          px-4
          py-3
          rounded-3xl
          mb-4
          whitespace-pre-wrap
          ${
            isUser
              ? "bg-[#303030] text-white"
              : "bg-[#1f1f1f] text-white"
          }
        `}
      >
        {content}
      </div>
    </div>
  );
}
