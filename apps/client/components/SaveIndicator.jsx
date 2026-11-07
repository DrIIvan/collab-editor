import React, { useEffect, useState } from "react";

// Индикатор сохранения
export default function SaveIndicator(props) {
  const [status, setStatus] = useState("syncing");

  useEffect(() => {
    const updateStatus = () => {
      if (props.provider.synced) {
        setStatus("saved");
      } else {
        setStatus("syncing");
      }
    };

    updateStatus();
    props.provider.on("sync", updateStatus);
    return () => props.provider.off("sync", updateStatus);
  }, [props.provider]);

  const labels = {
    syncing: "Синхронизация...",
    saved: "Сохранено",
  };

  const saved = status === "saved";

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium sm:text-[13px] ${
        saved ? "bg-[#e3f4e8] text-[#1b7a3a]" : "bg-[#fff1d6] text-[#8a5a00]"
      }`}
    >
      <span
        className={`size-2 rounded-full ${
          saved ? "bg-[#1b9a4a]" : "animate-pulse bg-[#f5a000]"
        }`}
      />
      <span>{labels[status]}</span>
    </div>
  );
}