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
    <div className="fixed inset-0 z-1000 flex items-end justify-center bg-black/50 p-3 font-['Inter',Roboto,'Helvetica_Neue',Arial,sans-serif] sm:items-center sm:p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl sm:p-8"
      >
        <h2 className="mb-2 text-xl font-semibold text-[#1a1a1a] sm:text-2xl">
          Как вас зовут?
        </h2>
        <p className="mb-6 text-sm text-[#5f6672]">
          Имя будет видно другим участникам
        </p>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите имя"
          maxLength={30}
          className="mb-4 h-12 w-full rounded-lg border border-[#8b93a1] bg-white px-4 text-base text-[#1a1a1a] outline-none transition-colors placeholder:text-[#6b7280] focus:border-[#003399] focus:ring-2 focus:ring-[#003399]/20"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="h-12 w-full cursor-pointer rounded-lg bg-[#003399] text-base font-medium text-white transition-colors hover:bg-[#002a80] active:bg-[#00216b] disabled:cursor-not-allowed disabled:bg-[#c9ced8]"
        >
          Войти
        </button>
      </form>
    </div>
  );
}