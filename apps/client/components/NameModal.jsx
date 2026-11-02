import React, { useEffect, useState, useRef } from "react";

// Модалка для ввода имени
export default function NameModal({ onSubmit }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: "32px",
          maxWidth: "400px",
          width: "90%",
          border: "1px solid #000",
        }}
      >
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 600,
            marginBottom: "8px",
            fontFamily: "monospace",
          }}
        >
          Как вас зовут?
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#666",
            marginBottom: "24px",
          }}
        >
          Имя будет видно другим участникам
        </p>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите имя"
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            border: "1px solid #000",
            marginBottom: "16px",
            fontFamily: "monospace",
          }}
          maxLength={30}
        />
        <button
          type="submit"
          disabled={!name.trim()}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "16px",
            background: name.trim() ? "#000" : "#ccc",
            color: "#fff",
            border: "none",
            cursor: name.trim() ? "pointer" : "not-allowed",
            fontFamily: "monospace",
            fontWeight: 600,
          }}
        >
          Войти
        </button>
      </form>
    </div>
  );
}


