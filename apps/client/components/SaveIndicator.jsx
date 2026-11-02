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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",

        gap: "6px",
        fontSize: "13px",
        fontFamily: "monospace",
        color: status === "saved" ? "#0a0" : "#666",
      }}
    >
      <div
        style={{
          width: "8px",
          height: "8px",
          background: status === "saved" ? "#0a0" : "#fa0",
          border: "1px solid #000",
        }}
      />
      <span>{labels[status]}</span>
    </div>
  );
}