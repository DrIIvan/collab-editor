import React, { useEffect, useRef, useState } from "react";
// import { useEditor, EditorContent } from "@tiptap/react";
// import StarterKit from "@tiptap/starter-kit";
// import Collaboration from "@tiptap/extension-collaboration";
// // import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
// import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import "./styles.css";
import MenuBar from "../components/MenuBar";
import EditorHeader from "../components/EditorHeader";
import NameModal from "../components/NameModal";
import TipTapEditor from "../components/TipTapEditor";
import SectionEditor from "../components/SectionEditor";

// const SERVER_URL = 'wss://server-collab.cloudpub.ru';

// ↓ это если запускаешь через npm run dev
const SERVER_URL = "ws://localhost:1234";
// ↓ это если запускаешь через докер
// const SERVER_URL =
//   import.meta.env.VITE_WS_URL ||
//   `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

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
    if (id !== me && usage.has(c)) usage.set(c, usage.get(c) + 1);
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
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "800px 0px",
    });
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

  // useEffect(() => {
  //   if (userName && !provider) {
  //     const p = new WebsocketProvider(SERVER_URL, docId, yDoc.current);
  //     setProvider(p);

  //     return () => {
  //       p.destroy();
  //       yDoc.current.destroy();
  //     };
  //   }
  // }, [userName, docId]);

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
        p.destroy();
        yDoc.current.destroy();
      };
    }
  }, [userName, docId]);

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

  if (!provider) {
    return <div style={{ padding: "20px" }}>Подключение к серверу...</div>;
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
            />
          )}
        />
      </div>
    </div>
  );
}

export default App;
