import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import "./styles.css";

import EditorHeader from "../components/EditorHeader";
import NameModal from "../components/NameModal";
import TipTapEditor from "../components/TipTapEditor";
import HomePage from "../components/HomePage";

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
    if (id !== me && usage.has(c)) usage.set(c, usage.get(c) + 1);
  });
  let best = PALETTE[0];
  for (const c of PALETTE) {
    if (usage.get(c) < usage.get(best)) best = c;
  }
  return best;
}

// ===== Редактор (бывший App) =====
function DocumentEditor({ docId }) {
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
    const updateName = () => {
      const name = yMetadata.current.get("name");
      if (name) setDocName(name);
    };
    yMetadata.current.observe(updateName);
    if (yMetadata.current.get("name")) {
      setDocName(yMetadata.current.get("name"));
    } else {
      setDocName(`Документ ${docId}`);
    }
    return () => yMetadata.current.unobserve(updateName);
  }, [docId]);

  useEffect(() => {
    document.title = docName ? `${docName} — Collab Editor` : "Collab Editor";
  }, [docName]);

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
  }, [userName, docId]);

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
          fontSize: "14px",
          color: "#555",
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
      <TipTapEditor
        provider={provider}
        yDoc={yDoc.current}
        userName={userName}
        userColor={userColor}
        clientId={clientId}
        header={(editor) => (
          <EditorHeader
            editor={editor}
            provider={provider}
            docId={docId}
            docName={docName}
            setDocName={setDocName}
            yMetadata={yMetadata}
            userName={userName}
            handleChangeName={handleChangeName}
          />
        )}
      />
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