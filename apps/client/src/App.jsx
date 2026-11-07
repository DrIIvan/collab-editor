import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import HomePage from "../components/HomePage";
import DocumentEditor from "../components/DocumentEditor";
import "./styles.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/d/:docId" element={<DocumentEditor />} />
      {/* Fallback: любой неизвестный URL → главная */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}