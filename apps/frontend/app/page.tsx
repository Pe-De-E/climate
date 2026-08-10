"use client";

import { useState } from "react";
import { Sidebar } from "@repo/ui/sidebar";
import { Map, type MapMode } from "@repo/ui/map";
import styles from "./page.module.css";

export default function Home() {
  const [mode, setMode] = useState<MapMode>("local");

  return (
    <div className={styles.page}>
      <Sidebar>
        <button
          type="button"
          onClick={() => setMode("local")}
          aria-pressed={mode === "local"}
          className={`${styles.modeButton} ${
            mode === "local" ? styles.modeButtonActive : ""
          }`}
        >
          Local Mode
          {mode === "local" && (
            <span className={styles.modeButtonBadge}>AKTIV</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMode("global")}
          aria-pressed={mode === "global"}
          className={`${styles.modeButton} ${
            mode === "global" ? styles.modeButtonActive : ""
          }`}
        >
          Global Mode
          {mode === "global" && (
            <span className={styles.modeButtonBadge}>AKTIV</span>
          )}
        </button>
      </Sidebar>
      <Map mode={mode} />
    </div>
  );
}
