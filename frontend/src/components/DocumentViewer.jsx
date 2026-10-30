import { FiX, FiFileText } from "react-icons/fi";

import useDocumentStore from "../store/documentStore";

function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function DocumentViewer() {
  const selectedDocument = useDocumentStore((state) => state.selectedDocument);
  const setSelectedDocument = useDocumentStore((state) => state.setSelectedDocument);

  if (!selectedDocument) return null;

  return (
    <>
      {/* Click-away overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => setSelectedDocument(null)}
      />

      <div
        className="fixed top-0 right-0 h-full w-full max-w-[500px] border-l z-50 flex flex-col"
        style={{
          background: "var(--bg-sidebar)",
          borderColor: "var(--border-color)",
          color: "var(--text-primary)"
        }}
      >

        {/* Header */}

        <div
          className="p-5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >

          <div className="flex items-center gap-3 min-w-0">

            <FiFileText className="shrink-0" />

            <div className="min-w-0">

              <div className="font-medium truncate">
                {selectedDocument.filename}
              </div>

              <div
                className="text-xs truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {selectedDocument.fileType || "Document"}
                {" • "}
                {(selectedDocument.textLength || 0).toLocaleString()} chars
                {selectedDocument.chunkCount
                  ? ` • ${selectedDocument.chunkCount} chunks`
                  : ""}
              </div>

            </div>

          </div>

          <button
            onClick={() => setSelectedDocument(null)}
            className="p-2 rounded-lg transition shrink-0"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <FiX size={18} />
          </button>

        </div>

        {/* Content */}

        <div className="flex-1 overflow-y-auto p-5">

          <div
            className="text-xs mb-3 uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            Extracted text preview
          </div>

          <div className="whitespace-pre-wrap text-sm leading-7">
            {selectedDocument.preview || "No preview available."}
          </div>

        </div>

        {/* Footer */}

        <div
          className="border-t p-4 text-xs shrink-0"
          style={{
            borderColor: "var(--border-color)",
            color: "var(--text-secondary)"
          }}
        >
          Uploaded: {formatDate(selectedDocument.uploadedAt)}
        </div>

      </div>
    </>
  );
}
