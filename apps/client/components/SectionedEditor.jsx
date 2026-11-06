import { useCallback, useState } from "react";
import MenuBar from "./MenuBar";
import SectionEditor from "./SectionEditor";
import LazySection from "./LazySection";
import { useSections } from "../src/utils/useSections";

export default function SectionedEditor({ provider, yDoc, userName, userColor, header }) {
  const [ids, yArr] = useSections(yDoc, provider);
  const [activeEditor, setActiveEditor] = useState(null);
  const [focusId, setFocusId] = useState(null);

  const handleFocus = useCallback((ed) => setActiveEditor(ed), []);
  const handleDestroy = useCallback(
    (ed) => setActiveEditor((cur) => (cur === ed ? null : cur)),
    [],
  );

  const insertAfter = useCallback(
    (id) => {
      const newId = crypto.randomUUID().slice(0, 8);
      const idx = yArr.toArray().indexOf(id);
      yArr.insert(idx + 1, [newId]);
      setFocusId(newId);
    },
    [yArr],
  );

  return (
    <div className="min-h-screen bg-[#e4e8f0] font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif]">
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        {typeof header === "function" ? header(activeEditor) : header}
        <MenuBar editor={activeEditor} />
      </div>

      <div className="mx-auto w-full max-w-220 px-2 py-3 sm:px-2 sm:py-6">
        <div className="rounded-3xl px-3 bg-white shadow-sm">
          {ids.map((id, i) => (
            <LazySection
              key={id}
              id={id}
              eager={i < 2 || id === focusId}
              autoFocus={id === focusId}
              yDoc={yDoc}
              provider={provider}
              userName={userName}
              userColor={userColor}
              onFocus={handleFocus}
              onDestroy={handleDestroy}
              onSplit={insertAfter}
            />
          ))}
        </div>
      </div>
    </div>
  );
}