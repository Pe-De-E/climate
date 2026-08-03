"use client";

import { ReactNode, useEffect, useState } from "react";

interface SidebarProps {
  children?: ReactNode;
  className?: string;
}

export const Sidebar = ({ children, className }: SidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <div className={className}>
      <button
        type="button"
        aria-label={isOpen ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1002,
          width: 40,
          height: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          background: "var(--background, #fff)",
          border: "1px solid var(--gray-alpha-200, rgba(0,0,0,0.08))",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 2,
            background: "var(--foreground, #000)",
            transition: "transform 0.2s ease",
            transform: isOpen ? "translateY(6px) rotate(45deg)" : "none",
          }}
        />
        <span
          style={{
            display: "block",
            width: 18,
            height: 2,
            background: "var(--foreground, #000)",
            opacity: isOpen ? 0 : 1,
            transition: "opacity 0.2s ease",
          }}
        />
        <span
          style={{
            display: "block",
            width: 18,
            height: 2,
            background: "var(--foreground, #000)",
            transition: "transform 0.2s ease",
            transform: isOpen ? "translateY(-6px) rotate(-45deg)" : "none",
          }}
        />
      </button>

      <div
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
          zIndex: 1000,
        }}
      />

      <nav
        aria-hidden={!isOpen}
        aria-label="Hauptmenü"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100svh",
          width: 280,
          maxWidth: "80vw",
          background: "var(--background, #fff)",
          color: "var(--foreground, #000)",
          borderRight: "1px solid var(--gray-alpha-200, rgba(0,0,0,0.08))",
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
          zIndex: 1001,
          padding: "80px 24px 24px",
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        {children}
      </nav>
    </div>
  );
};
