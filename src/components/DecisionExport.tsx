import { useEffect, useRef, useState } from "react";
import type { Decision } from "../engine/types";
import { decisionToJson } from "../engine/decisionToJson";

interface DecisionExportProps {
  decision: Decision;
}

export function DecisionExport({ decision }: DecisionExportProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function handleCopy() {
    const json = decisionToJson(decision);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // Clipboard API unavailable (non-secure context): fall back to the
      // legacy execCommand path. This is a demo nicety, not a download.
      const textarea = document.createElement("textarea");
      textarea.value = json;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      className={`export-button${copied ? " is-copied" : ""}`}
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? "Copied ✓" : "Copy decision JSON"}
    </button>
  );
}
