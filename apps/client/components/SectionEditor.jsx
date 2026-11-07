import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";

const MAX_BLOCKS = 40; // после стольких блоков Enter в конце создаёт новую секцию

export default function SectionEditor({
  id,
  yDoc,
  provider,
  userName,
  userColor,
  autoFocus,
  onFocus,
  onDestroy,
  onSplit,
}) {
  // editor создаётся один раз на id, поэтому актуальный колбэк берём из ref
  const onSplitRef = useRef(onSplit);
  onSplitRef.current = onSplit;

  const editor = useEditor(
    {
      immediatelyRender: false, // создавать редактор в эффекте, а не во время рендера
      shouldRerenderOnTransaction: false,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: yDoc, field: id }),
        CollaborationCaret.configure({
          provider,
          user: provider.awareness.getLocalState()?.user ?? {
            name: userName,
            color: userColor,
          },
        }),
      ],
      onCreate: ({ editor }) => {
        if (autoFocus) editor.commands.focus("start");
      },
      onFocus: ({ editor }) => onFocus(editor),
      editorProps: {
        attributes: {
          style:
            "outline: none; padding: 12px 20px; font-family: Georgia, 'Noto Color Emoji', serif; font-size: 16px; line-height: 1.4; min-height: 120px; cursor: text;",
        },
        handleKeyDown(view, e) {
          if (e.key !== "Enter" || e.shiftKey) return false;
          const { state } = view;
          const atEnd =
            state.selection.empty &&
            state.selection.$to.pos >= state.doc.content.size - 1;
          if (atEnd && state.doc.childCount >= MAX_BLOCKS) {
            e.preventDefault();
            onSplitRef.current?.(id);
            return true;
          }
          return false;
        },
      },
    },
    [id],
  );

  useEffect(() => {
    if (!editor) return;
    return () => onDestroy(editor);
  }, [editor]);

  return <EditorContent editor={editor} />;
}
