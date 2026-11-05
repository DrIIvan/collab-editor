import React, { useEffect, useState, useRef } from "react";
import { downloadDocx, importDocx } from "../src/lib/docx";
import PresenceBar from "./PresenceBar";
import SaveIndicator from "./SaveIndicator";

const btnBase =
  "h-10 cursor-pointer rounded-lg px-4 text-sm font-medium whitespace-nowrap transition-colors";
const btnPrimary = `${btnBase} bg-[#003399] text-white hover:bg-[#002a80] active:bg-[#00216b]`;
const btnSecondary = `${btnBase} border border-[#d5dae3] bg-white text-[#1a1a1a] hover:bg-[#f0f2f6]`;
const btnLight = `${btnBase} bg-[#dce8fb] text-[#1c4fa0] hover:bg-[#c9dbf8]`;

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
      const name =
        props.yMetadata.current.get("name") || props.docName || props.docId;
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

  const restoreName = () =>
    setDocName(
      props.yMetadata.current.get("name") || `Документ ${props.docId}`,
    );

  return (
    <div className="font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif] text-[#1a1a1a]">
      {/* Верхний бар */}
      <div className="flex flex-col gap-3 border-b border-[#d5dae3] px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          {isEditingName ? (
            <div className="inline-grid w-fit max-w-sm items-center relative">
              {/* Скрытый текст-дублер, задающий ширину. Важно: px-3 такой же, как у input */}
              <span className="invisible col-start-1 row-start-1 px-3 text-lg font-semibold sm:text-xl whitespace-pre">
                {props.docName || " "}
              </span>

              <input
                className="col-start-1 row-start-1 h-10 w-full rounded-md border border-[#003399] bg-white px-3 text-lg font-semibold sm:text-xl outline-none ring-2 ring-[#003399]/20"
                type="text"
                autoFocus
                value={props.docName}
                onChange={(e) => setDocName(e.target.value)}
                onBlur={() => {
                  setIsEditingName(false);
                  const trimmed = props.docName.trim();
                  if (trimmed) {
                    props.yMetadata.current.set("name", trimmed);
                  } else {
                    restoreName();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.target.blur();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    restoreName();
                  }
                }}
              />
            </div>
          ) : (
            <h1
              onClick={() => setIsEditingName(true)}
              title="Нажмите, чтобы переименовать"
              className="m-0 min-w-0 max-w-sm border-b border-dashed border-gray-400 cursor-pointer truncate rounded-sm px-2 py-1 text-lg font-semibold leading-tight transition-colors hover:bg-[#f0f2f6] sm:text-xl"
            >
              {props.docName || `Документ ${props.docId}`}
            </h1>
          )}
          <SaveIndicator provider={props.provider} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <input
            ref={importFileRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label="Выбрать DOCX-файл для импорта"
            className="hidden"
            onChange={(event) => handleDocxImport(props.editor, event)}
          />
          <button
            onClick={() => importFileRef.current?.click()}
            className={btnSecondary}
          >
            Импорт DOCX
          </button>
          <button
            onClick={() => handleDocxExport(props.editor)}
            className={btnSecondary}
          >
            Экспорт DOCX
          </button>
          <button onClick={copyLink} className={btnPrimary}>
            Поделиться ссылкой
          </button>
          <button onClick={createNewDoc} className={btnLight}>
            Новый документ
          </button>
        </div>
      </div>

      {docxStatus && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-[#d5dae3] bg-[#f5f7fa] px-3 py-1.5 text-xs text-[#5f6672] sm:px-5"
        >
          {docxStatus}
        </div>
      )}

      {/* Панель участников */}
      <div className="border-b border-[#d5dae3] bg-[#f5f7fa] px-3 py-3 sm:px-5">
        <div className="mb-2 text-xs font-medium tracking-wide text-[#5f6672] uppercase">
          Участники ({props.provider.awareness.getStates().size})
        </div>
        <PresenceBar
          awareness={props.provider.awareness}
          userName={props.userName}
          onChangeName={handleChangeName}
        />
      </div>
    </div>
  );
}
