import React, { useState } from "react";

const FEATURES = [
  { label: "Совместное редактирование", desc: "Yjs + WebSocket" },
  { label: "Импорт/экспорт DOCX", desc: "Синхронизация между участниками" },
  { label: "Курсоры участников", desc: "Видно, кто где пишет" },
  { label: "Персистентность", desc: "LevelDB на сервере" },
];

function createDoc() {
  const newId = Math.random().toString(36).substring(2, 10);
  window.location.href = "/d/" + newId;
}

export default function HomePage() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fff",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Верхний бар — повторяет стиль EditorHeader */}
      <div
        style={{
          borderBottom: "1px solid #000",
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "16px",
            fontWeight: 600,
            fontFamily: "monospace",
            margin: 0,
          }}
        >
          Collab Editor
        </div>
        <div
          style={{
            fontSize: "12px",
            fontFamily: "monospace",
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Real-time collaboration
        </div>
      </div>

      {/* Контент */}
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "60px 20px 40px",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 600,
            fontFamily: "monospace",
            margin: "0 0 12px 0",
            lineHeight: 1.2,
            color: "#000",
          }}
        >
          Совместный редактор документов
        </h1>

        <p
          style={{
            fontSize: "15px",
            color: "#555",
            lineHeight: 1.6,
            margin: "0 0 40px 0",
            maxWidth: "560px",
          }}
        >
          Создайте документ и поделитесь ссылкой. Все участники видят правки
          в реальном времени - курсоры, выделения и изменения текста
          синхронизируются через Yjs.
        </p>

        {/* Главная кнопка — в стиле "Поделиться ссылкой" */}
        <button
          onClick={createDoc}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontFamily: "monospace",
            background: isHovered ? "#222" : "#000",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            letterSpacing: "0.3px",
          }}
        >
          + Создать документ
        </button>

        {/* Блок возможностей */}
        <div
          style={{
            marginTop: "60px",
            borderTop: "1px solid #000",
            paddingTop: "32px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontFamily: "monospace",
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "20px",
            }}
          >
            Возможности
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "0",
              borderLeft: "1px solid #e0e0e0",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.label}
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e0e0e0",
                  borderRight: "1px solid #e0e0e0",
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    fontFamily: "monospace",
                    color: "#000",
                    marginBottom: "4px",
                  }}
                >
                  {f.label}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#666",
                    fontFamily: "monospace",
                  }}
                >
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Подсказка снизу */}
        <div
          style={{
            marginTop: "40px",
            paddingTop: "20px",
            borderTop: "1px solid #e0e0e0",
            fontSize: "12px",
            color: "#999",
            fontFamily: "monospace",
          }}
        >
          Совет: каждый документ имеет уникальный URL вида{" "}
          <code style={{ background: "#fafafa", padding: "1px 4px" }}>
            /d/&lt;id&gt;
          </code>
          , которым можно поделиться.
        </div>
      </div>
    </div>
  );
}