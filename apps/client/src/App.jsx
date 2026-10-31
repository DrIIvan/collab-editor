import mammoth from "mammoth";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ExternalHyperlink } from "docx";
import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
// import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import "./styles.css";

// const SERVER_URL = 'wss://server-collab.cloudpub.ru';
const SERVER_URL = "ws://localhost:1234";

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

function getColor(clientId) {
  const hash = clientId
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
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
function PresenceBar({ awareness, currentUser }) {
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
            background:
              clientId === currentUser.clientId ? "#f0f0f0" : "transparent",
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
function TipTapEditor({ provider, yDoc, userName, userColor, clientId, editorRef }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: yDoc }),
      CollaborationCaret.configure({
        provider,
        user: { name: userName, color: userColor },
      }),
    ],
    editorProps: {
      attributes: {
        style:
          "outline: none; min-height: 500px; padding: 20px; font-family: Georgia, serif; font-size: 16px; line-height: 1.6;",
      },
    },
  });

  useEffect(() => {
    if (editor && editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  if (!editor) {
    return <div style={{ padding: "20px" }}>Загрузка редактора...</div>;
  }

  return <EditorContent editor={editor} />;
}

// Конвертер ProseMirror JSON в структуру docx
function convertTiptapJsonToDocx(json) {
  const children = [];

  const processMarks = (text, marks = []) => {
    const options = { text };
    marks.forEach(mark => {
      switch (mark.type) {
        case "bold":
          options.bold = true;
          break;
        case "italic":
          options.italics = true;
          break;
        case "strike":
          options.strike = true;
          break;
        case "code":
          options.font = { name: "Courier New" };
          options.shading = { fill: "E0E0E0" };
          break;
      }
    });
    return new TextRun(options);
  };

  const processContent = (content) => {
    if (!content) return [];
    
    return content.map(node => {
      if (node.type === "text") {
        const linkMark = node.marks?.find(m => m.type === "link");
        if (linkMark) {
          return new ExternalHyperlink({
            link: linkMark.attrs.href,
            children: [
              new TextRun({
                text: node.text,
                color: "0563C1",
                underline: {},
              }),
            ],
          });
        }
        return processMarks(node.text, node.marks);
      }
      return null;
    }).filter(Boolean);
  };

  json.content?.forEach(node => {
    switch (node.type) {
      case "paragraph": {
        const runs = processContent(node.content);
        children.push(new Paragraph({ children: runs }));
        break;
      }
      case "heading": {
        const runs = processContent(node.content);
        const level = node.attrs?.level || 1;
        const headingLevel = [
          HeadingLevel.HEADING_1,
          HeadingLevel.HEADING_2,
          HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4,
          HeadingLevel.HEADING_5,
          HeadingLevel.HEADING_6,
        ][level - 1] || HeadingLevel.HEADING_1;
        
        children.push(new Paragraph({
          children: runs,
          heading: headingLevel,
        }));
        break;
      }
      case "bulletList": {
        node.content?.forEach(item => {
          if (item.type === "listItem") {
            item.content?.forEach(para => {
              if (para.type === "paragraph") {
                const runs = processContent(para.content);
                children.push(new Paragraph({
                  children: runs,
                  bullet: { level: 0 },
                }));
              }
            });
          }
        });
        break;
      }
      case "orderedList": {
        node.content?.forEach(item => {
          if (item.type === "listItem") {
            item.content?.forEach(para => {
              if (para.type === "paragraph") {
                const runs = processContent(para.content);
                children.push(new Paragraph({
                  children: runs,
                  numbering: { reference: "default-numbering", level: 0 },
                }));
              }
            });
          }
        });
        break;
      }
      case "blockquote": {
        node.content?.forEach(para => {
          if (para.type === "paragraph") {
            const runs = processContent(para.content);
            children.push(new Paragraph({
              children: runs,
              indent: { left: 720 },
              border: {
                left: { style: BorderStyle.SINGLE, size: 6, color: "999999" },
              },
            }));
          }
        });
        break;
      }
      case "codeBlock": {
        node.content?.forEach(textNode => {
          if (textNode.type === "text") {
            children.push(new Paragraph({
              children: [new TextRun({
                text: textNode.text,
                font: { name: "Courier New" },
                size: 20,
              })],
              shading: { fill: "F5F5F5" },
              spacing: { before: 240, after: 240 },
            }));
          }
        });
        break;
      }
      case "horizontalRule": {
        children.push(new Paragraph({
          children: [],
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" },
          },
        }));
        break;
      }
    }
  });

  return new Document({
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{
          level: 0,
          format: "decimal",
          text: "%1.",
          alignment: AlignmentType.LEFT,
        }],
      }],
    },
    sections: [{
      properties: {},
      children: children.length > 0 ? children : [new Paragraph({ children: [] })],
    }],
  });
}

function App() {
  const yDoc = useRef(new Y.Doc());
  const [provider, setProvider] = useState(null);
  const [userName, setUserName] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const docId = window.location.pathname.split("/").pop() || "default";
  const clientId = useRef(Math.random().toString(36).substring(2)).current;
  const userColor = getColor(clientId);

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  const exportDocx = async () => {
    if (!editorRef.current) return;
    
    try {
      const json = editorRef.current.getJSON();
      const doc = convertTiptapJsonToDocx(json);
      const blob = await Packer.toBlob(doc);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `document-${docId}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Ошибка экспорта:", error);
      alert("Не удалось экспортировать документ");
    }
  };
  const importDocx = async (event) => {
    const file = event.target.files[0];
    if (!file || !editorRef.current) return;
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

      const editor = editorRef.current;
      const { state, view } = editor;
      const endPos = state.doc.content.size;
      
      editor.commands.insertContentAt(endPos, html);

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Ошибка импорта:", error);
      alert("Не удалось импортировать документ: " + error.message);
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    const savedName = localStorage.getItem("userName");
    if (savedName) {
      setUserName(savedName);
    } else {
      setShowModal(true);
    }
  }, []);

  useEffect(() => {
    if (userName && !provider) {
      const p = new WebsocketProvider(SERVER_URL, docId, yDoc.current);
      setProvider(p);

      return () => {
        p.destroy();
        yDoc.current.destroy();
      };
    }
  }, [userName, docId]);

  const handleNameSubmit = (name) => {
    localStorage.setItem("userName", name);
    setUserName(name);
    setShowModal(false);
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
          <h1
            style={{
              fontSize: "16px",
              fontWeight: 600,
              fontFamily: "monospace",
              margin: 0,
            }}
          >
            Doc: {docId}
          </h1>
          <SaveIndicator provider={provider} />
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
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
          {/* Скрытый инпут для выбора файла */}
          <input
            type="file"
            accept=".docx"
            ref={fileInputRef}
            onChange={importDocx}
            style={{ display: "none" }}
          />
          {/* Кнопки импорта и экспорта */}
          <button
            onClick={triggerImport}
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
            Импорт .docx
          </button>
          <button
            onClick={exportDocx}
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
            Экспорт в .docx
          </button>
        </div>
      </div>

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
          currentUser={{ clientId }}
        />
      </div>

      {/* Редактор */}
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <TipTapEditor
          provider={provider}
          yDoc={yDoc.current}
          userName={userName}
          userColor={userColor}
          clientId={clientId}
          editorRef={editorRef}
        />
      </div>
    </div>
  );
}

export default App;
