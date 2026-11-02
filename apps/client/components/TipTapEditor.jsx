import { useEditor, EditorContent } from "@tiptap/react";
import MenuBar from "./MenuBar";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";

// Контейнер секций
export default function TipTapEditor(props) {
  const { provider, yDoc, userName, userColor, clientId, header } = props;
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
