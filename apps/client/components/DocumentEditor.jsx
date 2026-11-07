import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import EditorHeader from "./EditorHeader";
import NameModal from "./NameModal";
import SectionedEditor from "./SectionedEditor";
import { resplitAll } from "../src/utils/sectionsDoc";

const SERVER_URL = "ws://localhost:1234";

const PALETTE = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788",
];
const PLACEHOLDER_COLOR = "#adb5bd";

function getColor(awareness) {
  const me = awareness.clientID;
  const usage = new Map(PALETTE.map((c) => [c, 0]));
  awareness.getStates().forEach((state, id) => {
    const c = state.user?.color;
    if (id !== me && usage.has(c)) {
      usage.set(c, usage.get(c) + 1);
    }
  });
  let best = PALETTE[0];
  for (const c of PALETTE) {
    if (usage.get(c) < usage.get(best)) best = c;
  }
  return best;
}

export default function DocumentEditor() {
  const { docId } = useParams();

  useEffect(() => {
    window.yDoc = yDoc.current;
    window.resplit = () => resplitAll(yDoc.current);
  }, []);

  const yDoc = useRef(new Y.Doc());
  const yMetadata = useRef(yDoc.current.getMap("metadata"));
  const [provider, setProvider] = useState(null);
  const [userName, setUserName] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [docName, setDocName] = useState("");
  const [documentStatus, setDocumentStatus] = useState("checking");
  const [isRecreating, setIsRecreating] = useState(false);
  const clientId = useRef(Math.random().toString(36).substring(2)).current;
  const userColor = PLACEHOLDER_COLOR;

  useEffect(() => {
    const savedName = localStorage.getItem("userName");
    if (savedName) {
      setUserName(savedName);
    } else {
      setShowModal(true);
    }
  }, []);

  useEffect(() => {
    if (!userName) return undefined;
    let cancelled = false;
    const checkDocument = async () => {
      try {
        const response = await fetch(
          `/api/documents/${encodeURIComponent(docId)}`,
        );
        if (!response.ok) {
          throw new Error("Не удалось проверить доступность документа.");
        }
        const result = await response.json();
        if (!cancelled) {
          setDocumentStatus(result.deleted ? "deleted" : "available");
        }
      } catch (error) {
        console.error("Document status check failed:", error);
        if (!cancelled) {
          setDocumentStatus("error");
        }
      }
    };
    checkDocument();
    return () => {
      cancelled = true;
    };
  }, [docId, userName]);

  window.Y = Y;
  window.yDoc = yDoc.current;

  useEffect(() => {
    if (userName && documentStatus === "available" && !provider) {
      const p = new WebsocketProvider(SERVER_URL, docId, yDoc.current);
      const awareness = p.awareness;

      const handleProviderStatus = async ({ status }) => {
        if (status !== "disconnected") return;
        try {
          const response = await fetch(
            `/api/documents/${encodeURIComponent(docId)}`,
          );
          if (!response.ok) return;
          const result = await response.json();
          if (result.deleted) {
            setDocumentStatus("deleted");
          }
        } catch (error) {
          console.error("Unable to refresh document status:", error);
        }
      };
      p.on("status", handleProviderStatus);

      const ensureColor = () => {
        if (!p.synced) return;
        const mine = awareness.getLocalState()?.user;
        if (!mine) return;
        const me = awareness.clientID;
        const unassigned = !PALETTE.includes(mine.color);
        let conflict = false;
        awareness.getStates().forEach((state, id) => {
          if (
            id !== me &&
            state.user?.color === mine.color &&
            (unassigned || id < me)
          ) {
            conflict = true;
          }
        });
        if (unassigned || conflict) {
          awareness.setLocalStateField("user", {
            ...mine,
            color: getColor(awareness),
          });
        }
      };

      p.on("sync", ensureColor);
      awareness.on("change", ensureColor);
      setProvider(p);

      return () => {
        awareness.off("change", ensureColor);
        p.off("sync", ensureColor);
        p.off("status", handleProviderStatus);
        p.destroy();
        yDoc.current.destroy();
      };
    }
  }, [userName, docId, documentStatus]);

  const handleRecreateDocument = async () => {
    const confirmed = window.confirm(
      "Создать новый пустой документ с тем же адресом? Все, у кого есть эта ссылка, снова получат доступ к новому документу. Старое содержимое восстановить нельзя.",
    );
    if (!confirmed) return;
    setIsRecreating(true);
    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(docId)}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Не удалось создать новый документ.");
      }
      window.location.reload();
    } catch (error) {
      console.error("Document recreation failed:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Не удалось создать новый документ.",
      );
      setIsRecreating(false);
    }
  };

  const handleNameSubmit = (name) => {
    localStorage.setItem("userName", name);
    window.location.reload();
  };

  const handleChangeName = () => {
    localStorage.removeItem("userName");
    setShowModal(true);
  };

  if (showModal) {
    return <NameModal onSubmit={handleNameSubmit} />;
  }

  if (documentStatus === "deleted") {
    return (
      <div className="mx-auto max-w-xl px-5 py-12 font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif]">
        <h1 className="text-[22px] font-semibold">Документ удалён</h1>
        <p className="mt-3 leading-relaxed text-[#5f6672]">
          Этот документ удалён. Его прежнее содержимое восстановить нельзя, но
          можно создать новый пустой документ по этому же адресу.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={handleRecreateDocument}
            disabled={isRecreating}
            className="h-10 cursor-pointer rounded-lg bg-[#003399] px-4 text-sm font-medium text-white transition-colors hover:bg-[#002a80] disabled:cursor-wait disabled:opacity-60"
          >
            {isRecreating ? "Создание..." : "Создать новый документ по этой ссылке"}
          </button>
          <button
            onClick={() => {
              const newId = Math.random().toString(36).substring(2, 10);
              window.location.href = `/d/${newId}`;
            }}
            className="h-10 cursor-pointer rounded-lg border border-[#d5dae3] bg-white px-4 text-sm font-medium text-[#1a1a1a] transition-colors hover:bg-[#f0f2f6]"
          >
            Создать документ с новой ссылкой
          </button>
        </div>
      </div>
    );
  }

  if (documentStatus === "error") {
    return (
      <div className="mx-auto max-w-xl px-5 py-12 font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif]">
        <h1 className="text-[22px] font-semibold">Не удалось подключиться</h1>
        <p className="mt-3 leading-relaxed text-[#5f6672]">
          Не удалось проверить документ. Проверьте соединение и попробуйте ещё раз.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 h-10 cursor-pointer rounded-lg bg-[#003399] px-4 text-sm font-medium text-white transition-colors hover:bg-[#002a80]"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="p-5 font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif] text-[#5f6672]">
        {documentStatus === "checking"
          ? "Проверка документа..."
          : "Подключение к серверу..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif]">
      <SectionedEditor
        provider={provider}
        yDoc={yDoc.current}
        userName={userName}
        userColor={userColor}
        clientId={clientId}
        header={(editor) => (
          <EditorHeader
            editor={editor}
            yDoc={yDoc.current}
            provider={provider}
            docId={docId}
            docName={docName}
            setDocName={setDocName}
            yMetadata={yMetadata}
            userName={userName}
            handleChangeName={handleChangeName}
            onDocumentDeleted={() => setDocumentStatus("deleted")}
          />
        )}
      />
    </div>
  );
}