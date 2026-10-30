import { useState } from "react";
import { FiFile, FiTrash2, FiLoader } from "react-icons/fi";

import useDocumentStore from "../store/documentStore";

export default function DocumentPanel() {
  const documents = useDocumentStore((state) => state.documents);
  const removeDocument = useDocumentStore((state) => state.removeDocument);
  const setSelectedDocument = useDocumentStore((state) => state.setSelectedDocument);
  const error = useDocumentStore((state) => state.error);

  const [deletingId, setDeletingId] = useState(null);

  // removeDocument is now async because it also deletes from the vector store
  const handleDelete = async (event, id) => {
    event.stopPropagation();
    setDeletingId(id);
    try {
      await removeDocument(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="px-4 py-3 text-xs text-gray-500">
        No documents uploaded
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {error && (
        <div className="px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {documents.map((doc) => (
        <div
          key={doc.id}
          className="group flex items-center justify-between px-4 py-3 rounded-xl hover:bg-[#262626] cursor-pointer transition"
        >
          <div
            onClick={() => setSelectedDocument(doc)}
            className="flex items-center gap-3 flex-1 min-w-0"
          >
            <FiFile className="text-gray-400 shrink-0" />

            <div className="min-w-0">
              <div className="text-sm truncate">
                {doc.filename}
              </div>

              <div className="text-xs text-gray-500 truncate">
                {doc.fileType || "Document"}
                {" • "}
                {doc.chunkCount || 0} chunks
                {" • "}
                {doc.textLength || 0} chars
              </div>
            </div>
          </div>

          <button
            onClick={(event) => handleDelete(event, doc.id)}
            disabled={deletingId === doc.id}
            className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-[#333] text-gray-400 hover:text-red-400 transition disabled:opacity-50"
          >
            {deletingId === doc.id
              ? <FiLoader size={16} className="animate-spin" />
              : <FiTrash2 size={16} />}
          </button>
        </div>
      ))}
    </div>
  );
}
