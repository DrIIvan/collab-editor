import React from "react";

const FEATURES = [
  {
    title: "Реальное время",
    desc: "Yjs синхронизирует правки между всеми участниками мгновенно через WebSocket.",
  },
  {
    title: "Курсоры участников",
    desc: "Видно, где пишут другие, и кто что редактирует прямо сейчас.",
  },
  {
    title: "Импорт и экспорт DOCX",
    desc: "Подгружайте Word-документы и выгружайте обратно без потери форматирования.",
  },
  {
    title: "Персистентность",
    desc: "Документы хранятся в LevelDB на сервере — не пропадают после перезагрузки.",
  },
];

function createNewDoc() {
  const newId = Math.random().toString(36).substring(2, 10);
  window.location.href = "/d/" + newId;
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#e4e8f0] font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif] text-[#1a1a1a]">
      <div className="flex items-center justify-between border-b border-[#d5dae3] bg-white px-3 py-3 sm:px-5">
        <div className="text-lg font-semibold sm:text-xl">Collab Editor</div>
        <div className="text-xs font-medium tracking-wide uppercase text-[#5f6672]">
          Real-time collaboration
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-220 flex-col items-center px-3 py-10 sm:px-5 sm:py-16">
        <div className="w-full max-w-xl rounded-3xl bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12">
          <h1 className="mb-3 text-2xl font-semibold leading-tight sm:text-3xl">
            Совместный редактор документов
          </h1>
          <p className="mb-8 text-base leading-relaxed text-[#5f6672]">
            Создайте документ и поделитесь ссылкой. Все участники видят правки
            в реальном времени — курсоры, выделения и изменения текста
            синхронизируются через Yjs.
          </p>
          <button
            onClick={createNewDoc}
            className="h-12 cursor-pointer rounded-lg bg-[#003399] px-6 text-base font-medium text-white transition-colors hover:bg-[#002a80] active:bg-[#00216b]"
          >
            + Создать документ
          </button>
          <p className="mt-4 text-xs text-[#5f6672]">
            Готово — вы попадёте в редактор, а ссылкой сможете поделиться с соавторами.
          </p>
        </div>

        <div className="mt-10 w-full max-w-xl">
          <div className="mb-4 text-xs font-medium tracking-wide uppercase text-[#5f6672]">
            Возможности
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white px-5 py-5 shadow-sm"
              >
                <div className="mb-1.5 text-sm font-semibold">{f.title}</div>
                <div className="text-sm leading-relaxed text-[#5f6672]">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 max-w-xl text-center text-xs text-[#5f6672]">
          Каждый документ имеет уникальный URL вида{" "}
          <code className="rounded-md bg-white px-2 py-0.5 text-[11px] text-[#003399] shadow-sm">
            /d/&lt;id&gt;
          </code>
          , которым можно поделиться.
        </div>
      </div>
    </div>
  );
}