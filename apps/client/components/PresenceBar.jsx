import React, { useEffect, useState } from "react";

// Список участников
export default function PresenceBar(props) {
  const [states, setStates] = useState([]);

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
    <div className="flex flex-wrap items-center gap-2">
      {states.map(({ clientId, user }) => {
        const isMe = user.name === props.userName;
        return (
          <div
            key={clientId}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-[#1a1a1a] ${
              isMe
                ? "bg-[#dce8fb]"
                : "border border-[#d5dae3] bg-white"
            }`}
          >
            {/* Цвет пользователя приходит из awareness — единственный inline-стиль */}
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ background: user.color }}
            />
            <span className="max-w-40 truncate">{user.name}</span>

            {/* Кнопка смены имени — только для текущего пользователя */}
            {isMe && (
              <button
                onClick={props.onChangeName}
                title="Сменить имя"
                className="-mr-1 cursor-pointer rounded-md px-1 text-sm opacity-60 transition-opacity hover:opacity-100"
              >
                ✏️
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}