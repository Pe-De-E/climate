"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
}

export const Modal = ({ open, onClose, title, children }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface, #fff)",
          color: "var(--foreground, #000)",
          border: "1px solid var(--border, rgba(0,0,0,0.08))",
          borderRadius: 12,
          overflow: "hidden",
          width: "90vw",
          height: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            background: "var(--surface-hover, rgba(0,0,0,0.05))",
            borderBottom: "1px solid var(--border, #e5e5e5)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600 }}>{title}</span>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "inherit",
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 24, overflow: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
};
