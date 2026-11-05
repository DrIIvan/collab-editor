import React, { useEffect, useRef, useState } from "react";
// import { useEditor, EditorContent } from "@tiptap/react";
// import StarterKit from "@tiptap/starter-kit";
// import Collaboration from "@tiptap/extension-collaboration";
// // import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
// import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import "./styles.css";
import EditorHeader from "../components/EditorHeader";
import NameModal from "../components/NameModal";
import TipTapEditor from "../components/TipTapEditor";
import SectionEditor from "../components/SectionEditor";

// const SERVER_URL = 'wss://server-collab.cloudpub.ru';

// In development the WebSocket server runs separately. In Docker/production,
// Nginx proxies /ws to the same-origin collaboration server.
const SERVER_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV
    ? "ws://localhost:1234"
    : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);

const PALETTE = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#52B788",
];

const PLACEHOLDER_COLOR = "#adb5bd";

// function getColor(clientId) {
//   const hash = clientId
//     .split("")
//     .reduce((acc, char) => acc + char.charCodeAt(0), 0);
//   return PALETTE[hash % PALETTE.length];
// }

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

// Секция монтирует редактор, только когда она рядом с экраном
function LazySection(props) {
  const ref = useRef(null);
  const heightRef = useRef(400);
  const [visible, setVisible] = useState(props.eager === true);

  // показываем редактор, когда секция рядом с экраном (запас 800px)
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      {
        rootMargin: "800px 0px",
      },
    );

    io.observe(ref.current);

    return () => io.disconnect();
  }, []);

  // запоминаем высоту, чтобы скролл не прыгал, когда секция выгружается
  useEffect(() => {
    if (!visible) return;

    const ro = new ResizeObserver(() => {
      heightRef.current = ref.current.offsetHeight;
    });

    ro.observe(ref.current);

    return () => ro.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      style={{ minHeight: visible ? undefined : heightRef.current }}
    >
      {visible && <SectionEditor {...props} />}
    </div>
  );
}

function App() {
  const yDoc = useRef(new Y.Doc());
  const yMetadata = useRef(yDoc.current.getMap("metadata"));

  const [provider, setProvider] = useState(null);
  const [userName, setUserName] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [docName, setDocName] = useState("");
  const [documentStatus, setDocumentStatus] = useState("checking");
  const [isRecreating, setIsRecreating] = useState(false);

  const docId = window.location.pathname.split("/").pop() || "default";
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

  // A deleted document must not be recreated when someone opens an old link.
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

  useEffect(() => {
    if (userName && documentStatus === "available" && !provider) {
      const p = new WebsocketProvider(SERVER_URL, docId, yDoc.current);
      const awareness = p.awareness;

      // Other collaborators are also moved out of the editor when the server
      // closes a room after deletion.
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

      // Выбираем цвет, если он ещё не выбран или его занял клиент с меньшим clientID
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

        throw new Error(
          result.error || "Не удалось создать новый документ.",
        );
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
    window.location.reload(); // Перезагружаем страницу для корректной инициализации
  };

  const handleChangeName = () => {
    localStorage.removeItem("userName");
    setShowModal(true);
  };

  if (showModal) {
    return <NameModal onSubmit={handleNameSubmit} />;
  }

  // Экран удалённого документа
  if (documentStatus === "deleted") {
    return (
      <div
        style={{
          padding: "48px 24px",
          maxWidth: "560px",
          margin: "0 auto",
          fontFamily: "monospace",
        }}
      >
        <h1 style={{ fontSize: "22px" }}>Документ удалён</h1>

        <p style={{ color: "#666", lineHeight: 1.6 }}>
          Этот документ удалён. Его прежнее содержимое восстановить нельзя,
          но можно создать новый пустой документ по этому же адресу.
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
        <h1 style={{ fontSize: "22px" }}>Не удалось подключиться</h1>

        <p style={{ color: "#666", lineHeight: 1.6 }}>
          Не удалось проверить документ. Проверьте соединение и попробуйте ещё
          раз.
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 16px",
            background: "#000",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!provider) {
    return (
      <div style={{ padding: "20px" }}>
        {documentStatus === "checking"
          ? "Проверка документа..."
          : "Подключение к серверу..."}
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
              onDocumentDeleted={() => setDocumentStatus("deleted")}
            />
          )}
        />
      </div>
    </div>
  );
}

export default App;