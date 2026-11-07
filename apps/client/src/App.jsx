import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import "./styles.css";
import EditorHeader from "../components/EditorHeader";
import NameModal from "../components/NameModal";
import SectionedEditor from "../components/SectionedEditor";
// const SERVER_URL = 'wss://server-collab.cloudpub.ru';

// In development the WebSocket server runs separately. In Docker/production,
// Nginx proxies /ws to the same-origin collaboration server.
// const SERVER_URL =
//   import.meta.env.VITE_WS_URL ||
//   (import.meta.env.DEV
//     ? "ws://localhost:1234"
//     : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
const SERVER_URL = "ws://localhost:1234";

// import { splitDefaultSection } from "./utils/sectionsDoc.js";
// window.split = () => splitDefaultSection(window.yDoc);

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
    if (id !== me && usage.has(c)) usage.set(c, usage.get(c) + 1);
  });
  let best = PALETTE[0];
  for (const c of PALETTE) {
    if (usage.get(c) < usage.get(best)) best = c;
  }
  return best;
}

import { resplitAll } from "./utils/sectionsDoc";

function App() {
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
  const clientId = useRef(Math.random().toString(36).substring(2)).current;
  const userColor = PLACEHOLDER_COLOR;

  useEffect(() => {
    const savedName = localStorage.getItem("userName");
    if (savedName) setUserName(savedName);
    else setShowModal(true);
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

  // useEffect(() => {
  //   if (userName && !provider) {
  //     const p = new WebsocketProvider(SERVER_URL, docId, yDoc.current);
  //     setProvider(p);
  //
  //     return () => {
  //       p.destroy();
  //       yDoc.current.destroy();
  //     };
  //   }
  // }, [userName, docId]);
  window.Y = Y;
  window.yDoc = yDoc.current;

  useEffect(() => {
    if (userName && !provider) {
      const p = new WebsocketProvider(SERVER_URL, docId, yDoc.current);

      const awareness = p.awareness;

      const ensureColor = () => {
        if (!p.synced) return;
        const mine = awareness.getLocalState()?.user;
        if (!mine) return;
        const me = awareness.clientID;
        const unassigned = !PALETTE.includes(mine.color);
        let conflict = false;
        awareness.getStates().forEach((state, id) => {
          if (id !== me && state.user?.color === mine.color && (unassigned || id < me)) {
            conflict = true;
          }
        });
        if (unassigned || conflict) {
          awareness.setLocalStateField("user", { ...mine, color: getColor(awareness) });
        }
      };

      p.on("sync", ensureColor);
      awareness.on("change", ensureColor);
      setProvider(p);
      return () => {
        awareness.off("change", ensureColor);
        p.off("sync", ensureColor);
        p.destroy();
        yDoc.current.destroy();
      };
    }
  }, [userName, docId, documentStatus]);

  // Повторное создание пустого документа с прежним ID
  const handleRecreateDocument = async () => {
    const confirmed = window.confirm(
      "Создать новый пустой документ с тем же адресом? Все, у кого есть эта ссылка, снова получат доступ к новому документу. Старое содержимое восстановить нельзя.",
    );

    if (!confirmed) return;

    setIsRecreating(true);

    try {
      const response = await fetch(
        `/api/documents/${encodeURIComponent(docId)}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));

        throw new Error(result.error || "Не удалось создать новый документ.");
      }

      // Reload to initialize a brand-new Y.Doc and provider for the reused ID.
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

  if (showModal) return <NameModal onSubmit={handleNameSubmit} />;

  if (!provider) {
    return (
      <div
        style={{
          padding: "20px",
          fontFamily: "monospace",
        }}
      >
        <h1 style={{ fontSize: "22px" }}>Документ удалён</h1>

        <p style={{ color: "#666", lineHeight: 1.6 }}>
          Этот документ удалён. Его прежнее содержимое восстановить нельзя, но
          можно создать новый пустой документ по этому же адресу.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <button
            onClick={handleRecreateDocument}
            disabled={isRecreating}
            style={{
              padding: "10px 16px",
              background: "#000",
              color: "#fff",
              border: "none",
              cursor: isRecreating ? "wait" : "pointer",
              opacity: isRecreating ? 0.6 : 1,
              fontFamily: "monospace",
            }}
          >
            {isRecreating
              ? "Создание..."
              : "Создать новый документ по этой ссылке"}
          </button>

          <button
            onClick={() => {
              const newId = Math.random().toString(36).substring(2, 10);
              window.location.href = `/d/${newId}`;
            }}
            style={{
              padding: "10px 16px",
              background: "#fff",
              color: "#000",
              border: "1px solid #000",
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            Создать документ с новой ссылкой
          </button>
        </div>
      </div>
    );
  }

  if (documentStatus === "error") {
    return (
      <div
        style={{
          padding: "48px 24px",
          maxWidth: "560px",
          margin: "0 auto",
          fontFamily: "monospace",
        }}
      >
        Подключение к серверу...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Редактор */}
      <div>
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
    </div>
  );
}

// ===== Корневой компонент с роутингом через pathname =====
function App() {
  const path = window.location.pathname;
  const match = path.match(/^\/d\/([^/]+)$/);

  // Главная страница: "/" или любой путь, не начинающийся с "/d/"
  if (!match) {
    return <HomePage />;
  }

  // Редактор: "/d/<id>"
  const docId = match[1];
  return <DocumentEditor docId={docId} />;
}

export default App;
