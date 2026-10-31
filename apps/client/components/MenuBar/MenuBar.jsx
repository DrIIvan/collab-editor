import React from "react";
import { useEditorState } from "@tiptap/react";


const btn = (active, disabled) => ({
  width: "28px",
  height: "28px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  fontSize: "14px",
  fontFamily: "monospace",
  background: active ? "#000" : "transparent",
  color: active ? "#fff" : "#000",
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.3 : 1,
});

function Button({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      className="mb-btn"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      style={btn(active, disabled)}
    >
      {children}
    </button>
  );
}

function Group({ children }) {
  return <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>{children}</div>;
}

function Divider() {
  return (
    <div
      style={{
        width: "1px",
        height: "20px",
        background: "#000",
        opacity: 0.25,
        margin: "0 8px",
        flexShrink: 0,
      }}
    />
  );
}

function Icon({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {children}
    </svg>
  );
}

const icons = {
  undo: (
    <Icon>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </Icon>
  ),
  redo: (
    <Icon>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </Icon>
  ),
  link: (
    <Icon>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icon>
  ),
  bullet: (
    <Icon>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M3.5 6h1M3.5 12h1M3.5 18h1" strokeWidth="3" />
    </Icon>
  ),
  ordered: (
    <Icon>
      <path d="M10 6h11M10 12h11M10 18h11" />
      <path d="M3 5l2-1v5M3 14h3l-3 3h3M3 20h3v2H3m3 0v-2" strokeWidth="1.5" />
    </Icon>
  ),
  codeBlock: (
    <Icon>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
    </Icon>
  ),
  hr: (
    <Icon>
      <path d="M3 12h18" />
    </Icon>
  ),
  clear: (
    <Icon>
      <path d="M6 5h12M12 5v9" />
      <path d="M4 20L20 4" />
    </Icon>
  ),
};


export default function MenuBar({ editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isBold: editor.isActive("bold"),
      canBold: editor.can().chain().toggleBold().run(),
      isItalic: editor.isActive("italic"),
      canItalic: editor.can().chain().toggleItalic().run(),
      isStrike: editor.isActive("strike"),
      canStrike: editor.can().chain().toggleStrike().run(),
      isUnderline: editor.isActive("underline"),
      canUnderline: editor.can().chain().toggleUnderline().run(),
      isCode: editor.isActive("code"),
      canCode: editor.can().chain().toggleCode().run(),
      heading: [1, 2, 3, 4, 5, 6].find((l) => editor.isActive("heading", { level: l })) || 0,
      isBulletList: editor.isActive("bulletList"),
      isOrderedList: editor.isActive("orderedList"),
      isCodeBlock: editor.isActive("codeBlock"),
      isBlockquote: editor.isActive("blockquote"),
      isLink: editor.isActive("link"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  if (!editor) return null;

  const run = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("Введите URL (пусто — убрать ссылку)", prev || "https://");
    if (url === null) return;
    if (url === "") {
      run().extendMarkRange("link").unsetLink().run();
      return;
    }
    run().extendMarkRange("link").setLink({ href: url }).run();
  };

  const onHeadingChange = (e) => {
    const level = Number(e.target.value);
    if (level === 0) run().setParagraph().run();
    else run().setHeading({ level }).run();
  };

  return (
    <>
      <style>{`
        .mb-btn:hover:not(:disabled):not([aria-pressed="true"]) { background: #e8e8e8 !important; }
        .mb-select:hover { background: #e8e8e8; }
      `}</style>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          rowGap: "6px",
          padding: "6px 20px",
          borderBottom: "1px solid #000",
          background: "#fff",
        }}
      >
        <Group>
          <Button title="Отменить" disabled={!s.canUndo} onClick={() => run().undo().run()}>
            {icons.undo}
          </Button>
          <Button title="Повторить" disabled={!s.canRedo} onClick={() => run().redo().run()}>
            {icons.redo}
          </Button>
        </Group>

        <Divider />

        <Group>
          <select
            className="mb-select"
            title="Стиль текста"
            value={s.heading}
            onChange={onHeadingChange}
            style={{
              height: "28px",
              padding: "0 8px",
              fontSize: "13px",
              fontFamily: "monospace",
              background: "transparent",
              color: "#000",
              border: "none",
              cursor: "pointer",
              minWidth: "140px",
            }}
          >
            <option value={0}>Обычный текст</option>
            {[1, 2, 3, 4, 5, 6].map((l) => (
              <option key={l} value={l}>
                Заголовок {l}
              </option>
            ))}
          </select>
        </Group>

        <Divider />

        <Group>
          <Button title="Жирный (Ctrl+B)" active={s.isBold} disabled={!s.canBold} onClick={() => run().toggleBold().run()}>
            <b>B</b>
          </Button>
          <Button title="Курсив (Ctrl+I)" active={s.isItalic} disabled={!s.canItalic} onClick={() => run().toggleItalic().run()}>
            <i style={{ fontFamily: "Georgia, serif" }}>I</i>
          </Button>
          <Button title="Подчёркнутый (Ctrl+U)" active={s.isUnderline} disabled={!s.canUnderline} onClick={() => run().toggleUnderline().run()}>
            <u>U</u>
          </Button>
          <Button title="Зачёркнутый" active={s.isStrike} disabled={!s.canStrike} onClick={() => run().toggleStrike().run()}>
            <s>S</s>
          </Button>
          <Button title="Код" active={s.isCode} disabled={!s.canCode} onClick={() => run().toggleCode().run()}>
            {"</>"}
          </Button>
          <Button title="Ссылка" active={s.isLink} onClick={setLink}>
            {icons.link}
          </Button>
        </Group>

        <Divider />

        <Group>
          <Button title="Маркированный список" active={s.isBulletList} onClick={() => run().toggleBulletList().run()}>
            {icons.bullet}
          </Button>
          <Button title="Нумерованный список" active={s.isOrderedList} onClick={() => run().toggleOrderedList().run()}>
            {icons.ordered}
          </Button>
          <Button title="Цитата" active={s.isBlockquote} onClick={() => run().toggleBlockquote().run()}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: "22px", lineHeight: 1, marginTop: "6px" }}>“</span>
          </Button>
          <Button title="Блок кода" active={s.isCodeBlock} onClick={() => run().toggleCodeBlock().run()}>
            {icons.codeBlock}
          </Button>
          <Button title="Горизонтальная линия" onClick={() => run().setHorizontalRule().run()}>
            {icons.hr}
          </Button>
          <Button title="Перенос строки (Shift+Enter)" onClick={() => run().setHardBreak().run()}>
            ↵
          </Button>
        </Group>

        <Divider />

        <Group>
          <Button title="Очистить форматирование" onClick={() => run().unsetAllMarks().clearNodes().run()}>
            {icons.clear}
          </Button>
        </Group>
      </div>
    </>
  );
}