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
    return (
      <div className="bg-[#e4e8f0] p-5 font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif] text-[#5f6672]">
        Загрузка редактора...
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-[#e4e8f0] font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif]">
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        {typeof header === "function" ? header(editor) : header}
        <MenuBar editor={editor} />
      </div>
      <div className="mx-auto w-full max-w-220 px-2 py-3 sm:px-2 sm:py-6">
        <div className="rounded-3xl px-3 bg-white shadow-sm">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
