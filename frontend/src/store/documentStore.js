import { create } from "zustand";
import { persist } from "zustand/middleware";

import { deleteIndexedDocument, fetchIndexedDocuments } from "../services/api";

const useDocumentStore = create(
  persist(
    (set, get) => ({
      documents: [],
      selectedDocument: null,
      error: null,

      addDocument: (documentData) => {
        set((state) => ({
          documents: [
            {
              // Guarantee an id even if the backend forgets one
              id: documentData.id || `${Date.now()}_${documentData.filename}`,
              ...documentData
            },
            ...state.documents.filter(
              (doc) => doc.filename !== documentData.filename
            )
          ],
          error: null
        }));
      },

      /*
       * FIX: this now deletes from the vector store too.
       * Previously it only cleared localStorage, so removed
       * documents stayed searchable forever.
       */
      removeDocument: async (id) => {
        const doc = get().documents.find((item) => item.id === id);

        if (!doc) return;

        try {
          await deleteIndexedDocument(doc.filename);
        } catch (error) {
          console.error("Failed to delete from index:", error.message);
          set({ error: error.message });
          return;
        }

        set((state) => ({
          documents: state.documents.filter((item) => item.id !== id),
          selectedDocument:
            state.selectedDocument?.id === id ? null : state.selectedDocument,
          error: null
        }));
      },

      setSelectedDocument: (doc) => {
        set({ selectedDocument: doc });
      },

      /*
       * Reconciles localStorage with what the server actually has.
       * Call this on app start - otherwise the panel can show
       * documents that no longer exist in the index.
       */
      syncWithServer: async () => {
        try {
          const data = await fetchIndexedDocuments();
          const indexed = new Set((data.documents || []).map((d) => d.filename));

          set((state) => ({
            documents: state.documents.filter((doc) => indexed.has(doc.filename))
          }));
        } catch (error) {
          console.error("Document sync failed:", error.message);
        }
      }
    }),
    {
      name: "local-document-storage",
      partialize: (state) => ({ documents: state.documents })
    }
  )
);

export default useDocumentStore;
