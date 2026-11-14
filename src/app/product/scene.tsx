"use client";
import { useEffect, useState } from "react";
import { MessageCircle, RotateCcw } from "lucide-react";
import styles from "./product.module.css";
const request = "A massage on Monday after 3?";
export default function AgentScene() {
  const [run, setRun] = useState(0);
  const [letters, setLetters] = useState(request.length);
  const [selected, setSelected] = useState("15:30");
  useEffect(() => {
    if (!run) return;
    if (letters >= request.length) return;
    const timer = window.setTimeout(
      () => setLetters((value) => Math.min(value + 1, request.length)),
      45,
    );
    return () => window.clearTimeout(timer);
  }, [run, letters]);
  const ready = letters === request.length;
  return (
    <div
      className={styles.scene}
      id="agent-demo"
      aria-label="Illustrated assistant booking flow"
    >
      <div className={styles.question}>
        <MessageCircle size={23} aria-hidden="true" />
        <span aria-label={request}>
          <span aria-hidden="true">
            {request.slice(0, letters)}
            {!ready && "…"}
          </span>
        </span>
      </div>
      <div className={styles.timeCard}>
        <strong>Massage · Anna · 30 min</strong>
        <div className={styles.times} aria-label="Illustrated times">
          {["15:00", "15:30", "16:00"].map((time) => (
            <button
              type="button"
              key={time}
              aria-pressed={selected === time}
              onClick={() => setSelected(time)}
              disabled={!ready}
            >
              {time}
            </button>
          ))}
        </div>
        <p aria-live="polite">
          {ready
            ? `${selected} selected · no booking created`
            : "Checking illustrative availability…"}
        </p>
      </div>
      <div className={styles.sceneFooter}>
        <span>Illustrated demo</span>
        <button
          type="button"
          onClick={() => {
            const reduced = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches;
            setLetters(reduced ? request.length : 0);
            setRun((value) => value + 1);
          }}
        >
          <RotateCcw size={14} aria-hidden="true" /> Replay
        </button>
      </div>
    </div>
  );
}
