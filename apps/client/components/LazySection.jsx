import React, { useEffect, useState, useRef } from "react";
import SectionEditor from "./SectionEditor";

export default function LazySection(props) {
  const ref = useRef(null);
  const heightRef = useRef(400);
  const [visible, setVisible] = useState(props.eager === true);

  // показываем редактор, когда секция рядом с экраном (запас 800px)
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      {
        rootMargin: "800px 0px",
      },
    );

    io.observe(ref.current);

    return () => io.disconnect();
  }, []);

  // запоминаем высоту, чтобы скролл не прыгал, когда секция выгружается
  useEffect(() => {
    if (!visible) return;

    const ro = new ResizeObserver(() => {
      heightRef.current = ref.current.offsetHeight;
    });

    ro.observe(ref.current);

    return () => ro.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      style={{ minHeight: visible ? undefined : heightRef.current }}
    >
      {visible && <SectionEditor {...props} />}
    </div>
  );
}