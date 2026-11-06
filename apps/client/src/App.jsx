import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
// import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import "./styles.css";
import MenuBar from "../components/MenuBar/MenuBar";
import { downloadDocx, importDocx } from "./lib/docx";

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

// Модалка для ввода имени
function NameModal({ onSubmit }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: "32px",
          maxWidth: "400px",
          width: "90%",
          border: "1px solid #000",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 600,
            marginBottom: "8px",
            fontFamily: "monospace",
          }}
        >
          Как вас зовут?
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#666",
            marginBottom: "24px",
          }}
        >
          Имя будет видно другим участникам
        </p>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите имя"
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            border: "1px solid #000",
            marginBottom: "16px",
            fontFamily: "monospace",
          }}
          maxLength={30}
        />
        <button
          type="submit"
          disabled={!name.trim()}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            background: name.trim() ? "#000" : "#ccc",
            color: "#fff",
            border: "none",
            cursor: name.trim() ? "pointer" : "not-allowed",
            fontFamily: "monospace",
            fontWeight: 600,
          }}
        >
          Войти
        </button>
      </form>
    </div>
  );
}

// Список участников
function PresenceBar({ awareness, userName, onChangeName }) {
  const [states, setStates] = useState([]);

  useEffect(() => {
    const update = () => {
      const allStates = Array.from(awareness.getStates().entries())
        .map(([clientId, state]) => ({
          clientId: String(clientId),
          user: state.user,
        }))
        .filter((s) => s.user?.name);
      setStates(allStates);
    };

    update();
    awareness.on("change", update);
    return () => awareness.off("change", update);
  }, [awareness]);

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {states.map(({ clientId, user }) => (
        <div
          key={clientId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            background: user.name === userName ? "#f0f0f0" : "transparent",
            border: "1px solid #000",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              background: user.color,
              border: "1px solid #000",
            }}
          />
          <span>{user.name}</span>

          {/* Кнопка смены имени — только для текущего пользователя */}
          {user.name === userName && (
            <button
              onClick={onChangeName}
              title="Сменить имя"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                padding: "0 4px",
                marginLeft: "4px",
                opacity: 0.6,
              }}
              onMouseOver={(e) => (e.target.style.opacity = 1)}
              onMouseOut={(e) => (e.target.style.opacity = 0.6)}
            >
              ✎
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Индикатор сохранения
function SaveIndicator({ provider }) {
  const [status, setStatus] = useState("syncing");

  useEffect(() => {
    const updateStatus = () => {
      if (provider.synced) {
        setStatus("saved");
      } else {
        setStatus("syncing");
      }
    };

    updateStatus();
    provider.on("sync", updateStatus);
    return () => provider.off("sync", updateStatus);
  }, [provider]);

  const labels = {
    syncing: "Синхронизация...",
    saved: "Сохранено",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",

        gap: "6px",
        fontSize: "13px",
        fontFamily: "monospace",
        color: status === "saved" ? "#0a0" : "#666",
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          background: status === "saved" ? "#0a0" : "#fa0",
          border: "1px solid #000",
        }}
      />
      <span>{labels[status]}</span>
    </div>
  );
}

// Редактор
function TipTapEditor({
  provider,
  yDoc,
  userName,
  userColor,
  clientId,
  header,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      Collaboration.configure({ document: yDoc }),
      CollaborationCaret.configure({
        provider,
        user: { name: userName, color: userColor },
      }),
    ],
    editorProps: {
      attributes: {
        style:
          "outline: none; min-height: 500px; padding: 20px; font-family: Georgia, 'Noto Color Emoji', serif; font-size: 16px; line-height: 1.4;",
      },
    },
  });

  //   useEffect(() => {
  //     if (editor && provider) {
  //       provider.awareness.setLocalStateField("user", {
  //         name: userName,
  //         color: userColor,
  //       });
  //     }
  //   }, [editor, provider, userName, userColor]);

  if (!editor) {
    return <div style={{ padding: "20px" }}>Загрузка редактора...</div>;
  }
  return (
    <>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#fff",
        }}
      >
        {typeof header === "function" ? header(editor) : header}
        <MenuBar editor={editor} />
      </div>{" "}
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </>
  );
}

function App() {
  const yDoc = useRef(new Y.Doc());
  const yMetadata = useRef(yDoc.current.getMap('metadata'));
  const [provider, setProvider] = useState(null);
  const [userName, setUserName] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [docxStatus, setDocxStatus] = useState("");
  const importFileRef = useRef(null);
  const [docName, setDocName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

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
      const name = yMetadata.current.get('name');
      if (name) setDocName(name);
    };

    yMetadata.current.observe(updateName);

    if (yMetadata.current.get('name')) {
      setDocName(yMetadata.current.get('name'));
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

  const copyLink = () => {
    const url = window.location.origin + "/d/" + docId;
    navigator.clipboard.writeText(url);
    alert("Ссылка скопирована!");
  };

  const createNewDoc = () => {
    const newId = Math.random().toString(36).substring(2, 10);
    window.location.href = "/d/" + newId;
  };

  const handleDocxImport = async (editor, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!file.name.toLowerCase().endsWith(".docx")) {
      window.alert("Выберите файл в формате DOCX.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      window.alert("Размер DOCX-файла не должен превышать 25 МБ.");
      return;
    }

    if (
      !window.confirm(
        "Содержимое DOCX будет добавлено в конец текущего документа у всех участников. Продолжить?",
      )
    ) {
      return;
    }

    try {
      setDocxStatus("Импорт DOCX...");
      const importedDocument = await importDocx(await file.arrayBuffer());

      // Insert at the document's end instead of setContent(), which replaces
      // the entire shared document. A single TipTap transaction keeps the
      // append operation synchronized to every connected Yjs collaborator.
      const endPosition = editor.state.doc.content.size;
      const inserted = editor.commands.insertContentAt(
        endPosition,
        importedDocument.content,
        { updateSelection: true },
      );
      if (!inserted) {
        throw new Error("Не удалось добавить содержимое DOCX в документ.");
      }

      setDocxStatus(`Добавлено в конец документа: ${file.name}`);
    } catch (error) {
      console.error("DOCX import failed:", error);
      setDocxStatus("");
      window.alert(
        error instanceof Error
          ? error.message
          : "Не удалось импортировать DOCX-файл.",
      );
    }
  };

  const handleDocxExport = (editor) => {
    try {
      const name = yMetadata.current.get('name') || docName || docId;
      const safeDocName = name.replace(/[^a-zA-Zа-яА-Я0-9._-]/gi, "-");
      downloadDocx(editor.getJSON(), `${safeDocName}.docx`);
      setDocxStatus("DOCX-файл подготовлен к скачиванию");
    } catch (error) {
      console.error("DOCX export failed:", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Не удалось экспортировать документ в DOCX.",
      );
    }
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
            <>
              {/* Верхний бар */}
              <div
                style={{
                  borderBottom: "1px solid #000",
                  padding: "12px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      flex: 1,
                      minWidth: "200px",
                    }}
                  >
                    {isEditingName ? (
                      <input
                        type="text"
                        autoFocus
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                        onBlur={() => {
                          setIsEditingName(false);
                          const trimmed = docName.trim();
                          if (trimmed) {
                            // Сохраняем в общую карту Yjs (синхронизируется со всеми)
                            yMetadata.current.set('name', trimmed);
                          } else {
                            // Если стерли всё в ноль, возвращаем дефолтное имя
                            setDocName(yMetadata.current.get('name') || `Документ ${docId}`);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur();
                          if (e.key === 'Escape') {
                            setIsEditingName(false);
                            setDocName(yMetadata.current.get('name') || `Документ ${docId}`);
                          }
                        }}
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          fontFamily: "monospace",
                          padding: "4px 8px",
                          border: "1px solid #000",
                          outline: "none",
                          background: "#fff",
                          maxWidth: "300px",
                          width: "100%",
                        }}
                      />
                    ) : (
                      <h1
                        onClick={() => setIsEditingName(true)}
                        title="Нажмите, чтобы переименовать"
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          fontFamily: "monospace",
                          margin: 0,
                          cursor: "pointer",
                          borderBottom: "1px dashed #999",
                          lineHeight: "1.2",
                        }}
                      >
                        {docName || `Документ ${docId}`}
                      </h1>
                    )}
                    <SaveIndicator provider={provider} />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    aria-label="Выбрать DOCX-файл для импорта"
                    style={{ display: "none" }}
                    onChange={(event) => handleDocxImport(editor, event)}
                  />
                  <button
                    onClick={() => importFileRef.current?.click()}
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      background: "#fff",
                      color: "#000",
                      border: "1px solid #000",
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    Импорт DOCX
                  </button>
                  <button
                    onClick={() => handleDocxExport(editor)}
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      background: "#fff",
                      color: "#000",
                      border: "1px solid #000",
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    Экспорт DOCX
                  </button>
                  <button
                    onClick={copyLink}
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      background: "#000",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    Поделиться ссылкой
                  </button>
                  <button
                    onClick={createNewDoc}
                    style={{
                      padding: "8px 16px",
                      fontSize: "14px",
                      background: "#fff",
                      color: "#000",
                      border: "1px solid #000",
                      cursor: "pointer",
                      fontFamily: "monospace",
                    }}
                  >
                    Новый документ
                  </button>
                </div>
              </div>
              {docxStatus && (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    padding: "6px 20px",
                    fontSize: "12px",
                    color: "#555",
                    fontFamily: "monospace",
                  }}
                >
                  {docxStatus}
                </div>
              )}

              {/* Панель участников */}
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid #e0e0e0",
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    position: "sticky",

                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "8px",
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Участники ({provider.awareness.getStates().size})
                </div>
                <PresenceBar
                  awareness={provider.awareness}
                  userName={userName}
                  onChangeName={handleChangeName}
                />
              </div>
            </>
          )}
        />
      </div>
    </div>
  );
}

export default App;
