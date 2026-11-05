import React, { useEffect, useState } from "react";

// Список участников
export default function PresenceBar(props) {
  const [states, setStates] = useState([]);
  const myClientId = props.awareness.clientID;

  useEffect(() => {
    const update = () => {
      const allStates = Array.from(props.awareness.getStates().entries())
        .map(([clientId, state]) => ({
          clientId: String(clientId),
          user: state.user,
        }))
        .filter((s) => s.user?.name);

      setStates(allStates);
    };

    update();
    props.awareness.on("change", update);
    return () => props.awareness.off("change", update);
  }, [props.awareness]);

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {states.map(({ clientId, user }) => (
        <div
          key={clientId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 8px",
            background: clientId === String(myClientId) ? "#f0f0f0" : "transparent",
            border: "1px solid #000",
            fontSize: "13px",
            fontFamily: "monospace",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              background: user.color,
              border: "1px solid #000",
            }}
          />
          <span>{user.name}</span>
          {/* Кнопка смены имени — только для текущего пользователя */}
          {clientId === String(myClientId) && (
            <button
              onClick={props.onChangeName}
              title="Сменить имя"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                padding: "0 4px",
                marginLeft: "4px",
                opacity: 0.6,
              }}
              onMouseOver={(e) => (e.target.style.opacity = 1)}
              onMouseOut={(e) => (e.target.style.opacity = 0.6)}
            >
              ✏️
            </button>
          )}
        </div>
      ))}
    </div>
  );
}