"use client";

import { useEffect, useState } from "react";
import { Modal } from "./modal";

const ARCHIVE_START_YEAR = 1940;

export const YearPickerModal = ({
  open,
  onClose,
  title,
  color,
  initialYear,
  maxYear,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  color: string;
  initialYear: number;
  maxYear: number;
  onConfirm: (year: number) => void;
}) => {
  const [year, setYear] = useState(initialYear);

  useEffect(() => {
    if (open) setYear(initialYear);
  }, [open, initialYear]);

  return (
    <Modal open={open} onClose={onClose} title={title} width="360px" height="auto">
      <div style={{ fontSize: 32, fontWeight: 600, textAlign: "center", marginBottom: 16 }}>
        {year}
      </div>
      <input
        type="range"
        min={ARCHIVE_START_YEAR}
        max={maxYear}
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        style={{ width: "100%", accentColor: color }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--foreground-muted, #9aa0ab)",
          marginTop: 4,
          marginBottom: 20,
        }}
      >
        <span>{ARCHIVE_START_YEAR}</span>
        <span>{maxYear}</span>
      </div>
      <button
        type="button"
        onClick={() => onConfirm(year)}
        style={{
          width: "100%",
          padding: "10px 16px",
          borderRadius: 8,
          border: "none",
          background: "var(--accent, #0f766e)",
          color: "#fff",
          font: "inherit",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Übernehmen
      </button>
    </Modal>
  );
};
