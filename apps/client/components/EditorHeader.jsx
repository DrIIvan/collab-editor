import React, { useEffect, useState, useRef } from "react";
import { downloadDocx, importDocx } from "../src/lib/docx";
import PresenceBar from "./PresenceBar";
import SaveIndicator from "./SaveIndicator";

export default function EditorHeader(props) {
  const { setDocName, handleChangeName } = props;
  const [docxStatus, setDocxStatus] = useState("");

  const [isEditingName, setIsEditingName] = useState(false);
  const importFileRef = useRef(null);

  const copyLink = () => {
    const url = window.location.origin + "/d/" + props.docId;
    navigator.clipboard.writeText(url);
    alert("Ссылка скопирована!");
  };
  const createNewDoc = () => {
    const newId = Math.random().toString(36).substring(2, 10);
    window.location.href = "/d/" + newId;
  };

  const handleDocxExport = (editor) => {
    try {
      const name = props.yMetadata.current.get("name") || props.docName || props.docId;
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

  return (
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
                value={props.docName}
                onChange={(e) => setDocName(e.target.value)}
                onBlur={() => {
                  setIsEditingName(false);
                  const trimmed = props.docName.trim();
                  if (trimmed) {
                    // Сохраняем в общую карту Yjs (синхронизируется со всеми)
                    props.yMetadata.current.set("name", trimmed);
                  } else {
                    // Если стерли всё в ноль, возвращаем дефолтное имя
                    setDocName(
                      props.yMetadata.current.get("name") ||
                        `Документ ${props.docId}`,
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.target.blur();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    setDocName(
                      props.yMetadata.current.get("name") ||
                        `Документ ${props.docId}`,
                    );
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
                {props.docName || `Документ ${props.docId}`}
              </h1>
            )}
            <SaveIndicator provider={props.provider} />
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
            onChange={(event) => handleDocxImport(props.editor, event)}
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
            onClick={() => handleDocxExport(props.editor)}
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
          Участники ({props.provider.awareness.getStates().size})
        </div>
        <PresenceBar
          awareness={props.provider.awareness}
          userName={props.userName}
          onChangeName={handleChangeName}
        />
      </div>
    </>
  );
}
