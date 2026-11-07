import React from "react";
import { useEditorState } from "@tiptap/react";

function Button(props) {
  const { onClick } = props;
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      aria-pressed={props.active}
      onClick={onClick}
      disabled={props.disabled}
      onMouseDown={(e) => e.preventDefault()}
      className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg p-0 font-mono text-sm text-[#1a1a1a] transition-colors hover:bg-[#e4e8f0] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent aria-pressed:bg-[#003399] aria-pressed:text-white aria-pressed:hover:bg-[#002a80]"
    >
      {props.children}
    </button>
  );
}

function Group({ children }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <div className="mx-2 hidden h-5 w-px bg-[#d5dae3] sm:block" />;
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
      strokeLinecap="round"
      strokeLinejoin="round"
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

const EMPTY = {
  isBold: false,
  isItalic: false,
  isStrike: false,
  isUnderline: false,
  isCode: false,
  heading: 0,
  isBulletList: false,
  isOrderedList: false,
  isCodeBlock: false,
  isBlockquote: false,
  isLink: false,
  canUndo: false,
  canRedo: false,
};

export default function MenuBar({ editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return EMPTY;
      return {
        isBold: editor.isActive("bold"),
        isItalic: editor.isActive("italic"),
        isStrike: editor.isActive("strike"),
        isUnderline: editor.isActive("underline"),
        isCode: editor.isActive("code"),
        heading: editor.isActive("heading")
          ? editor.getAttributes("heading").level
          : 0,
        isBulletList: editor.isActive("bulletList"),
        isOrderedList: editor.isActive("orderedList"),
        isCodeBlock: editor.isActive("codeBlock"),
        isBlockquote: editor.isActive("blockquote"),
        isLink: editor.isActive("link"),
        canUndo: editor.can().undo(),
        canRedo: editor.can().redo(),
      };
    },
  });

  if (!editor) return null;
  // ...дальше всё как было (run, setLink, onHeadingChange, return)

  const run = () => editor.chain().focus();

  const setLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt(
      "Введите URL (пусто — убрать ссылку)",
      prev || "https://",
    );
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
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-b border-[#d5dae3] bg-white px-3 py-2 font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif] sm:px-5">
      <Group>
        <Button
          title="Отменить"
          disabled={!s.canUndo}
          onClick={() => run().undo().run()}
        >
          {icons.undo}
        </Button>
        <Button
          title="Повторить"
          disabled={!s.canRedo}
          onClick={() => run().redo().run()}
        >
          {icons.redo}
        </Button>
      </Group>

      <Divider />

      <Group>
        <select
          className="h-8 min-w-36 cursor-pointer rounded-lg border-none bg-[#f0f2f6] px-2 text-[13px] text-[#1a1a1a] outline-none transition-colors hover:bg-[#e4e8f0] focus-visible:ring-2 focus-visible:ring-[#003399]/30"
          title="Стиль текста"
          value={s.heading}
          onChange={onHeadingChange}
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
        <Button
          title="Жирный (Ctrl+B)"
          active={s.isBold}
          onClick={() => run().toggleBold().run()}
        >
          <b>B</b>
        </Button>
        <Button
          title="Курсив (Ctrl+I)"
          active={s.isItalic}
          onClick={() => run().toggleItalic().run()}
        >
          <i className="font-serif">I</i>
        </Button>
        <Button
          title="Подчёркнутый (Ctrl+U)"
          active={s.isUnderline}
          onClick={() => run().toggleUnderline().run()}
        >
          <u>U</u>
        </Button>
        <Button
          title="Зачёркнутый"
          active={s.isStrike}
          onClick={() => run().toggleStrike().run()}
        >
          <s>S</s>
        </Button>
        <Button
          title="Код"
          active={s.isCode}
          onClick={() => run().toggleCode().run()}
        >
          {"</>"}
        </Button>
        <Button title="Ссылка" active={s.isLink} onClick={setLink}>
          {icons.link}
        </Button>
      </Group>

      <Divider />

      <Group>
        <Button
          title="Маркированный список"
          active={s.isBulletList}
          onClick={() => run().toggleBulletList().run()}
        >
          {icons.bullet}
        </Button>
        <Button
          title="Нумерованный список"
          active={s.isOrderedList}
          onClick={() => run().toggleOrderedList().run()}
        >
          {icons.ordered}
        </Button>
        <Button
          title="Цитата"
          active={s.isBlockquote}
          onClick={() => run().toggleBlockquote().run()}
        >
          <span className="mt-1.5 font-serif text-[22px] leading-none">“</span>
        </Button>
        <Button
          title="Блок кода"
          active={s.isCodeBlock}
          onClick={() => run().toggleCodeBlock().run()}
        >
          {icons.codeBlock}
        </Button>
        <Button
          title="Горизонтальная линия"
          onClick={() => run().setHorizontalRule().run()}
        >
          {icons.hr}
        </Button>
        <Button
          title="Перенос строки (Shift+Enter)"
          onClick={() => run().setHardBreak().run()}
        >
          ↵
        </Button>
      </Group>

      <Divider />

      <Group>
        <Button
          title="Очистить форматирование"
          onClick={() => run().unsetAllMarks().clearNodes().run()}
        >
          {icons.clear}
        </Button>
      </Group>
    </div>
  );
}
