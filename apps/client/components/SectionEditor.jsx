import React, { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";

// Редактор одной секции (один Y.XmlFragment)
export default function SectionEditor(props) {

      const { onFocus} = props;
      const { onDestroy } = props;

  // Гарантируем, что во фрагменте есть хотя бы один пустой параграф
  useEffect(() => {
    const fragment = props.yDoc.getXmlFragment(props.id);
    if (fragment.length === 0) {
      props.yDoc.transact(() => {
        const p = new Y.XmlElement("paragraph");
        fragment.insert(0, [p]);
      });
    }
  }, [props.id, props.yDoc]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: props.yDoc, field: props.id }),
        CollaborationCaret.configure({
          provider,
          user: props.provider.awareness.getLocalState()?.user ?? {
            name: props.userName,
            color: props.userColor,
          },
        }),
      ],
      onCreate: ({ editor }) => {
        if (props.eager) onFocus(editor);
      },
      onFocus: ({ editor }) => onFocus(editor),
      editorProps: {
        attributes: {
          style:
            "outline: none; padding: 12px 20px; font-family: Georgia, 'Noto Color Emoji', serif; font-size: 16px; line-height: 1.4; min-height: 120px; cursor: text;",
        },
      },
    },
    [props.id],
  );

  useEffect(() => {
    if (!editor) return;
    return () => onDestroy(editor);
  }, [editor]);

  return <EditorContent editor={editor} />;
}