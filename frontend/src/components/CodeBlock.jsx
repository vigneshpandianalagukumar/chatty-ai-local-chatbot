import { useState } from "react";

import {
  FiCopy,
  FiCheck
} from "react-icons/fi";

import {
  Prism as SyntaxHighlighter
} from "react-syntax-highlighter";

import {
  oneDark
} from "react-syntax-highlighter/dist/esm/styles/prism";

export default function CodeBlock({
  language,
  value
}) {

  const [copied, setCopied] =
    useState(false);

  async function copyCode() {

    await navigator.clipboard.writeText(
      value
    );

    setCopied(true);

    setTimeout(() => {

      setCopied(false);

    }, 2000);

  }

  return (

    <div
      className="
      my-4
      overflow-hidden
      rounded-2xl
      border
      border-[#2d2d2d]
      "
    >

      <div
        className="
        flex
        items-center
        justify-between

        bg-[#1b1b1b]

        px-4
        py-3
        "
      >

        <span
          className="
          text-xs
          uppercase
          text-gray-400
          "
        >
          {language || "code"}
        </span>

        <button
          onClick={copyCode}
          className="
          flex
          items-center
          gap-2

          text-sm

          text-gray-300

          hover:text-white
          "
        >

          {
            copied
              ? <FiCheck />
              : <FiCopy />
          }

          {
            copied
              ? "Copied"
              : "Copy"
          }

        </button>

      </div>

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background:
            "#111111"
        }}
      >
        {value}
      </SyntaxHighlighter>

    </div>

  );

}
